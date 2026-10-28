import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import AnularVentaButton, { CONFIRMAR_ANULACION } from './AnularVentaButton';
import ModalVenta from './ModalVenta';
import { SALES_UPDATED_EVENT } from '../utils/salesSync';

jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));

const venta = { id: 42, productoId: 7, fechaVenta: '2026-05-10', precioVenta: 3000, tipoCambio: 3.7, ganancia: 600, porcentajeGanancia: 25, estadoComercial: 'entregada' };
const comoAdmin = () => { localStorage.setItem('token', 't'); localStorage.setItem('user', JSON.stringify({ role: 'admin' })); };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  window.confirm = jest.fn(() => true);
});

test('confirma, anula sin pedir monto ni cuenta y notifica a Productos, Gastos e Inventario', async () => {
  comoAdmin();
  localStorage.setItem('ganancias:cache:x', '1');
  api.post.mockResolvedValue({ ...venta, estadoComercial: 'cancelada', anuladaAt: '2026-05-11T00:00:00Z' });
  const onAnulada = jest.fn();
  const eventos = [];
  const escuchar = (e) => eventos.push(e.detail);
  window.addEventListener(SALES_UPDATED_EVENT, escuchar);
  render(<AnularVentaButton venta={venta} onAnulada={onAnulada} />);
  fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
  await waitFor(() => expect(onAnulada).toHaveBeenCalled());
  window.removeEventListener(SALES_UPDATED_EVENT, escuchar);
  expect(window.confirm).toHaveBeenCalledWith(`Venta #42 · 2026-05-10 · S/ 3000.00\n${CONFIRMAR_ANULACION}`);
  expect(CONFIRMAR_ANULACION).toMatch(/ingresos.*disponible/);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/ventas/42/anular', {});
  expect(eventos).toEqual([expect.objectContaining({ anulada: true, ventaId: 42, productoId: 7 })]);
  expect(localStorage.getItem('ganancias:cache:x')).toBeNull();
});

test('no hace nada si se cancela la confirmación y muestra el error del servidor', async () => {
  comoAdmin();
  window.confirm = jest.fn(() => false);
  render(<AnularVentaButton venta={venta} />);
  fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
  expect(api.post).not.toHaveBeenCalled();
  window.confirm = jest.fn(() => true);
  api.post.mockRejectedValue(new Error('HTTP 400 - La venta ya se devolvió por completo'));
  fireEvent.click(screen.getByRole('button', { name: 'Anular venta' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('La venta ya se devolvió por completo');
});

test('solo aparece para administradores y ventas vigentes', () => {
  const { container, rerender } = render(<AnularVentaButton venta={venta} />);
  expect(container).toBeEmptyDOMElement();
  comoAdmin();
  rerender(<AnularVentaButton venta={{ ...venta, estadoComercial: 'cancelada' }} />);
  expect(container).toBeEmptyDOMElement();
});

test('ModalVenta muestra la acción solo cuando Productos la habilita', () => {
  comoAdmin();
  const producto = { id: 7, tipo: 'macbook', vendedor: 'Gonzalo', valor: { monedaCompra: 'USD' } };
  const { rerender } = render(<ModalVenta producto={producto} venta={venta} onClose={jest.fn()} />);
  expect(screen.queryByRole('button', { name: 'Anular venta' })).toBeNull();
  rerender(<ModalVenta producto={producto} venta={venta} onClose={jest.fn()} onAnulada={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Anular venta' })).toBeInTheDocument();
});

test('en accesorios permite anular cada venta del resumen desde Productos', async () => {
  comoAdmin();
  api.get.mockResolvedValue({ unidadesVendidas: 3, ventas: [
    { id: 51, fechaVenta: '2026-05-01', cantidad: 1, ventaBruta: 80, precioUnitario: 80 },
    { id: 52, fechaVenta: '2026-05-02', cantidad: 2, ventaBruta: 160, precioUnitario: 80 },
  ] });
  api.post.mockResolvedValue({ id: 52, estadoComercial: 'cancelada' });
  const onAnulada = jest.fn();
  render(<ModalVenta producto={{ id: 9, tipo: 'accesorios', stockActual: 2, stockInicial: 5, vendedor: 'Gonzalo', valor: { monedaCompra: 'PEN' } }}
    onClose={jest.fn()} onAnulada={onAnulada} />);
  const botones = await screen.findAllByRole('button', { name: 'Anular venta' });
  expect(botones).toHaveLength(2);
  fireEvent.click(botones[1]);
  await waitFor(() => expect(onAnulada).toHaveBeenCalled());
  expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Venta #52 · 2026-05-02 · S/ 160.00'));
  expect(api.post).toHaveBeenCalledWith('/ventas/52/anular', {});
});
