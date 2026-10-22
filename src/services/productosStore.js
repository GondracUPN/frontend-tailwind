import api from '../api';

let productos = null;
let timestamp = 0;
let inFlight = null;
let generation = 0;
let token = localStorage.getItem('token');
const listeners = new Set();
export const subscribeProductos = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export function invalidate() {
  generation++;
  timestamp = 0;
  inFlight = null;
  try { localStorage.removeItem('productos:cache:v2'); } catch {}
}
export function getProductos({ maxAgeMs = 60_000 } = {}) {
  const currentToken = localStorage.getItem('token');
  if (token !== currentToken) { token = currentToken; productos = null; invalidate(); }
  if (productos && timestamp && Date.now() - timestamp < maxAgeMs) return Promise.resolve(productos);
  if (inFlight) return inFlight;
  const startedGeneration = generation;
  const promise = api.get('/productos').then((data) => {
    if (startedGeneration !== generation) return getProductos({ maxAgeMs });
    productos = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
    timestamp = Date.now();
    listeners.forEach((listener) => listener(productos));
    return productos;
  }).finally(() => { if (inFlight === promise) inFlight = null; });
  inFlight = promise;
  return promise;
}
if (typeof window !== 'undefined') {
  window.addEventListener('productos-updated', invalidate);
  ['auth:expired', 'auth:changed', 'auth:login', 'auth:logout'].forEach((event) => window.addEventListener(event, () => { productos = null; invalidate(); }));
  window.addEventListener('storage', (event) => { if (!event.key || ['token', 'user'].includes(event.key)) { productos = null; invalidate(); } });
}
