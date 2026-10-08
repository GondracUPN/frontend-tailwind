jest.mock('pdfjs-dist/webpack', () => ({ getDocument: jest.fn() }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalDec, {
  allocateDecByReference,
  buildAmazonTemplateHTML,
  normalizeManualEbayOrderNumber,
  parseEbayOrderClipboard,
  parseEbayUspsClipboard,
} from './ModalDec';

jest.mock('../api', () => ({
  __esModule: true,
  API_URL: 'http://localhost:3001',
  default: { get: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({});
});

test('reparte el DEC por precio normal y cantidad', () => {
  const items = allocateDecByReference([
    { name: 'Producto principal', qty: 2, ref: 100 },
    { name: 'Producto extra', qty: 1, ref: 50 },
  ], 100);

  expect(items).toEqual([
    expect.objectContaining({ name: 'Producto principal', qty: 2, price: 40 }),
    expect.objectContaining({ name: 'Producto extra', qty: 1, price: 20 }),
  ]);
  expect(items.reduce((sum, item) => sum + item.price * item.qty, 0)).toBe(100);
});

test('completa y formatea un order number corto de eBay', () => {
  const randomDigits = [0.4, 0.8];
  const result = normalizeManualEbayOrderNumber('1311134141', () => randomDigits.shift());

  expect(result).toBe('13-11134-14148');
});

test('lee los datos copiados desde el boton de eBay', () => {
  expect(parseEbayOrderClipboard('DEC_EBAY_ORDER:{"seller":"961firstave","orderNumber":"16-13587-70764"}')).toEqual({
    seller: '961firstave',
    orderNumber: '16-13587-70764',
  });
  expect(parseEbayOrderClipboard('Seller: pawn_shop_1\nOrder number: 26-12345-67890')).toEqual({
    seller: 'pawn_shop_1',
    orderNumber: '26-12345-67890',
  });
});

test('lee los campos USPS copiados de eBay y rechaza datos incompletos', () => {
  expect(parseEbayUspsClipboard('DEC_EBAY_USPS:{"statusDate":"2026-09-19T16:42","dearName":"JORGE GARCIA","recipientName":"JORGE SAHID GARCIA SANCHEZ","tracking":"9405 5081 0624 5583 7769 13"}')).toEqual({
    statusDate: '2026-09-19T16:42',
    dearName: 'JORGE GARCIA',
    recipientName: 'JORGE SAHID GARCIA SANCHEZ',
    tracking: '9405508106245583776913',
  });
  expect(parseEbayUspsClipboard('DEC_EBAY_USPS:{"statusDate":"","tracking":"9405"}')).toBeNull();
});

test('Pegar de eBay llena seller y order number desde el portapapeles', async () => {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      readText: jest.fn().mockResolvedValue(
        'DEC_EBAY_ORDER:{"seller":"pawn_shop_1","orderNumber":"26-12345-67890"}',
      ),
    },
  });
  render(<ModalDec productos={[]} onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Pegar de eBay' }));

  await waitFor(() => {
    expect(screen.getByPlaceholderText('961firstave')).toHaveValue('pawn_shop_1');
    expect(screen.getByPlaceholderText('16-13587-70764')).toHaveValue('26-12345-67890');
  });
});

test('al salir del campo corrige el order number manual, pero no el de Amazon', async () => {
  render(<ModalDec productos={[]} onClose={jest.fn()} />);

  const orderNumber = screen.getByPlaceholderText('16-13587-70764');
  fireEvent.change(orderNumber, { target: { value: '1311134141' } });
  fireEvent.blur(orderNumber);
  expect(orderNumber.value).toMatch(/^13-11134-141\d{2}$/);

  fireEvent.change(screen.getAllByLabelText('Tienda')[0], { target: { value: 'amazon' } });
  const amazonOrderNumber = screen.getByPlaceholderText('112-6574313-0325818');
  fireEvent.change(amazonOrderNumber, { target: { value: '12345' } });
  fireEvent.blur(amazonOrderNumber);
  expect(amazonOrderNumber).toHaveValue('12345');
});

test('el modal DEC solo se cierra desde la X', () => {
  const onClose = jest.fn();
  render(<ModalDec productos={[]} onClose={onClose} />);

  fireEvent.click(screen.getByRole('dialog'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Cerrar modal' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

test('Amazon muestra una imagen por producto distinto y badge para cantidades mayores a uno', () => {
  const html = buildAmazonTemplateHTML({
    placedOn: '2026-06-29',
    orderNumber: '112-1234567-1234567',
    casilleroKey: 'Renato',
    deliveryMode: 'tomorrow',
    items: [
      { name: 'Producto principal', qty: 2, price: 40, imageSmall: 'main.png' },
      { name: 'Producto extra', qty: 1, price: 20, imageSmall: 'extra.png' },
    ],
  });

  expect((html.match(/data-component="itemImage"/g) || [])).toHaveLength(2);
  expect(html).toContain('<div class="od-item-view-qty"><span>2</span></div>');
  expect(html).toContain('src="main.png"');
  expect(html).toContain('src="extra.png"');
  expect(html).toContain('<li><span class="a-list-item">Renato Alfonso Carbajal Cachay</span></li>');
  expect(html).toContain('2323 NW 82ND AVE STE 110 PEZ97722');
  expect(html).toContain('$40.00');
  expect(html).toContain('$20.00');
  expect(html).toContain('$100.00');
});

test('el editor Amazon permite aumentar cantidad y agregar otro producto con precio', async () => {
  const productos = [{
    id: 10,
    tipo: 'iphone',
    estado: 'comprado_en_camino',
    detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256' },
    valor: { valorDec: 100, valorProducto: 100, fechaCompra: '2026-06-29' },
    tracking: [{ id: 1, estado: 'comprado_en_camino', casillero: 'Renato' }],
  }];
  render(<ModalDec productos={productos} onClose={jest.fn()} />);

  await waitFor(() => expect(api.get).toHaveBeenCalled());
  fireEvent.change(screen.getAllByLabelText('Tienda')[0], { target: { value: 'amazon' } });
  const productSelect = screen.getByRole('option', { name: 'iPhone 15 Pro 256 GB' }).parentElement;
  fireEvent.change(productSelect, { target: { value: '10' } });
  expect(screen.getByRole('button', { name: 'Copiar selector' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Copiar HTML' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Publicar plantilla TM' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Subir factura' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Imprimir / Guardar PDF' })).not.toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText('Cantidad producto principal'), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Agregar otro producto' }));
  fireEvent.change(screen.getByPlaceholderText('Nombre del producto'), { target: { value: 'Producto extra' } });
  fireEvent.change(screen.getByLabelText('Precio producto extra 2'), { target: { value: '50' } });

  await waitFor(() => {
    const html = document.getElementById('dec-html-ta').value;
    expect(html).toContain('<div class="od-item-view-qty"><span>2</span></div>');
    expect(html).toContain('Producto extra');
    expect((html.match(/data-component="itemImage"/g) || [])).toHaveLength(2);
    expect(html).toContain('$40.00');
    expect(html).toContain('$20.00');
  });
  expect(screen.getByText('Imagen por producto extra')).toBeInTheDocument();
});

test('Amazon agrupa solo dos productos iguales y conserva enlaces de los otros dos', async () => {
  const productos = [
    { id: 10, tipo: 'iphone', envioGrupoId: 77, estado: 'comprado_en_camino', detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256' }, valor: { valorDec: 100, valorProducto: 100 } },
    { id: 11, tipo: 'iphone', envioGrupoId: 77, estado: 'comprado_en_camino', detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256' }, valor: { valorDec: 0, valorProducto: 100 } },
    { id: 12, tipo: 'ipad', envioGrupoId: 77, estado: 'comprado_en_camino', detalle: { numero: '10' }, valor: { valorDec: 0, valorProducto: 80 } },
    { id: 13, tipo: 'macbook', envioGrupoId: 77, estado: 'comprado_en_camino', detalle: { modelo: 'Air' }, valor: { valorDec: 0, valorProducto: 120 } },
  ];
  render(<ModalDec productos={productos} onClose={jest.fn()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  fireEvent.change(screen.getAllByLabelText('Tienda')[0], { target: { value: 'amazon' } });
  const selector = screen.getAllByRole('option', { name: 'iPhone 15 Pro 256 GB' })[0].parentElement;
  fireEvent.change(selector, { target: { value: '10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Mismo producto' }));
  fireEvent.click(screen.getByLabelText('Mismo producto vinculado #12'));
  fireEvent.click(screen.getByLabelText('Mismo producto vinculado #13'));
  fireEvent.change(screen.getByLabelText('Link producto vinculado #12'), { target: { value: 'https://www.amazon.com/dp/IPAD' } });
  fireEvent.change(screen.getByLabelText('Link producto vinculado #13'), { target: { value: 'https://www.amazon.com/dp/MAC' } });

  await waitFor(() => {
    const html = document.getElementById('dec-html-ta').value;
    expect((html.match(/data-component="itemImage"/g) || [])).toHaveLength(3);
    expect(html).toContain('<div class="od-item-view-qty"><span>2</span></div>');
    expect(html).toContain('href="https://www.amazon.com/dp/IPAD"');
    expect(html).toContain('href="https://www.amazon.com/dp/MAC"');
  });
  expect(screen.getAllByText('Imagen por producto extra')).toHaveLength(1);
});
