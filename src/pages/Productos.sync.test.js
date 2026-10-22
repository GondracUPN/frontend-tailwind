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
