import { render, waitFor } from '@testing-library/react';
import api from '../api';
import Productos from './Productos';
import { invalidate } from '../services/productosStore';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), del: jest.fn() } }));

const DELAY_MS = 100;

beforeEach(() => { invalidate(); localStorage.clear(); jest.clearAllMocks(); });

// Mide la carga inicial con una API simulada de latencia fija: cuántas peticiones
// salen y cuántas "rondas" en serie hacen falta antes de tener ventas y resumen.
test('la carga inicial pide productos, ventas, adelantos y resumen en paralelo', async () => {
  const started = [];
  const t0 = Date.now();
  api.get.mockImplementation((url) => {
    started.push({ url, at: Date.now() - t0 });
    return new Promise((resolve) => setTimeout(() => {
      if (url === '/productos') resolve([{ id: 7, tipo: 'iphone', tracking: [], valor: {}, detalle: {} }]);
      else if (url.startsWith('/productos/resumen')) resolve({ total: 1 });
      else resolve([]);
    }, DELAY_MS));
  });
  render(<Productos />);
  await waitFor(() => expect(started.some((r) => r.url === '/ventas/ultimas')).toBe(true));
  await waitFor(() => expect(started.some((r) => r.url.startsWith('/productos/resumen'))).toBe(true));
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS * 3));
  const firstStart = (prefix) => Math.min(...started.filter((r) => r.url.startsWith(prefix)).map((r) => r.at));
  const report = {
    requests: started.length,
    productos: firstStart('/productos'),
    resumen: firstStart('/productos/resumen'),
    ventas: firstStart('/ventas/ultimas'),
    adelantos: firstStart('/ventas/adelantos/ultimos'),
    urls: started.map((r) => `${r.at}ms ${r.url}`),
  };
  // eslint-disable-next-line no-console
  console.log('[carga inicial Productos]', JSON.stringify(report, null, 1));
  // Ninguna espera a que llegue /productos (antes empezaban tras ~1 ronda).
  expect(report.ventas - report.productos).toBeLessThan(DELAY_MS / 2);
  expect(report.adelantos - report.productos).toBeLessThan(DELAY_MS / 2);
  expect(report.resumen - report.productos).toBeLessThan(DELAY_MS / 2);
  expect(started.filter((r) => r.url === '/ventas/ultimas')).toHaveLength(1);
  expect(started.filter((r) => r.url === '/productos/resumen')).toHaveLength(1);
});
