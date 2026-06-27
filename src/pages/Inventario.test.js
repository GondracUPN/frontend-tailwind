import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../api';
import Inventario from './Inventario';

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
  },
}));

const entry = {
  producto: {
    id: 42,
    tipo: 'iphone',
    estado: 'usado',
    accesorios: ['Caja'],
    detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
    tracking: [{ id: 1, estado: 'recogido', fechaRecogido: '2026-06-20' }],
  },
  ficha: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue([entry]);
});

test('lista un producto disponible y abre su ficha de cotejo', async () => {
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByText(/iPhone 15 Pro/)).toBeInTheDocument();
  expect(screen.getByText('MS-42')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Agregar foto' })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Buscar producto, color, serial o IMEI'), { target: { value: 'ms-code-42' } });
  expect(screen.getByText('MS-42')).toBeInTheDocument();
  expect(screen.getAllByText('Por cotejar')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  expect(within(screen.getByRole('dialog', { name: 'Completar ficha de inventario' })).getByRole('heading', { name: 'iPhone 15 Pro' })).toBeInTheDocument();
  expect(screen.getByLabelText('Color')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Caja' })).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/inventario'));
});

test('confirma antes de quitar el cotejo de almacén', async () => {
  api.get.mockResolvedValue([{ ...entry, ficha: { enAlmacen: true } }]);
  api.patch.mockResolvedValue({ enAlmacen: false });
  render(<Inventario setVista={jest.fn()} />);

  const storageCheck = await screen.findByRole('checkbox', { name: 'Almacén' });
  fireEvent.click(storageCheck);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(api.patch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'No, mantener' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(storageCheck).toBeChecked();

  fireEvent.click(storageCheck);
  fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/inventario/42', { enAlmacen: false }));
});

test('muestra la foto solamente al pulsar Ver foto', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { fotoUrl: 'https://res.cloudinary.com/demo/image/upload/foto.jpg', fotosTomadas: true },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(screen.queryByRole('img', { name: 'iPhone 15 Pro' })).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Ampliar foto de iPhone 15 Pro' }));
  expect(screen.getByRole('img', { name: 'iPhone 15 Pro' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto' }));
  expect(screen.getByRole('button', { name: 'Reducir foto' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Cerrar foto' })).toBeInTheDocument();
});

test('guarda el primer precio en soles dentro de la ficha', async () => {
  api.get.mockResolvedValue([entry]);
  api.patch.mockResolvedValue({ primerPrecioSoles: 125.5 });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  const priceInput = screen.getByLabelText('Primer precio (S/)');
  expect(priceInput).toHaveValue(null);
  fireEvent.change(priceInput, { target: { value: '125.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/inventario/42',
    expect.objectContaining({ primerPrecioSoles: 125.5 }),
  ));
  expect(api.patch).not.toHaveBeenCalledWith('/productos/42', expect.anything());
});

test('solicita fecha solo cuando la garantía es limitada', async () => {
  render(<Inventario setVista={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));

  fireEvent.click(screen.getByLabelText('¿Tiene garantía?'));
  fireEvent.change(screen.getByLabelText('Tipo de garantía'), { target: { value: 'applecare' } });
  expect(screen.getByLabelText('Garantía hasta (opcional)')).not.toBeRequired();
  expect(screen.getByText('La fecha de AppleCare es opcional.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de garantía'), { target: { value: 'limitada' } });
  expect(screen.getByLabelText('Garantía hasta')).toBeRequired();
  expect(screen.queryByLabelText('Detalle de garantía')).not.toBeInTheDocument();
});

test('Factura US carga el producto por code y calcula 25 por ciento adicional', async () => {
  const invoiceEntry = {
    ...entry,
    producto: { ...entry.producto, id: 266, valor: { valorProducto: 100, fechaCompra: '2026-06-10' } },
    ficha: { serial: 'SN123', imei: '111111111111111', imei2: '222222222222222' },
  };
  api.get.mockImplementation((path) => {
    if (path === '/inventario') return Promise.resolve([entry]);
    if (path === '/inventario/producto/266') return Promise.resolve(invoiceEntry);
    return Promise.resolve({});
  });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Factura US' }));
  fireEvent.change(await screen.findByPlaceholderText('MS-123'), { target: { value: 'MS-266' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar producto' }));

  await waitFor(() => expect(screen.getByLabelText('Valor DEC (USD)')).toHaveValue(125));
  expect(api.get).toHaveBeenCalledWith('/inventario/producto/266');
  expect(screen.getByLabelText('Item name')).toHaveValue('iPhone 15 Pro');
  expect(screen.getByLabelText('SN')).toHaveValue('SN123');
  expect(screen.getByLabelText('Imei 1')).toHaveValue('111111111111111');
  expect(screen.getByLabelText('Imei 2')).toHaveValue('222222222222222');
});

test('detecta todos los identificadores y mantiene la lupa mientras se corrigen', async () => {
  api.get.mockResolvedValue([entry]);
  api.post.mockResolvedValue({
    text: 'Serial Number: C02ABCDE1234\nIMEI 1: 490154203237518\nIMEI 2: 356938035643809',
  });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  const scanFile = new File(['imagen temporal'], 'identificadores.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Imagen temporal para escanear'), { target: { files: [scanFile] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Detectar SN / IMEI' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Detectar SN / IMEI' }));

  expect(await screen.findByText('490154203237518')).toBeInTheDocument();
  expect(screen.getByText('356938035643809')).toBeInTheDocument();
  expect(screen.getByLabelText('IMEI 1')).toHaveValue('490154203237518');
  expect(screen.getByLabelText('IMEI 2')).toHaveValue('356938035643809');
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto' }));
  expect(screen.getByText('Lupa · 150%')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('IMEI 1'), { target: { value: '490154203237519' } });
  expect(screen.getByText('Lupa · 150%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen temporal' }));
  expect(screen.queryByRole('img', { name: 'Revisión ampliada para SN e IMEI' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Detectar SN / IMEI' })).toBeDisabled();
});
