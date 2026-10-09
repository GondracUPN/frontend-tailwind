import React, { useCallback, useEffect, useState } from 'react';
import { FiArrowLeft, FiRefreshCw } from 'react-icons/fi';
import SalesProjection from '../components/analytics/SalesProjection';
import { getAnalyticsSummary, invalidateAnalyticsCache } from '../services/analytics';

export default function Proyeccion({ setVista }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sellerFilter, setSellerFilter] = useState('');
  const refresh = useCallback(() => {
    invalidateAnalyticsCache();
    setRefreshKey((key) => key + 1);
  }, []);

  useEffect(() => {
    const onActivated = (event) => { if (event?.detail?.view === 'proyeccion') refresh(); };
    window.addEventListener('ventas-updated', refresh);
    window.addEventListener('productos-updated', refresh);
    window.addEventListener('app-view-activated', onActivated);
    return () => {
      window.removeEventListener('ventas-updated', refresh);
      window.removeEventListener('productos-updated', refresh);
      window.removeEventListener('app-view-activated', onActivated);
    };
  }, [refresh]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    getAnalyticsSummary(sellerFilter ? { vendedor: sellerFilter } : {}).then((result) => { if (alive) setData(result); })
      .catch((failure) => { if (alive) setError(failure?.message || 'No se pudo cargar el historial.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [refreshKey, sellerFilter]);

  return <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <button type="button" onClick={() => setVista('home')} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"><FiArrowLeft /> Inicio</button>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Proyección</h1>
        <p className="mt-1 text-sm text-slate-600">Evolución económica y previsión de cierre mensual.</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-600" htmlFor="proyeccion-vendedor">Vendedor</label>
        <select id="proyeccion-vendedor" value={sellerFilter} onChange={(event) => setSellerFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
          <option value="">Todos</option>
          <option value="Gonzalo">Gonzalo</option>
          <option value="Renato">Renato</option>
        </select>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"><FiRefreshCw /> Actualizar</button>
      </div>
    </div>
    <SalesProjection salesRows={data?.sales?.perMonth || []} purchases={data?.comprasPeriodo || []} error={error} loading={loading} />
  </div>;
}
