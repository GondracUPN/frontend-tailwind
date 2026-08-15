import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../api';
import ModalCalculadora from './ModalCalculadora';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const producto = {
  id: 42,
  tipo: 'macbook',
  estado: 'usado',
  detalle: { gama: 'Pro', procesador: 'M3 Pro', tamano: '14', ram: '18 GB', almacenamiento: '512 GB' },
  valor: { valorProducto: 100, costoEnvio: 50, costoTotal: 420 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('recalcula precio mínimo y medio con el tipo de cambio ingresado', () => {
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  expect(screen.getByText('MacBook Pro · M3 Pro · 14" · 18 · 512')).toBeInTheDocument();
  const minimumCard = screen.getByText('Precio minimo (+20%)').parentElement;
  const mediumCard = screen.getByText('Precio medio (+30%)').parentElement;
  expect(within(minimumCard).getByText('S/ 510.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 550.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 126.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de cambio (US$ a S/)'), { target: { value: '4' } });

  expect(within(minimumCard).getByText('S/ 540.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 600.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 135.00')).toBeInTheDocument();
});

test('redondea el precio medio hacia arriba para terminar en 00 o 50', () => {
  render(<ModalCalculadora producto={{
    ...producto,
    valor: { valorProducto: 0, costoEnvio: 0, costoTotal: 3617.45 },
  }} onClose={jest.fn()} />);

  const mediumCard = screen.getByText('Precio medio (+30%)').parentElement;
  expect(within(mediumCard).getByText('S/ 4750.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 1085.24')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 1132.55')).toBeInTheDocument();
});

test('calcula accesorios por cantidad, precio unitario y lote seleccionado', () => {
  render(<ModalCalculadora producto={{
    id: 40,
    tipo: 'accesorios',
    detalle: { descripcionOtro: 'AirTag' },
    stockInicial: 10,
    stockActual: 6,
    valor: { costoTotal: 500, valorProducto: 100, costoEnvio: 20 },
    __lots: [
      { id: 12, tipo: 'accesorios', stockInicial: 24, stockActual: 4, valor: { costoTotal: 720, fechaCompra: '2026-01-10' }, tracking: [{ fechaRecogido: '2026-02-01' }] },
      { id: 40, tipo: 'accesorios', stockInicial: 10, stockActual: 6, valor: { costoTotal: 500, fechaCompra: '2026-07-10' }, tracking: [{ fechaRecogido: '2026-07-20' }] },
    ],
  }} onClose={jest.fn()} />);

  expect(screen.getByLabelText('Lote de compra')).toHaveValue('12');
  expect(screen.getByText('Costo unitario usado:').parentElement).toHaveTextContent('S/ 30.00');
  fireEvent.change(screen.getByLabelText('Unidades a vender'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Precio unitario de venta (S/)'), { target: { value: '50' } });
  expect(screen.getByText('Venta total:').parentElement).toHaveTextContent('S/ 150.00');
  expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent('S/ 60.00');

  fireEvent.change(screen.getByLabelText('Lote de compra'), { target: { value: '40' } });
  expect(screen.getByText('Costo unitario usado:').parentElement).toHaveTextContent('S/ 50.00');
  expect(screen.getByText('Venta total:').parentElement).toHaveTextContent('S/ 150.00');
  expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent('S/ 0.00');
});

test('resume un iPhone sin agregar procesador, pantalla ni RAM', () => {
  render(<ModalCalculadora producto={{
    ...producto,
    tipo: 'iphone',
    detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
  }} onClose={jest.fn()} />);

  expect(screen.getByText('iPhone 15 Pro · 256')).toBeInTheDocument();
  expect(screen.queryByText(/M3 Pro/)).not.toBeInTheDocument();
});

test('abre al lado los últimos equipos vendidos similares', async () => {
  api.get.mockResolvedValue([{
    id: 10,
    fechaVenta: '2026-07-01',
    diasHastaVenta: 11,
    precioVenta: 5990,
    producto: {
      id: 201,
      tipo: 'macbook',
      estado: 'usado',
      detalle: { gama: 'Pro', procesador: 'M3 Pro', tamano: '14', ram: '18 GB', almacenamiento: '1 TB' },
    },
  }]);
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Últimos vendidos →' }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/similares?productoId=42&limit=8'));
  const history = await screen.findByLabelText('Últimos equipos vendidos similares');
  expect(within(history).getByText('MacBook Pro')).toBeInTheDocument();
  expect(within(history).getByText('Procesador:')).toHaveTextContent('M3 Pro');
  expect(within(history).getByText('Pantalla:')).toHaveTextContent('14"');
  expect(within(history).getByText('RAM:')).toHaveTextContent('18 GB');
  expect(within(history).getByText('SSD:')).toHaveTextContent('1 TB');
  expect(within(history).getByText('Estado:')).toHaveTextContent('usado');
  expect(within(history).getByText('Fecha venta:')).toHaveTextContent('01/07/2026');
  expect(within(history).getByText('Días hasta venta:')).toHaveTextContent('11 días');
  expect(within(history).getByText('S/ 5990.00')).toBeInTheDocument();
});

test('muestra solo los datos correspondientes a iPhone y Apple Watch', async () => {
  api.get.mockResolvedValue([
    {
      id: 20,
      fechaVenta: '2026-07-01',
      diasHastaVenta: 7,
      precioVenta: 3200,
      producto: {
        tipo: 'iphone',
        estado: 'usado',
        detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
      },
    },
    {
      id: 21,
      fechaVenta: '2026-06-28',
      diasHastaVenta: 4,
      precioVenta: 2500,
      producto: {
        tipo: 'watch',
        estado: 'nuevo',
        detalle: { gama: 'Ultra', generacion: '2', tamano: '49 mm', conexion: 'GPS + Cel' },
      },
    },
    {
      id: 22,
      fechaVenta: '2026-06-25',
      diasHastaVenta: 6,
      precioVenta: 2800,
      producto: {
        tipo: 'ipad',
        estado: 'usado',
        detalle: { gama: 'Pro', procesador: 'M2', tamano: '11', ram: '8 GB', almacenamiento: '256 GB' },
      },
    },
  ]);
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Últimos vendidos →' }));
  const history = await screen.findByLabelText('Últimos equipos vendidos similares');
  const iphone = (await within(history).findByText('iPhone 15 Pro')).closest('article');
  expect(within(iphone).getByText('Almacenamiento:')).toHaveTextContent('256 GB');
  expect(within(iphone).getByText('Estado:')).toHaveTextContent('usado');
  expect(within(iphone).queryByText('SSD:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('RAM:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('Procesador:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('Pantalla:')).not.toBeInTheDocument();

  const watch = within(history).getByText('Apple Watch Ultra 2 49 mm GPS + Cel').closest('article');
  expect(within(watch).getByText('Serie:')).toHaveTextContent('2');
  expect(within(watch).getByText('Tamaño:')).toHaveTextContent('49 mm');
  expect(within(watch).getByText('Conexión:')).toHaveTextContent('GPS + Cel');
  expect(within(watch).getByText('Estado:')).toHaveTextContent('nuevo');
  expect(within(watch).queryByText('SSD:')).not.toBeInTheDocument();

  const ipad = within(history).getByText('iPad Pro').closest('article');
  expect(within(ipad).getByText('Procesador:')).toHaveTextContent('M2');
  expect(within(ipad).getByText('Pantalla:')).toHaveTextContent('11"');
  expect(within(ipad).getByText('RAM:')).toHaveTextContent('8 GB');
  expect(within(ipad).getByText('Almacenamiento:')).toHaveTextContent('256 GB');
  expect(within(ipad).queryByText('SSD:')).not.toBeInTheDocument();
});
