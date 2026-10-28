import { act, render, waitFor } from '@testing-library/react';
import api from '../api';
import Productos from './Productos';
import { notifySalesChanged } from '../utils/salesSync';
import { invalidate } from '../services/productosStore';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() } }));

beforeEach(() => { invalidate(); localStorage.clear(); jest.clearAllMocks(); });

test('volver a Productos antes de 60 segundos no vuelve a pedir la lista', async () => {
  api.get.mockImplementation(async (url) => url === '/productos' ? [{ id: 7, tipo: 'iphone', tracking: [], valor: {}, detalle: {} }] : []);
  render(<Productos />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/ultimas'));
  api.get.mockClear();
  await act(async () => {
    window.dispatchEvent(new CustomEvent('app-view-activated', { detail: { view: 'productos' } }));
  });
  expect(api.get.mock.calls.filter(([url]) => url === '/productos')).toHaveLength(0);
  expect(api.get.mock.calls.filter(([url]) => url.startsWith('/ventas/'))).toHaveLength(0);
});

test('un evento de devolución o costo actualizado recarga ventas y resumen sin recargar la página', async () => {
  localStorage.clear();
  const producto = { id: 7, tipo: 'iphone', detalle: { numero: '15' }, valor: {}, tracking: [] };
  api.get.mockImplementation(async (url) => {
    if (url === '/productos') return [producto];
    if (url.startsWith('/productos/resumen')) return { total: 1, disponible: 1 };
    return [];
  });
  render(<Productos />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/productos'));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/ultimas'));
  api.get.mockClear();
  act(() => notifySalesChanged({ action: 'return', ventaId: 30 }));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/productos/resumen?refresh=true'));
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/ultimas'));
  expect(api.get).toHaveBeenCalledWith('/productos');
  localStorage.clear();
});

test('una venta anulada desaparece de inmediato y el producto vuelve a estar disponible', async () => {
  localStorage.clear();
  const producto = { id: 7, tipo: 'iphone', detalle: { numero: '15' }, valor: {}, tracking: [] };
  let ventas = [{ id: 30, productoId: 7, fechaVenta: '2026-05-10', precioVenta: 3000 }];
  api.get.mockImplementation(async (url) => {
    if (url === '/productos') return [producto];
    if (url.startsWith('/productos/resumen')) return { total: 1, disponible: 0 };
    if (url === '/ventas/ultimas') return ventas;
    return [];
  });
  render(<Productos />);
  const cacheVentas = () => {
    const key = Object.keys(localStorage).find((k) => k.startsWith('productos:cache'));
    return key ? JSON.parse(localStorage.getItem(key)).ventasMap : null;
  };
  await waitFor(() => expect(cacheVentas()[7]).toBeTruthy());
  ventas = [];
  act(() => notifySalesChanged({ action: 'cancel', anulada: true, ventaId: 30, productoId: 7 }));
  // La caché se reescribe al instante sin la venta, antes de recargar desde el servidor.
  expect(cacheVentas()).toEqual(expect.not.objectContaining({ 7: expect.anything() }));
  expect(cacheVentas()).not.toBeNull();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/productos/resumen?refresh=true'));
  localStorage.clear();
});

test('la papelera borra definitivamente, sin ofrecer archivar, y refresca ventas, Gastos e Inventario', async () => {
  localStorage.clear();
  const producto = { id: 7, tipo: 'iphone', detalle: { numero: '15' }, valor: {}, tracking: [] };
  let borrado = false;
  api.get.mockImplementation(async (url) => {
    if (url === '/productos') return borrado ? [] : [producto];
    if (url.startsWith('/productos/resumen')) return { total: 1, disponible: 0 };
    if (url === '/ventas/ultimas') return borrado ? [] : [{ id: 30, productoId: 7, fechaVenta: '2026-05-10', precioVenta: 3000 }];
    return [];
  });
  api.del.mockImplementation(async () => { borrado = true; return { productoId: 7, ventas: 1 }; });
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn();
  const eventos = [];
  const escuchar = (e) => eventos.push(e.detail);
  window.addEventListener('ventas-updated', escuchar);
  const { findAllByLabelText, queryAllByLabelText } = render(<Productos />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/ultimas'));
  const [borrar] = await findAllByLabelText(/^Borrar MS-/);
  await act(async () => { borrar.click(); });
  window.removeEventListener('ventas-updated', escuchar);
  expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/Eliminar definitivamente[\s\S]*registros asociados[\s\S]*no se puede deshacer/));
  expect(api.del).toHaveBeenCalledWith('/productos/7');
  expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('/archivar'), expect.anything());
  expect(window.prompt).not.toHaveBeenCalled();
  expect(eventos).toEqual([expect.objectContaining({ productoId: 7, anulada: true })]);
  await waitFor(() => expect(queryAllByLabelText(/^Borrar MS-/)).toHaveLength(0));
  localStorage.clear();
});

test('si el borrado falla muestra el error y no archiva', async () => {
  localStorage.clear();
  api.get.mockImplementation(async (url) => url === '/productos' ? [{ id: 8, tipo: 'iphone', detalle: {}, valor: {}, tracking: [] }] : []);
  api.del.mockRejectedValue(new Error('HTTP 500 - fallo'));
  window.confirm = jest.fn(() => true);
  window.alert = jest.fn();
  const { findAllByLabelText } = render(<Productos />);
  const [borrar] = await findAllByLabelText(/^Borrar MS-/);
  await act(async () => { borrar.click(); });
  expect(window.alert).toHaveBeenCalledWith('HTTP 500 - fallo');
  expect(api.post).not.toHaveBeenCalledWith(expect.stringContaining('/archivar'), expect.anything());
});
