import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

const TIPO_CAMBIO = 3.7;

const displayConcepto = (c) => String(c || '').replace(/_/g, ' ');

export default function AnalisisGastos({ setVista }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    const load = async () => {
      try {
        setErr('');
        setLoading(true);
        const token = localStorage.getItem('token') || '';
        const user = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
        const isAdmin = user?.role === 'admin';
        const userIdParam = isAdmin && user?.id ? `?userId=${encodeURIComponent(String(user.id))}` : '';
        const url = isAdmin ? `${API_URL}/gastos/all${userIdParam}` : `${API_URL}/gastos`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
        if (!res.ok) throw new Error(`GET ${url} -> ${await res.text()}`);
        const data = await res.json();
        setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('[AnalisisGastos] load error', e);
        setErr('No se pudo cargar los gastos.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => (r.fecha || '').startsWith(month)), [rows, month]);
  const gastosSolo = useMemo(
    () => filtered.filter((r) => String(r.concepto || '').toLowerCase() !== 'ingreso'),
    [filtered],
  );
  const ingresosSolo = useMemo(
    () => filtered.filter((r) => String(r.concepto || '').toLowerCase() === 'ingreso'),
    [filtered],
  );

  const toPen = (r) => {
    const m = Number(r.monto) || 0;
    return r.moneda === 'USD' ? m * TIPO_CAMBIO : m;
  };

  const totalPen = gastosSolo.reduce((sum, r) => sum + toPen(r), 0);
  const totalIngresosPen = ingresosSolo.reduce((sum, r) => sum + toPen(r), 0);
  const byConcept = gastosSolo.reduce((acc, r) => {
    const key = displayConcepto(r.concepto || 'otros');
    acc[key] = (acc[key] || 0) + toPen(r);
    return acc;
  }, {});
  const byMetodo = gastosSolo.reduce((acc, r) => {
    const key = r.metodoPago || 'otro';
    acc[key] = (acc[key] || 0) + toPen(r);
    return acc;
  }, {});
  const byTarjeta = gastosSolo.reduce((acc, r) => {
    const key = r.tarjeta || r.tarjetaPago || 'N/A';
    acc[key] = (acc[key] || 0) + toPen(r);
    return acc;
  }, {});

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return 30;
    return new Date(y, m, 0).getDate();
  }, [month]);

  const dailyTotals = useMemo(() => {
    const map = new Map();
    gastosSolo.forEach((r) => {
      const d = (r.fecha || '').slice(0, 10);
      map.set(d, (map.get(d) || 0) + toPen(r));
    });
    return Array.from(map.entries())
      .map(([d, v]) => ({ fecha: d, monto: v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [gastosSolo]);
  const spentDays = dailyTotals.length || 1;
  const uniqueDays = spentDays;
  const promedioDia = totalPen / uniqueDays;
  const hoy = new Date();
  const isCurrentMonth = (() => {
    const [y, m] = month.split('-').map(Number);
    return y === hoy.getFullYear() && m === hoy.getMonth() + 1;
  })();
  const remainingDays = isCurrentMonth ? Math.max(0, daysInMonth - hoy.getDate()) : 0;
  const projectedPen = promedioDia * daysInMonth;

  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return '';
    const dt = new Date(y, m - 1, 1);
    dt.setMonth(dt.getMonth() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);
  const prevTotalPen = useMemo(
    () => rows.filter((r) => (r.fecha || '').startsWith(prevMonthKey) && String(r.concepto || '').toLowerCase() !== 'ingreso')
      .reduce((sum, r) => sum + toPen(r), 0),
    [rows, prevMonthKey],
  );
  const variationPct = prevTotalPen ? ((totalPen - prevTotalPen) / prevTotalPen) * 100 : 0;

  const concentration = useMemo(() => {
    const sorted = [...gastosSolo].sort((a, b) => toPen(b) - toPen(a));
    const top3 = sorted.slice(0, 3).reduce((sum, r) => sum + toPen(r), 0);
    const pct = totalPen ? (top3 / totalPen) * 100 : 0;
    return { top3, pct };
  }, [gastosSolo, totalPen]);

  const topGastos = [...gastosSolo]
    .sort((a, b) => toPen(b) - toPen(a))
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      detalle: r.detalleGusto || r.notas || displayConcepto(r.concepto || 'gasto'),
      fecha: r.fecha || '',
      montoPen: toPen(r),
      moneda: r.moneda,
    }));

  const sumValues = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const alertThreshold = 1500;
  const alertConcepts = sumValues(byConcept).filter(([, v]) => v >= alertThreshold);
  const alertTarjetas = sumValues(byTarjeta).filter(([, v]) => v >= alertThreshold);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Analisis de gastos</h1>
            <p className="text-sm text-gray-600">Vista detallada por mes con cortes y sugerencias.</p>
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
            {setVista && (
              <button
                onClick={() => setVista('gastos')}
                className="px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-100 shadow-sm"
              >
                Volver
              </button>
            )}
          </div>
        </div>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}

        {loading ? (
          <div className="text-sm text-gray-600">Cargando analisis...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Total gastado (mes)</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">{gastosSolo.length} movimientos</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Promedio por dia</div>
              <div className="text-2xl font-semibold mt-1">S/ {promedioDia.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">{uniqueDays} dias con movimientos</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Top gasto</div>
              <div className="text-2xl font-semibold mt-1">
                {topGastos[0] ? `S/ ${topGastos[0].montoPen.toFixed(2)}` : 'S/ 0.00'}
              </div>
              <div className="text-xs text-gray-500 mt-1">{topGastos[0]?.detalle || 'Sin datos'}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Proyeccion cierre</div>
              <div className="text-2xl font-semibold mt-1">S/ {projectedPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">{daysInMonth} dias en mes, {remainingDays} dias restantes</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Comparacion vs mes anterior</div>
              <div className="text-2xl font-semibold mt-1">
                {prevTotalPen ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%` : 'Sin datos previos'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Mes previo: S/ {prevTotalPen.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Relacion ingreso / gasto</div>
              <div className="text-2xl font-semibold mt-1">
                {totalIngresosPen ? `${(totalPen / totalIngresosPen).toFixed(2)}x` : 'N/A'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Ingresos: S/ {totalIngresosPen.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Concentracion top 3</div>
              <div className="text-2xl font-semibold mt-1">
                {totalPen ? `${concentration.pct.toFixed(1)}%` : '0.0%'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Top 3 suman S/ {concentration.top3.toFixed(2)}</div>
            </div>
          </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Gastos por concepto</h3>
                  <span className="text-xs text-gray-500">Agrupado</span>
                </div>
                {sumValues(byConcept).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2">
                    {sumValues(byConcept).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{k}</span>
                        <span className="font-semibold">S/ {v.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Gastos por metodo de pago</h3>
                  <span className="text-xs text-gray-500">Debito vs credito</span>
                </div>
                {sumValues(byMetodo).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2">
                    {sumValues(byMetodo).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{k}</span>
                        <span className="font-semibold">S/ {v.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Gastos por tarjeta / banco</h3>
                  <span className="text-xs text-gray-500">Incluye pagos de tarjeta</span>
                </div>
                {sumValues(byTarjeta).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2">
                    {sumValues(byTarjeta).map(([k, v]) => (
                      <li key={k} className="flex items-center justify-between text-sm">
                        <span className="capitalize">{k}</span>
                        <span className="font-semibold">S/ {v.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Top 5 gastos del mes</h3>
                  <span className="text-xs text-gray-500">Mayor a menor</span>
                </div>
                {topGastos.length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2">
                    {topGastos.map((g, idx) => (
                      <li key={g.id ?? idx} className="flex items-center justify-between text-sm">
                        <div className="flex flex-col">
                          <span className="font-semibold">S/ {g.montoPen.toFixed(2)}</span>
                          <span className="text-xs text-gray-600">{g.detalle}</span>
                        </div>
                        <span className="text-xs text-gray-500">{g.fecha}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Gasto por dia</h3>
                  <span className="text-xs text-gray-500">Tendencia del mes</span>
                </div>
                {dailyTotals.length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2 max-h-60 overflow-auto">
                    {dailyTotals.map((d) => (
                      <li key={d.fecha} className="flex items-center justify-between text-sm">
                        <span>{d.fecha}</span>
                        <span className="font-semibold">S/ {d.monto.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">Alertas por umbral</h3>
                  <span className="text-xs text-gray-500">>= S/ {alertThreshold}</span>
                </div>
                {alertConcepts.length === 0 && alertTarjetas.length === 0 ? (
                  <div className="text-sm text-gray-500">Sin alertas.</div>
                ) : (
                  <div className="space-y-3">
                    {alertConcepts.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Conceptos</div>
                        <ul className="space-y-1">
                          {alertConcepts.map(([k, v]) => (
                            <li key={`c-${k}`} className="flex justify-between text-sm">
                              <span className="capitalize">{k}</span>
                              <span className="font-semibold">S/ {v.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {alertTarjetas.length > 0 && (
                      <div>
                        <div className="text-xs text-gray-600 mb-1">Tarjetas/Bancos</div>
                        <ul className="space-y-1">
                          {alertTarjetas.map(([k, v]) => (
                            <li key={`t-${k}`} className="flex justify-between text-sm">
                              <span className="capitalize">{k}</span>
                              <span className="font-semibold">S/ {v.toFixed(2)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
