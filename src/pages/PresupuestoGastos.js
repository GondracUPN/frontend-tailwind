import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

// Vista de presupuesto mensual de gastos, limitada al usuario autenticado
export default function PresupuestoGastos({ setVista }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

  // Presupuesto guardado por usuario en localStorage
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);
  // Clave por usuario y mes: se reinicia cada mes
  const budgetKey = useMemo(() => `gastos:budget:${user?.id || 'anon'}:${month}`, [user?.id, month]);
  const [budget, setBudget] = useState(() => {
    try {
      const raw = localStorage.getItem(budgetKey);
      return raw ? Number(raw) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setErr('');
        const token = localStorage.getItem('token') || '';
        const res = await fetch(`${API_URL}/gastos`, {
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        if (!res.ok) throw new Error(`GET /gastos -> ${await res.text()}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[PresupuestoGastos] load error', e);
        setErr('No se pudieron cargar los gastos.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(budgetKey, String(budget || 0));
    } catch {}
  }, [budget, budgetKey]);

  const gastosMes = useMemo(
    () =>
      rows.filter(
        (r) =>
          (r.fecha || '').startsWith(month) &&
          String(r.concepto || '').toLowerCase() !== 'ingreso' &&
          !['inversion', 'pago_envios', 'pago_tarjeta'].includes(String(r.concepto || '').toLowerCase()),
      ),
    [rows, month],
  );

  const toPen = (r) => {
    const monto = Number(r.monto) || 0;
    return r.moneda === 'USD' ? monto * 3.7 : monto;
  };

  const totalMesPen = gastosMes.reduce((sum, r) => sum + toPen(r), 0);
  const remaining = (budget || 0) - totalMesPen;
  const remainingPct = budget ? Math.max(0, (remaining / budget) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Presupuesto de gastos</h1>
            <p className="text-sm text-gray-600">Solo tus gastos, con control mensual.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              Mes
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            {typeof setVista === 'function' && (
              <button
                onClick={() => setVista('gastos')}
                className="px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-100 shadow-sm"
              >
                Volver
              </button>
            )}
          </div>
        </div>

        {err && <div className="text-sm text-red-600">{err}</div>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Presupuesto mensual</div>
            <input
              type="number"
              className="mt-2 w-full border rounded px-3 py-2"
              value={budget}
              min="0"
              onChange={(e) => setBudget(Number(e.target.value) || 0)}
            />
            <div className="text-xs text-gray-500 mt-1">Se guarda por usuario y mes.</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Gastado en el mes</div>
            <div className="text-2xl font-semibold mt-1">S/ {totalMesPen.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">{gastosMes.length} movimientos</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Restante</div>
            <div className={`text-2xl font-semibold mt-1 ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
              S/ {remaining.toFixed(2)}
            </div>
            <div className="mt-2 h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${remaining < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(100, 100 - remainingPct)}%` }}
              />
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {budget ? `${remainingPct.toFixed(1)}% del presupuesto disponible` : 'Define un presupuesto para ver el avance.'}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border shadow-sm p-4">
          <h3 className="font-semibold mb-3">Movimientos del mes</h3>
          {loading ? (
            <div className="text-sm text-gray-600">Cargando...</div>
          ) : gastosMes.length === 0 ? (
            <div className="text-sm text-gray-500">No hay gastos registrados este mes.</div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-left">Detalle</th>
                    <th className="p-2 text-right">Monto (S/)</th>
                  </tr>
                </thead>
                <tbody>
                  {gastosMes.map((r) => (
                    <tr key={r.id || `${r.fecha}-${r.monto}`} className="border-t">
                      <td className="p-2">{(r.fecha || '').slice(0, 10)}</td>
                      <td className="p-2 capitalize">{String(r.concepto || '').replace(/_/g, ' ')}</td>
                      <td className="p-2 text-gray-700">{r.notas || '-'}</td>
                      <td className="p-2 text-right font-semibold">S/ {toPen(r).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
