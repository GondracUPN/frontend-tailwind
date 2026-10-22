import api, { clearApiCache } from './api';

const response = (data) => ({ ok: true, headers: { get: () => 'application/json' }, json: async () => data });
const originalFetch = global.fetch;
beforeEach(() => { localStorage.clear(); clearApiCache(); global.fetch = jest.fn(); });
afterAll(() => { global.fetch = originalFetch; });

test('deduplica GET y conserva respuestas solo con TTL opcional', async () => {
  global.fetch.mockResolvedValue(response([1]));
  const a = api.get('/prueba', { maxAgeMs: 60_000 });
  const b = api.get('/prueba', { maxAgeMs: 60_000 });
  expect(a).toBe(b);
  await a;
  expect(await api.get('/prueba', { maxAgeMs: 60_000 })).toEqual([1]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
  await api.get('/prueba');
  expect(global.fetch).toHaveBeenCalledTimes(2);
});

test('borra cache al cerrar sesion y separa usuarios', async () => {
  global.fetch.mockResolvedValue(response([1]));
  localStorage.setItem('token', 'sesion-prueba-a');
  await api.get('/prueba', { maxAgeMs: 60_000 });
  window.dispatchEvent(new Event('auth:expired'));
  await api.get('/prueba', { maxAgeMs: 60_000 });
  localStorage.setItem('token', 'sesion-prueba-b');
  await api.get('/prueba', { maxAgeMs: 60_000 });
  expect(global.fetch).toHaveBeenCalledTimes(3);
});

test('el TTL opcional caduca en milisegundos', async () => {
  let now = 1000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  global.fetch.mockResolvedValue(response([1]));
  try {
    await api.get('/prueba', { maxAgeMs: 100 });
    now += 101;
    await api.get('/prueba', { maxAgeMs: 100 });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  } finally { clock.mockRestore(); }
});

test('AbortSignal cancela una peticion sin cancelar a otro consumidor', async () => {
  global.fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('abortada')));
  }));
  const controller = new AbortController();
  const pending = api.get('/prueba', { signal: controller.signal });
  controller.abort();
  await expect(pending).rejects.toThrow('abortada');
});

test('el timeout configurable aborta una respuesta bloqueada', async () => {
  jest.useFakeTimers();
  global.fetch.mockImplementation((_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('timeout')));
  }));
  const pending = api.get('/lento', { timeoutMs: 50 });
  const assertion = expect(pending).rejects.toThrow('timeout');
  jest.advanceTimersByTime(50);
  await assertion;
  jest.useRealTimers();
});
