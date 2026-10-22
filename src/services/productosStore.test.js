import api from '../api';
import { getProductos, invalidate } from './productosStore';

jest.mock('../api', () => ({ get: jest.fn() }));
beforeEach(() => { localStorage.clear(); invalidate(); jest.clearAllMocks(); });

test('comparte una peticion en vuelo y reutiliza los productos dentro de maxAge', async () => {
  let resolve;
  api.get.mockImplementation(() => new Promise((done) => { resolve = done; }));
  const a = getProductos();
  const b = getProductos();
  expect(a).toBe(b);
  resolve([{ id: 7 }]);
  await a;
  expect(await getProductos({ maxAgeMs: 60_000 })).toEqual([{ id: 7 }]);
  expect(api.get).toHaveBeenCalledTimes(1);
});

test('revalida al caducar o al recibir productos-updated', async () => {
  api.get.mockResolvedValue([{ id: 7 }]);
  await getProductos();
  await getProductos({ maxAgeMs: 0 });
  window.dispatchEvent(new Event('productos-updated'));
  await getProductos();
  expect(api.get).toHaveBeenCalledTimes(3);
});

test('un cambio de sesion no reutiliza los productos anteriores', async () => {
  api.get.mockResolvedValueOnce([{ id: 7 }]).mockResolvedValueOnce([{ id: 8 }]);
  await getProductos();
  localStorage.setItem('token', 'otra-sesion-de-prueba');
  window.dispatchEvent(new Event('auth:changed'));
  expect(await getProductos()).toEqual([{ id: 8 }]);
});

test('descarta la lectura que termino despues de invalidar', async () => {
  let finishOld;
  api.get.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }))
    .mockResolvedValueOnce([{ id: 8 }]);
  const old = getProductos();
  invalidate();
  expect(await getProductos()).toEqual([{ id: 8 }]);
  finishOld([{ id: 7 }]);
  expect(await old).toEqual([{ id: 8 }]);
});
