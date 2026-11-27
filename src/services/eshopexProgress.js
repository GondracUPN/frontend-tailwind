// Un solo sondeo de /tracking/eshopex-carga-progress compartido por App y Productos.
// Antes cada uno abría su propio intervalo de 700 ms y ocupaba conexiones HTTP
// que el navegador limita (unas 6 por servidor en HTTP/1.1).
import api from '../api';

const INTERVAL_MS = 1000;
const listeners = new Set();
let timer = null;
let busy = false;
let last = null;

async function tick() {
  if (busy || (typeof document !== 'undefined' && document.hidden)) return;
  busy = true;
  try {
    const data = await api.get('/tracking/eshopex-carga-progress');
    last = data;
    listeners.forEach((listener) => {
      try { listener(data); } catch { /* ignore */ }
    });
  } catch {
    /* se reintenta en el siguiente tick */
  } finally {
    busy = false;
  }
}

export function subscribeEshopexProgress(listener) {
  listeners.add(listener);
  if (last) {
    try { listener(last); } catch { /* ignore */ }
  }
  if (!timer) {
    tick();
    timer = setInterval(tick, INTERVAL_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = null;
      last = null;
    }
  };
}
