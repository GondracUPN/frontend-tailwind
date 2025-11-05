// src/components/ModalCasillero.js
import React, { useMemo } from 'react';

const fmtUSD = (v) => (isNaN(v) ? '-' : `$ ${Number(v).toFixed(2)}`);
const fmtDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString('es-PE', { timeZone: 'UTC' });
};

function labelFromEstado(estado) {
  switch ((estado || '').toLowerCase()) {
    case 'comprado_sin_tracking': return 'Sin Tracking';
    case 'comprado_en_camino': return 'En Camino';
    case 'en_eshopex': return 'En Eshopex';
    case 'recogido': return 'Recogido';
    default: return '-';
  }
}

function nextTueOrFri(fromDate) {
  const d = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  while (true) {
    const day = d.getDay(); // 0=Sun..6=Sat
    if (day === 2 || day === 5) return d; // Tue or Fri
    d.setDate(d.getDate() + 1);
  }
}

export default function ModalCasillero({ casillero, productos = [], onClose, onOpenProducto }) {
  const activos = useMemo(() => {
    return (productos || []).filter((p) => {
      const t = p?.tracking?.[0];
      return (t?.casillero || '') === casillero && (t?.estado || '').toLowerCase() !== 'recogido';
    });
  }, [productos, casillero]);

  const analytics = useMemo(() => {
    try {
      const raw = localStorage.getItem('analytics:lastSummary:v1::');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  const estimarDias = (transportista) => {
    const t = (transportista || '').toString();
    const byCarrier = analytics?.logistica?.tardiasPorTransportista || [];
    const row = byCarrier.find((r) => (r.transportista || '') === t);
    if (row && Number(row.medianDays) > 0) return Number(row.medianDays);
    const fallback = analytics?.logistica?.recepcionARecogido;
    if (fallback?.median > 0) return Number(fallback.median);
    if (fallback?.mean > 0) return Number(fallback.mean);
    return 7;
  };

  const estimarFecha = (fechaRecepcion, transportista) => {
    if (!fechaRecepcion) return '—';
    try {
      const base = new Date(fechaRecepcion);
      if (isNaN(base.getTime())) return '—';
      const dias = estimarDias(transportista);
      const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(dias));
      const entrega = nextTueOrFri(target);
      return entrega.toLocaleDateString('es-PE', { timeZone: 'UTC' });
    } catch { return '—'; }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-4xl rounded-2xl shadow-2xl p-0 relative mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>×</button>
          <h2 className="text-xl font-semibold">Casillero: {casillero}</h2>
          <p className="text-sm text-gray-600 mt-1">Productos en camino (activos, no recogidos)</p>
          {/* Resumen */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">Activos: {activos.length}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              DEC total: {fmtUSD(activos.reduce((s, p) => s + (Number(p?.valor?.valorDec ?? 0) || 0), 0))}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 overflow-auto max-h-[calc(90vh-72px)]">
          {!activos.length ? (
            <div className="text-gray-600">No hay productos activos en este casillero.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border rounded-lg overflow-hidden">
                <thead className="bg-gray-50">
                  <tr className="text-left text-gray-600">
                    <th className="py-2 px-3">Producto</th>
                    <th className="py-2 px-3">DEC ($)</th>
                    <th className="py-2 px-3">Estado</th>
                    <th className="py-2 px-3">Fecha compra</th>
                    <th className="py-2 px-3">Fecha recepción</th>
                    <th className="py-2 px-3">Transportista</th>
                    <th className="py-2 px-3">ETA (si en Eshopex)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activos.map((p, idx) => {
                    const v = p?.valor || {};
                    const t = p?.tracking?.[0] || {};
                    const tipo = p?.tipo || '-';
                    const decUSD = Number(v?.valorDec ?? 0);
                    const estado = t?.estado || '';
                    const recep = t?.fechaRecepcion || '';
                    const compra = v?.fechaCompra || '';
                    const transp = t?.transportista || '';
                    const isEshop = (estado || '').toLowerCase() === 'en_eshopex';
                    const eta = isEshop ? estimarFecha(recep, transp) : '—';
                    return (
                      <tr key={p.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                        <td className="py-2 px-3">
                          <button
                            className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                            onClick={() => onOpenProducto && onOpenProducto(p)}
                            title="Ver detalles del producto"
                          >
                            {tipo}
                          </button>
                        </td>
                        <td className="py-2 px-3">{fmtUSD(decUSD)}</td>
                        <td className="py-2 px-3">{labelFromEstado(estado)}</td>
                        <td className="py-2 px-3">{compra ? fmtDate(compra) : (<span className="text-red-600">Sin fecha</span>)}</td>
                        <td className="py-2 px-3">{fmtDate(recep)}</td>
                        <td className="py-2 px-3">{transp || '—'}</td>
                        <td className="py-2 px-3">{eta}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
