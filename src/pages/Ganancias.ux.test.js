import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Ganancias from './Ganancias';
import api from '../api';
import { formatDisplayMoney } from '../components/ui/VisualUI';

jest.mock('../api', () => ({ get: jest.fn() }));
jest.mock('../components/ModalVenta', () => () => null);

beforeEach(() => { localStorage.clear(); jest.clearAllMocks(); });

test('identifica PEN y USD y conserva los decimales al presentar importes', () => {
  expect(formatDisplayMoney(254201.5)).toBe('S/ 254,201.50');
  expect(formatDisplayMoney('12450.75', 'USD')).toBe('US$ 12,450.75');
  expect(formatDisplayMoney(-25)).toBe('S/ -25.00');
});

test('muestra carga sin presentar ceros financieros como resultado definitivo', async () => {
  let complete;
  api.get.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<Ganancias setVista={jest.fn()} />);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando ventas');
  expect(screen.getByText('Ventas totales')).not.toBeVisible();
  complete([]);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Mes (global)')).toBeVisible();
});

test('conserva filtros independientes por vendedor y evita escrituras al filtrar', async () => {
  api.get.mockResolvedValue([]);
  render(<Ganancias setVista={jest.fn()} />);
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
  const months = screen.getAllByLabelText('Mes', { exact: true });
  fireEvent.change(months[0], { target: { value: '1' } });
  expect(months[0]).toHaveValue('1');
  expect(months[1]).toHaveValue('');
  expect(screen.getByLabelText('Mes (global)')).toHaveValue('');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/ventas');
});

test('diferencia un error de consulta de un resultado de cero ventas', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockRejectedValue(new Error('Sin conexión'));
  render(<Ganancias setVista={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las ventas');
  expect(screen.getByText('Ventas totales')).not.toBeVisible();
  log.mockRestore();
});
