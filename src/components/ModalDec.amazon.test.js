import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalDec, { allocateDecByReference, buildAmazonTemplateHTML } from './ModalDec';

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
