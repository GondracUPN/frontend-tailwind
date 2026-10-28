import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  const year = new Date().getFullYear();
  expect(api.get).toHaveBeenCalledWith(`/ventas?from=${year}-01-01&to=${year}-12-31`);
});

test('diferencia un error de consulta de un resultado de cero ventas', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  api.get.mockRejectedValue(new Error('Sin conexión'));
  render(<Ganancias setVista={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron cargar las ventas');
  expect(screen.getByText('Ventas totales')).not.toBeVisible();
  log.mockRestore();
});

test('integra accesorios y costo vendido en la tabla, por tipo y por vendedor', async () => {
  const year = new Date().getFullYear();
  const make = (id, vendedor, cantidad, costoVendido, precioVenta) => ({ id, vendedor, cantidad, costoVendido, precioVenta, ganancia: precioVenta - costoVendido, fechaVenta: year + '-01-12', producto: { id, tipo: 'accesorios', stockInicial: 100, valor: { costoTotal: 10000 }, detalle: { modelo: 'AirTag' } } });
  api.get.mockResolvedValue([make(1, 'Gonzalo', 1, 100, 150), make(2, 'ambos', 4, 400, 600)]);
  render(<Ganancias setVista={jest.fn()} />);
  await screen.findByText('Accesorios (5)');
  // Una sola fila para todos los accesorios, sin una fila por modelo.
  expect(screen.queryByRole('row', { name: /^AirTag/ })).not.toBeInTheDocument();
  const row = screen.getByRole('row', { name: /Accesorios \(5\)/ });
  expect(row).toHaveTextContent('S/ 300.00'); expect(row).toHaveTextContent('S/ 450.00'); expect(row).toHaveTextContent('S/ 150.00'); expect(row).toHaveTextContent('50.00%');
  expect(row).not.toHaveTextContent('10,000');
  const open = within(row).getByRole('button', { name: 'Ver ventas' });
  open.focus();
  fireEvent.click(open);
  const panel = screen.getByRole('region', { name: 'Ventas de accesorios de Gonzalo' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(panel.closest('tr').previousElementSibling).toBe(row);
  expect(panel.closest('td')).toHaveAttribute('colspan', '8');
  expect(open).toHaveAttribute('aria-expanded', 'true');
  expect(within(panel).getByText('AirTag')).toBeInTheDocument();
  expect(within(row).queryByText('AirTag')).not.toBeInTheDocument();
  expect(within(panel).getAllByRole('button', { name: 'Editar' })).toHaveLength(2);
  expect(api.get).toHaveBeenCalledTimes(1);
  fireEvent.click(within(row).getByRole('button', { name: 'Ocultar ventas' }));
  expect(screen.queryByRole('region', { name: 'Ventas de accesorios de Gonzalo' })).not.toBeInTheDocument();
  expect(open).toHaveAttribute('aria-expanded', 'false');
  expect(open).toHaveFocus();
  fireEvent.change(screen.getAllByLabelText('Mes', { exact: true })[0], { target: { value: '2' } });
  expect(screen.queryByText('Accesorios (5)')).not.toBeInTheDocument();
});
