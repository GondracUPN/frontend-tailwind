import React, { useEffect } from 'react';
import api from '../api';

function Home({ setVista, setAnalisisBack }) {
  useEffect(() => {
    const cacheKey = 'productos:lastList:v1';
    const prefetch = async () => {
      try {
        const rawTs = localStorage.getItem(`${cacheKey}:ts`);
        const freshMs = 60000; // 60s para mantenerlo caliente
        const isFresh = rawTs && (Date.now() - Number(rawTs)) < freshMs;
        if (isFresh) return;
        const data = await api.get('/productos');
        const lista = Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
        localStorage.setItem(cacheKey, JSON.stringify(lista));
        localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
      } catch {}
    };
    if ('requestIdleCallback' in window) {
      // @ts-ignore
      window.requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 500);
    }
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
      </div>
    </div>
  );
}

export default Home;
