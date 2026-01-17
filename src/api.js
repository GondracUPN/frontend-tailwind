// src/api.js
const API_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE || 'http://localhost:3001';

async function request(path, opts = {}) {
  const token = localStorage.getItem('token'); // 👈 lee el token guardado
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}), // 👈 agrega Bearer
  };

  
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method || 'GET',
    headers,
    body: opts.body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} - ${txt.slice(0, 500)}`);
  }

  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : null;
}

const api = {
  get:   (p)    => request(p),
  post:  (p, b) => request(p, { method: 'POST', body: JSON.stringify(b) }),
  patch: (p, b) => request(p, { method: 'PATCH', body: JSON.stringify(b) }),
  put:   (p, b) => request(p, { method: 'PUT',   body: JSON.stringify(b) }),
  del:   (p)    => request(p, { method: 'DELETE' }),
};

export default api;
export { API_URL };
