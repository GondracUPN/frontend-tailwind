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

  const minimumCard = screen.getByText('Precio minimo (+20%)').parentElement;
  const mediumCard = screen.getByText('Precio medio (+40%)').parentElement;
  expect(within(minimumCard).getByText('S/ 510.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 590.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de cambio (US$ a S/)'), { target: { value: '4' } });

  expect(within(minimumCard).getByText('S/ 540.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 630.00')).toBeInTheDocument();
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
  expect(within(history).getByText('Pantalla:')).toHaveTextContent('14');
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

  const watch = within(history).getByText('Apple Watch Ultra 2').closest('article');
  expect(within(watch).getByText('Serie:')).toHaveTextContent('2');
  expect(within(watch).getByText('Tamaño:')).toHaveTextContent('49 mm');
  expect(within(watch).getByText('Conexión:')).toHaveTextContent('GPS + Cel');
  expect(within(watch).getByText('Estado:')).toHaveTextContent('nuevo');
  expect(within(watch).queryByText('SSD:')).not.toBeInTheDocument();

  const ipad = within(history).getByText('iPad Pro').closest('article');
  expect(within(ipad).getByText('Procesador:')).toHaveTextContent('M2');
  expect(within(ipad).getByText('Pantalla:')).toHaveTextContent('11');
  expect(within(ipad).getByText('RAM:')).toHaveTextContent('8 GB');
  expect(within(ipad).getByText('Almacenamiento:')).toHaveTextContent('256 GB');
  expect(within(ipad).queryByText('SSD:')).not.toBeInTheDocument();
});
