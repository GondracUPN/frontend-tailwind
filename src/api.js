// src/api.js
const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE || 'http://localhost:3001';
const inflightGets = new Map();
const cachedGets = new Map();
let generation = 0;
let sessionToken = localStorage.getItem('token');
export function clearApiCache() {
  generation++;
  cachedGets.clear();
  inflightGets.clear();
}
function checkSession() {
  const token = localStorage.getItem('token');
  if (token !== sessionToken) { sessionToken = token; clearApiCache(); }
  return token;
}
if (typeof window !== 'undefined') {
  ['auth:expired', 'auth:changed', 'auth:login', 'auth:logout', 'ventas-updated', 'productos-updated', 'gastos:changed'].forEach((event) => window.addEventListener(event, clearApiCache));
  window.addEventListener('storage', (event) => { if (!event.key || ['token', 'user'].includes(event.key)) clearApiCache(); });
}

async function request(path, opts = {}) {
  const token = checkSession();
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}), // 👈 agrega Bearer
  };

  
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (opts.signal?.aborted) abort();
  opts.signal?.addEventListener('abort', abort, { once: true });
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const timer = timeoutMs > 0 ? setTimeout(abort, timeoutMs) : null;
  try {
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
    signal: controller.signal,
  });

  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login' && localStorage.getItem('token') === token) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth:expired'));
    }
    const txt = await res.text().catch(() => '');
    let detail = txt || '';
    try {
      const parsed = JSON.parse(txt);
      if (Array.isArray(parsed?.message)) detail = parsed.message.join(' | ');
      else if (parsed?.message) detail = String(parsed.message);
      else if (parsed?.error) detail = String(parsed.error);
    } catch {
      // keep raw text
    }
    throw new Error(`HTTP ${res.status} - ${String(detail || '').slice(0, 500)}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? await res.json() : null;
  } finally {
    if (timer) clearTimeout(timer);
    opts.signal?.removeEventListener('abort', abort);
  }
}

async function writeRequest(p, opts) {
  const readOnly = opts.method === 'POST' && ['/ventas/ultimas', '/ventas/adelantos/ultimos', '/ventas/adelantos/resumen'].includes(p);
  if (readOnly) return request(p, opts);
  clearApiCache();
  try { return await request(p, opts); } finally { clearApiCache(); }
}
const api = {
  get:   (p, opts = {})    => {
    const token = checkSession();
    const key = `${token || ''}:${p}:${JSON.stringify(opts.headers || {})}`;
    const cached = cachedGets.get(key);
    if (opts.maxAgeMs > 0 && cached && Date.now() - cached.ts < opts.maxAgeMs) return Promise.resolve(cached.data);
    // Una peticion cancelable no comparte el AbortController de otro consumidor.
    if (opts.signal) return request(p, opts);
    if (inflightGets.has(key)) return inflightGets.get(key);
    const startedGeneration = generation;
    const promise = request(p, opts).then((data) => {
      if (opts.maxAgeMs > 0 && startedGeneration === generation) cachedGets.set(key, { ts: Date.now(), data });
      return data;
    }).finally(() => { if (inflightGets.get(key) === promise) inflightGets.delete(key); });
    inflightGets.set(key, promise);
    return promise;
  },
  post:  (p, b) => writeRequest(p, { method: 'POST', body: JSON.stringify(b) }),
  patch: (p, b) => writeRequest(p, { method: 'PATCH', body: JSON.stringify(b) }),
  put:   (p, b) => writeRequest(p, { method: 'PUT',   body: JSON.stringify(b) }),
  del:   (p, b) => writeRequest(p, { method: 'DELETE', ...(b === undefined ? {} : { body: JSON.stringify(b) }) }),
};

export default api;
export { API_URL };
