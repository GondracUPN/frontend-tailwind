import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import { notifySalesChanged } from '../utils/salesSync';

const eventLabel = (event) => event.eventType === 'sale.cancelled' ? 'Anulación' : 'Venta';
const statusLabel = (status) => ({
  pending_confirmation: 'Pendiente de confirmar',
  pending_cancellation_confirmation: 'Anulación pendiente',
  failed: 'Requiere revisión',
}[status] || status);

export default function CatalogSalesPending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const rows = await api.get('/integrations/catalog-sales/pending');
      setItems(Array.isArray(rows) ? rows : []);
      setError('');
    } catch (err) {
      setError('No se pudieron consultar las ventas enviadas por el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = async (event, action) => {
    const isCancellation = event.eventType === 'sale.cancelled';
    const message = action === 'confirm'
      ? isCancellation
        ? `¿Confirmar la anulación de la venta ${event.sku}? Esto eliminará la venta de Servicios y restaurará su stock.`
        : `¿Confirmar la venta ${event.sku} por S/ ${Number(event.amount).toFixed(2)}?`
      : `¿Rechazar esta ${isCancellation ? 'anulación' : 'venta'}?`;
    if (!window.confirm(message)) return;
    setBusyId(event.id);
    try {
      await api.post(`/integrations/catalog-sales/${event.id}/${action}`, {});
      await refresh();
      notifySalesChanged({ source: 'catalog-sync', action, sku: event.sku });
      window.dispatchEvent(new Event('productos-updated'));
    } catch (err) {
      alert(err?.message || 'No se pudo completar la operación.');
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  if (!loading && !items.length && !error) return null;

  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-amber-950">Ventas recibidas del catálogo</h3>
          <p className="text-sm text-amber-800">Nada se registra ni se anula en Servicios hasta que lo confirmes aquí.</p>
        </div>
        <button type="button" onClick={refresh} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900">
          Actualizar
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-amber-800">Consultando pendientes...</p>
      ) : items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/70 text-left text-amber-950">
              <tr>
                <th className="p-3">Operación</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Monto</th>
                <th className="p-3">T. cambio</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr key={event.id} className="border-t border-amber-100">
                  <td className="p-3 font-medium">{eventLabel(event)}</td>
                  <td className="p-3">{event.sku}</td>
                  <td className="p-3">S/ {Number(event.amount).toFixed(2)}</td>
                  <td className="p-3">{Number(event.exchangeRate).toFixed(4)}</td>
                  <td className="p-3">{new Date(event.soldAt).toLocaleDateString('es-PE')}</td>
                  <td className="p-3" title={event.error || ''}>{statusLabel(event.status)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === event.id}
                        onClick={() => act(event, 'confirm')}
                        className={`rounded-lg px-3 py-1.5 font-medium text-white disabled:opacity-50 ${event.eventType === 'sale.cancelled' ? 'bg-red-600' : 'bg-emerald-600'}`}
                      >
                        {busyId === event.id ? 'Procesando...' : event.eventType === 'sale.cancelled' ? 'Confirmar anulación' : 'Confirmar venta'}
                      </button>
                      {event.eventType !== 'sale.cancelled' && (
                        <button
                          type="button"
                          disabled={busyId === event.id}
                          onClick={() => act(event, 'reject')}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
