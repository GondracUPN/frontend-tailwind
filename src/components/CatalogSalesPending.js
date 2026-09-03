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
  const [exchangeRates, setExchangeRates] = useState({});

  const refresh = useCallback(async () => {
    try {
      const rows = await api.get('/integrations/catalog-sales/pending');
      setItems(Array.isArray(rows) ? rows : []);
      setExchangeRates((current) => {
        const next = { ...current };
        for (const event of Array.isArray(rows) ? rows : []) {
          if (next[event.id] === undefined) {
            const received = Number(event.exchangeRate);
            next[event.id] = Number.isFinite(received) && received > 0 ? String(received) : '';
          }
        }
        return next;
      });
      setError('');
    } catch (err) {
      setError('No se pudieron consultar las ventas enviadas por el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const act = async (event, action) => {
    const isCancellation = event.eventType === 'sale.cancelled';
    const exchangeRate = Number(exchangeRates[event.id]);
    if (action === 'confirm' && !isCancellation && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      alert('Ingresa un tipo de cambio válido.');
      return;
    }
    const message = action === 'confirm'
      ? isCancellation
        ? `¿Confirmar la anulación de la venta ${event.sku}? Esto eliminará la venta de Servicios y restaurará su stock.`
        : `¿Confirmar la venta ${event.sku} por S/ ${Number(event.amount).toFixed(2)} con tipo de cambio ${exchangeRate.toFixed(4)}?`
      : `¿Rechazar esta ${isCancellation ? 'anulación' : 'venta'}?`;
    if (!window.confirm(message)) return;
    setBusyId(event.id);
    try {
      await api.post(
        `/integrations/catalog-sales/${event.id}/${action}`,
        action === 'confirm' && !isCancellation ? { exchangeRate } : {},
      );
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

  const saveExchangeRate = async (event) => {
    const exchangeRate = Number(exchangeRates[event.id]);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      alert('Ingresa un tipo de cambio válido.');
      return;
    }
    setBusyId(event.id);
    try {
      await api.post(`/integrations/catalog-sales/${event.id}/exchange-rate`, { exchangeRate });
      await refresh();
      alert('Tipo de cambio guardado. Ya puedes confirmar la venta.');
    } catch (err) {
      alert(err?.message || 'No se pudo guardar el tipo de cambio.');
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
        <button type="button" onClick={refresh} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition active:translate-y-px active:scale-[0.98] active:bg-amber-100">
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
                  <td className="p-3">
                    {event.eventType === 'sale.created' ? (
                      <input
                        aria-label={`Tipo de cambio para ${event.sku}`}
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={exchangeRates[event.id] ?? ''}
                        onChange={(changeEvent) => setExchangeRates((current) => ({
                          ...current,
                          [event.id]: changeEvent.target.value,
                        }))}
                        className="w-28 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-slate-900"
                        placeholder="Ej: 3.75"
                      />
                    ) : '-'}
                  </td>
                  <td className="p-3">{new Date(event.soldAt).toLocaleDateString('es-PE')}</td>
                  <td className="p-3" title={event.error || ''}>{statusLabel(event.status)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyId === event.id}
                        onClick={() => act(event, 'confirm')}
                        className={`rounded-lg px-3 py-1.5 font-medium text-white shadow-sm transition active:translate-y-px active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${event.eventType === 'sale.cancelled' ? 'bg-red-600 active:bg-red-800' : 'bg-emerald-600 active:bg-emerald-800'}`}
                      >
                        {busyId === event.id ? 'Procesando...' : event.eventType === 'sale.cancelled' ? 'Confirmar anulación' : 'Confirmar venta'}
                      </button>
                      {event.eventType !== 'sale.cancelled' && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === event.id}
                            onClick={() => act(event, 'reject')}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 shadow-sm transition active:translate-y-px active:scale-[0.97] active:bg-slate-200 disabled:cursor-wait disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === event.id || !(Number(exchangeRates[event.id]) > 0)}
                            onClick={() => saveExchangeRate(event)}
                            className="rounded-lg border border-blue-500 px-3 py-1.5 font-medium text-blue-700 shadow-sm transition active:translate-y-px active:scale-[0.97] active:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Poner tipo de cambio
                          </button>
                        </>
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
