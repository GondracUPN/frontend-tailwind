import { render, waitFor } from '@testing-library/react';
import GastosPanel from './GastosPanel';
import api from '../api';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

test('abre Gastos con seis peticiones y un solo resumen para varias reservas', async () => {
  localStorage.clear();
  localStorage.setItem('token', 'sesion-prueba');
  localStorage.setItem('user', JSON.stringify({ id: 2, username: 'renato', role: 'user' }));
  api.get.mockImplementation(async (path) => {
    if (path === '/gastos') return [20, 21, 22].map((id) => ({
      id, fecha: '2026-10-01', monto: '10', moneda: 'PEN', metodoPago: 'debito',
      concepto: 'ingreso', notas: `__SALE_ADVANCE__:${id}:0`,
    }));
    if (path === '/wallet') return { efectivoPen: 0, efectivoUsd: 0 };
    return [];
  });
  api.post.mockResolvedValue([20, 21, 22].map((id) => ({ id, precio: 100, cobrado: 10, falta: 90, pagos: [] })));
  render(<GastosPanel />);
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas/adelantos/resumen', { ids: [20, 21, 22] }));
  expect(api.get).toHaveBeenCalledTimes(5);
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.get.mock.calls.some(([path]) => /^\/ventas\/adelanto\/\d+/.test(path))).toBe(false);
  localStorage.clear();
});
