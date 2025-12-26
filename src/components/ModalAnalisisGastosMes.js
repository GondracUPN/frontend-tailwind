import React, { useMemo, useState } from 'react';

// Modal sencillo: totales de credito y saldo debito por mes
export default function ModalAnalisisGastosMes({ rows = [], onClose, onFullAnalysis }) {
  const today = new Date();
  const ymToday = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const months = useMemo(() => {
    const set = new Set([ymToday]);
    rows.forEach((r) => {
      const f = (r.fecha || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(f)) set.add(f);
    });
    return Array.from(set).sort().reverse(); // mas reciente primero
  }, [rows, ymToday]);

  const [month, setMonth] = useState(months[0] || ymToday);

  const filtered = useMemo(() => rows.filter((r) => (r.fecha || '').startsWith(month)), [rows, month]);

  // Totales de credito por moneda
  const credito = useMemo(() => {
    let pen = 0;
    let usd = 0;
    for (const r of filtered) {
      if (r.metodoPago !== 'credito') continue;
      const monto = Number(r.monto) || 0;
      if (r.moneda === 'USD') usd += monto; else pen += monto;
    }
    return { pen, usd };
  }, [filtered]);

  // Saldo neto de debito en el mes (ingresos positivos, egresos negativos)
  const debito = useMemo(() => {
    let pen = 0;
    let usd = 0;
    for (const r of filtered) {
      if (r.metodoPago !== 'debito') continue;
      const monto = Number(r.monto) || 0;
      const esIngreso = String(r.concepto || '').toLowerCase() === 'ingreso';
      const sign = esIngreso ? 1 : -1;
      if (r.moneda === 'USD') usd += sign * monto; else pen += sign * monto;
    }
    return { pen, usd };
  }, [filtered]);

  const fmt = (amount, currency) => {
    const n = Number(amount) || 0;
    const symbol = currency === 'USD' ? '$' : 'S/';
    return `${symbol} ${n.toFixed(2)}`;
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">Analisis de gastos</h2>
            <p className="text-sm text-gray-500">Credito gastado y saldo neto de debito para el mes seleccionado.</p>
          </div>
          <div className="flex items-center gap-2">
            {onFullAnalysis && (
              <button
                onClick={() => {
                  if (onClose) onClose();
                  onFullAnalysis();
                }}
                className="px-3 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              >
                Analisis mas completo
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200"
              aria-label="Cerrar"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-5">
          <label className="text-sm text-gray-700 flex items-center gap-2">
            Mes
            <select
              className="border rounded-lg px-3 py-2 text-sm"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </label>
          <span className="text-xs text-gray-500">Mostrando {filtered.length} movimientos</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
            <div className="text-sm text-indigo-700 font-semibold mb-1">Gastos de credito</div>
            <p className="text-2xl font-bold text-indigo-900">{fmt(credito.pen + credito.usd * 3.7, 'PEN')}</p>
            <div className="text-xs text-indigo-800 mt-1">
              S/ {credito.pen.toFixed(2)} | $ {credito.usd.toFixed(2)} (TC ref. 3.7 para total)
            </div>
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="text-sm text-emerald-700 font-semibold mb-1">Saldo neto desde debito</div>
            <p className="text-2xl font-bold text-emerald-900">{fmt(debito.pen + debito.usd * 3.7, 'PEN')}</p>
            <div className="text-xs text-emerald-800 mt-1">
              S/ {debito.pen.toFixed(2)} | $ {debito.usd.toFixed(2)} (ingresos - egresos del mes)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
