import React, { useEffect } from 'react';
import api from '../api';

const PRODUCTOS_CACHE_KEY = 'productos:cache:v2';
const PRODUCTOS_CACHE_TTL_MS = 2 * 60 * 1000;

function Home({ setVista, setAnalisisBack }) {
  useEffect(() => {
    let cancelled = false;
    const prefetch = async () => {
      try {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (connection?.saveData || /(^|-)2g$/.test(String(connection?.effectiveType || ''))) return;
        const raw = localStorage.getItem(PRODUCTOS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        const isFresh = parsed?.ts && (Date.now() - Number(parsed.ts)) < PRODUCTOS_CACHE_TTL_MS;
        if (isFresh) return;
        const data = await api.get('/productos');
        if (cancelled) return;
        const lista = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        const prev = raw ? JSON.parse(raw) : {};
        localStorage.setItem(PRODUCTOS_CACHE_KEY, JSON.stringify({ ...prev, productos: lista, ts: Date.now() }));
      } catch {}
    };
    const run = () => { if (!cancelled) prefetch(); };
    let timerId;
    let idleId;
    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 5000 });
    } else {
      timerId = setTimeout(run, 3000);
    }
    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
      if (idleId && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
    };
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 p-6">
      <h1 className="text-4xl font-semibold">MacSomenos Servicios</h1>

      <div className="flex gap-6 flex-wrap justify-center">
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('productos')}
        >
          Productos
        </button>
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => {
            setVista('servicios');
          }}
        >
          Servicios (Admin)
        </button>
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => { setAnalisisBack('home'); setVista('analisis'); }}
        >
          Analisis
        </button>
        <button className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('ganancias')}>
          Ganancias
        </button>
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('gastos')}
        >
          Gastos
        </button>
        <button className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('calculadora')}>
          Calculadora
        </button>
        <button
          className="px-6 py-3 bg-white shadow rounded-2xl border hover:shadow-md hover:border-gray-400 transition text-lg"
          onClick={() => setVista('ebay')}
        >
          Ebay
        </button>
      </div>
    </div>
  );
}

export default Home;
