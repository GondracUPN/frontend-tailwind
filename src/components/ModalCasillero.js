// src/components/ModalCasillero.js
import React, { useMemo } from 'react';

const fmtUSD = (v) => (isNaN(v) ? '-' : `$ ${Number(v).toFixed(2)}`);
const fmtDate = (d) => {
  if (!d) return '-';
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

// Carga analytics cacheados (prefiere v2, cae a v1 si no existe)
function loadAnalyticsSnapshot() {
  const keys = ['analytics:lastSummary:v2::', 'analytics:lastSummary:v1::'];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return null;
}

// Rango estimado desde fecha de compra hasta llegada a Eshopex.
// Usa el tiempo medio como inicio y suma dos semanas para el techo.
function estimarRangoDesdeCompra(fechaCompra, analytics) {
  if (!fechaCompra) return '-';
  const base = new Date(fechaCompra);
  if (isNaN(base.getTime())) return '-';

  const tramo = analytics?.logistica?.compraARecepcion || {};
  const median = Number(tramo.median || 0);
  const mean = Number(tramo.mean || 0);
  const medio = median > 0 ? median : (mean > 0 ? mean : 14); // medio
  const lower = Math.max(1, medio);
  const upper = lower + 14; // medio + 2 semanas

  const rawMin = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(lower));
  const rawMax = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(upper));
  let d1 = nextTueOrFri(rawMin);
  let d2 = nextTueOrFri(rawMax);
  if (d1.getTime() === d2.getTime()) {
    const bump = new Date(rawMax.getFullYear(), rawMax.getMonth(), rawMax.getDate() + 2);
    d2 = nextTueOrFri(bump);
  }

  const fmt = (d) => d.toLocaleDateString('es-PE', { timeZone: 'UTC' });
  return `${fmt(d1)} al ${fmt(d2)}`;
}

// Rango desde fecha de recepcion hasta entrega.
// Usa un minimo (mas rapido) y el tiempo medio (mediana o mean).
function estimarRangoDesdeRecepcion(fechaRecepcion, transportista, analytics) {
  if (!fechaRecepcion) return '-';
  const base = new Date(fechaRecepcion);
  if (isNaN(base.getTime())) return '-';

  const byCarrier = analytics?.logistica?.tardiasPorTransportista || [];
  const row = byCarrier.find((r) => (r.transportista || '') === (transportista || ''));
  const diasCarrier = row && Number(row.medianDays) > 0 ? Number(row.medianDays) : null;

  const tramo = analytics?.logistica?.recepcionARecogido || {};
  const medio = Math.max(diasCarrier || 0, Number(tramo.median || tramo.mean || 7), 7); // tiempo medio
  const minimo = Math.max(2, medio); // inicio en el medio
  const tope = minimo + 7; // medio + 1 semana

  const rawMin = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(minimo));
  let rawMax = new Date(base.getFullYear(), base.getMonth(), base.getDate() + Math.round(tope));
  let d1 = nextTueOrFri(rawMin);
  let d2 = nextTueOrFri(rawMax);
  if (d1.getTime() === d2.getTime()) {
    rawMax = new Date(rawMax.getFullYear(), rawMax.getMonth(), rawMax.getDate() + 2);
    d2 = nextTueOrFri(rawMax);
  }

  const fmt = (d) => d.toLocaleDateString('es-PE', { timeZone: 'UTC' });
  return `${fmt(d1)} al ${fmt(d2)}`;
}

export default function ModalCasillero({ casillero, productos = [], onClose, onOpenProducto }) {
  const activos = useMemo(() => {
    return (productos || []).filter((p) => {
      const t = p?.tracking?.[0];
      return (t?.casillero || '') === casillero && (t?.estado || '').toLowerCase() !== 'recogido';
    });
  }, [productos, casillero]);
  const decByGrupo = useMemo(() => {
    const map = new Map();
    for (const p of activos) {
      const groupKeyRaw = p?.envioGrupoId ?? p?.envioGrupo ?? p?.envioGrupoID ?? p?.id;
      const key = String(groupKeyRaw ?? p?.id ?? '');
      const decUSD = Number(p?.valor?.valorDec ?? 0);
      if (!key) continue;
      if (!map.has(key) && isFinite(decUSD)) {
        map.set(key, decUSD);
      }
    }
    return map;
  }, [activos]);
  const totalDecUnico = useMemo(() => {
    let total = 0;
    for (const v of decByGrupo.values()) total += v;
    return total;
  }, [decByGrupo]);

  const analytics = useMemo(loadAnalyticsSnapshot, []);

  const estimarFecha = (fechaRecepcion, transportista) =>
    estimarRangoDesdeRecepcion(fechaRecepcion, transportista, analytics);
  const seenDec = new Set();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-4xl rounded-2xl shadow-2xl p-0 relative mx-4 max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b bg-gradient-to-r from-indigo-50 to-white">
          <button
            className="absolute top-4 right-4 text-2xl leading-none text-purple-600 hover:text-purple-800 font-bold"
            onClick={onClose}
            aria-label="Cerrar"
          >
            x
          </button>
          <h2 className="text-xl font-semibold">Casillero: {casillero}</h2>
          <p className="text-sm text-gray-600 mt-1">Productos en camino (activos, no recogidos)</p>
          {/* Resumen */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">Activos: {activos.length}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              DEC total: {fmtUSD(totalDecUnico)}
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
                    <th className="py-2 px-3">Fecha recepcion</th>
                    <th className="py-2 px-3">Transportista</th>
                    <th className="py-2 px-3">ETA</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activos.map((p, idx) => {
                    const v = p?.valor || {};
                    const t = p?.tracking?.[0] || {};
                    const tipo = p?.tipo || '-';
                    const decUSD = Number(v?.valorDec ?? 0);
                    const groupKeyRaw = p?.envioGrupoId ?? p?.envioGrupo ?? p?.envioGrupoID ?? p?.id;
                    const groupKey = String(groupKeyRaw ?? p?.id ?? '');
                    const showDec = groupKey ? !seenDec.has(groupKey) : true;
                    if (groupKey && showDec) seenDec.add(groupKey);
                    const estado = t?.estado || '';
                    const recep = t?.fechaRecepcion || '';
                    const compra = v?.fechaCompra || '';
                    const transp = t?.transportista || '';
                    const eta = recep
                      ? estimarFecha(recep, transp)
                      : estimarRangoDesdeCompra(compra, analytics);

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
                        <td className="py-2 px-3">{showDec ? fmtUSD(decUSD) : '-'}</td>
                        <td className="py-2 px-3">{labelFromEstado(estado)}</td>
                        <td className="py-2 px-3">{compra ? fmtDate(compra) : (<span className="text-red-600">Sin fecha</span>)}</td>
                        <td className="py-2 px-3">{fmtDate(recep)}</td>
                        <td className="py-2 px-3">{transp || '-'}</td>
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
