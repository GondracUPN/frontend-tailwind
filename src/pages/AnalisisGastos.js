import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

const TIPO_CAMBIO = 3.7;
const SELLERS = ['gonzalo', 'renato'];
const SPLIT_VENDOR = 'ambos';
const SPLIT_SHARE = 0.5;

const normalizeConcept = (c) => String(c || '').trim().toLowerCase().replace(/\s+/g, '_');
const displayConcepto = (c) => String(c || '').replace(/_/g, ' ');
const sumValues = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
const normalizeSeller = (s) => (s == null ? '' : String(s).trim().toLowerCase());
const shareForSeller = (venta, seller) => {
  const vend = normalizeSeller(venta?.vendedor);
  const target = normalizeSeller(seller);
  if (!vend || !target) return 0;
  if (vend === target) return 1;
  if (vend === SPLIT_VENDOR && SELLERS.includes(target)) return SPLIT_SHARE;
  return 0;
};

const getTipoCambioSplit = (venta, seller) => {
  const slug = normalizeSeller(seller);
  const base = Number(venta?.tipoCambio ?? 0);
  if (slug === 'gonzalo') return Number(venta?.tipoCambioGonzalo ?? base) || base || 0;
  if (slug === 'renato') return Number(venta?.tipoCambioRenato ?? base) || base || 0;
  return base || 0;
};

const splitMetrics = (venta, seller) => {
  const valorUsd = Number(venta?.producto?.valor?.valorProducto ?? 0);
  const envio = Number(
    venta?.producto?.valor?.costoEnvioProrrateado ??
      venta?.producto?.valor?.costoEnvio ??
      0,
  );
  const tc = getTipoCambioSplit(venta, seller);
  const ingreso = Number(venta?.precioVenta ?? 0) / 2;
  const costo = (valorUsd / 2) * tc + (envio / 2);
  const ganancia = ingreso - costo;
  return { ganancia };
};

export default function AnalisisGastos({ setVista }) {
  const [rows, setRows] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showPie, setShowPie] = useState(false);
  const [showPieVida, setShowPieVida] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState('gonzalo');

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
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const gastosUrl = isAdmin ? `${API_URL}/gastos/all${userIdParam}` : `${API_URL}/gastos`;
        const ventasUrl = `${API_URL}/ventas`;

        const [resGastos, resVentas] = await Promise.all([
          fetch(gastosUrl, { headers }),
          fetch(ventasUrl, { headers }),
        ]);
        if (!resGastos.ok) throw new Error(`GET ${gastosUrl} -> ${await resGastos.text()}`);
        if (!resVentas.ok) throw new Error(`GET ${ventasUrl} -> ${await resVentas.text()}`);

        const [dataGastos, dataVentas] = await Promise.all([resGastos.json(), resVentas.json()]);
        setRows(Array.isArray(dataGastos) ? dataGastos : []);
        setVentas(Array.isArray(dataVentas) ? dataVentas : []);
      } catch (e) {
        console.error('[AnalisisGastos] load error', e);
        setErr('No se pudo cargar los gastos y ventas.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => (r.fecha || '').startsWith(month)), [rows, month]);
  const gastosSolo = useMemo(
    () => filtered.filter((r) => {
      const c = normalizeConcept(r.concepto);
      return c !== 'ingreso' && c !== 'pago_tarjeta';
    }),
    [filtered],
  );

  const toPen = (r) => {
    const m = Number(r.monto) || 0;
    return r.moneda === 'USD' ? m * TIPO_CAMBIO : m;
  };

  const totalPen = gastosSolo.reduce((sum, r) => sum + toPen(r), 0);
  const totalDebitoPen = useMemo(
    () => gastosSolo.filter((r) => r.metodoPago === 'debito').reduce((s, r) => s + toPen(r), 0),
    [gastosSolo],
  );
  const totalCreditoPen = useMemo(
    () => gastosSolo.filter((r) => r.metodoPago === 'credito').reduce((s, r) => s + toPen(r), 0),
    [gastosSolo],
  );
  const byConceptCredito = gastosSolo
    .filter((r) => r.metodoPago === 'credito')
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros');
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byConceptDebito = gastosSolo
    .filter((r) => r.metodoPago === 'debito')
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros');
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byTarjeta = gastosSolo
    .filter((r) => r.metodoPago === 'credito')
    .reduce((acc, r) => {
      const key = r.tarjeta || 'N/A';
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byConceptVida = gastosSolo
    .filter((r) => {
      const c = normalizeConcept(r.concepto);
      return c !== 'inversion' && c !== 'pago_envios';
    })
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros');
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});

  const ventasMes = useMemo(
    () =>
      ventas.filter((v) => {
        const fecha = (v.fechaVenta || v.createdAt || '').slice(0, 7);
        return fecha === month;
      }),
    [ventas, month],
  );

  const ingresosPorPersona = useMemo(() => {
    const totales = { gonzalo: 0, renato: 0 };
    ventasMes.forEach((v) => {
      const gananciaBase =
        Number(
          v.ganancia != null
            ? v.ganancia
            : v.precioVenta != null && v.costoTotal != null
              ? Number(v.precioVenta) - Number(v.costoTotal)
              : 0,
        ) || 0;
      SELLERS.forEach((s) => {
        const share = shareForSeller(v, s);
        if (!share) return;
        if (share !== 1) {
          totales[s] += splitMetrics(v, s).ganancia;
          return;
        }
        totales[s] += gananciaBase;
      });
    });
    return totales;
  }, [ventasMes]);

  const ingresoSeleccionado = ingresosPorPersona[selectedPersona] || 0;
  const balanceMes = ingresoSeleccionado - totalPen;

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
  const promedioDia = daysInMonth ? totalPen / daysInMonth : 0;
  const gastosVidaPen = useMemo(
    () =>
      gastosSolo
        .filter((r) => {
          const c = normalizeConcept(r.concepto);
          return c !== 'inversion' && c !== 'pago_envios';
        })
        .reduce((s, r) => s + toPen(r), 0),
    [gastosSolo],
  );
  const gastosVidaMovs = useMemo(
    () =>
      gastosSolo.filter((r) => {
        const c = normalizeConcept(r.concepto);
        return c !== 'inversion' && c !== 'pago_envios';
      }),
    [gastosSolo],
  );

  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return '';
    const dt = new Date(y, m - 1, 1);
    dt.setMonth(dt.getMonth() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);
  const prevTotalPen = useMemo(
    () =>
      rows
        .filter((r) => {
          const c = normalizeConcept(r.concepto);
          return (r.fecha || '').startsWith(prevMonthKey) && c !== 'ingreso' && c !== 'pago_tarjeta';
        })
        .reduce((sum, r) => sum + toPen(r), 0),
    [rows, prevMonthKey],
  );
  const variationPct = prevTotalPen ? ((totalPen - prevTotalPen) / prevTotalPen) * 100 : 0;

  const buildPieData = (map, total) => {
    if (!total) return [];
    const palette = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6', '#a855f7', '#22c55e'];
    return sumValues(map).map(([label, val], idx) => ({
      label,
      pct: (val / total) * 100,
      monto: val,
      color: palette[idx % palette.length],
    }));
  };

  const pieDataDeb = useMemo(() => buildPieData(byConceptDebito, totalDebitoPen), [byConceptDebito, totalDebitoPen]);
  const pieDataCre = useMemo(() => buildPieData(byConceptCredito, totalCreditoPen), [byConceptCredito, totalCreditoPen]);
  const pieDataVida = useMemo(() => buildPieData(byConceptVida, gastosVidaPen), [byConceptVida, gastosVidaPen]);

  const buildGradient = (data) => {
    if (!data.length) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    let acc = 0;
    const stops = data.map(({ pct, color }) => {
      const start = acc;
      const end = acc + pct;
      acc = end;
      return `${color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };

  const pieGradientDeb = useMemo(() => buildGradient(pieDataDeb), [pieDataDeb]);
  const pieGradientCre = useMemo(() => buildGradient(pieDataCre), [pieDataCre]);
  const pieGradientVida = useMemo(() => buildGradient(pieDataVida), [pieDataVida]);
  const balanceVida = ingresoSeleccionado - gastosVidaPen;

  return (
    <>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Total gastado (mes)</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">{gastosSolo.length} movimientos</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Promedio por dia</div>
              <div className="text-2xl font-semibold mt-1">S/ {promedioDia.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">{daysInMonth} dias del mes</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Comparacion vs mes anterior</div>
              <div className="text-2xl font-semibold mt-1">
                {prevTotalPen ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%` : 'Sin datos previos'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Mes previo: S/ {prevTotalPen.toFixed(2)}</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div>
                <div className="text-sm text-gray-500">Balance ingreso - gasto</div>
                <div className="text-xs text-gray-500">Usa ganancia bruta por persona (ventas)</div>
              </div>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {SELLERS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Ganancia bruta</div>
                <div className="text-lg font-semibold text-gray-900">S/ {ingresoSeleccionado.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="text-gray-500">Gasto total</div>
                  <div className="text-lg font-semibold text-gray-900">S/ {totalPen.toFixed(2)}</div>
                </div>
              <div className={`p-3 bg-gray-50 rounded-lg border ${balanceMes >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                <div className="text-gray-500">Resultado</div>
                <div className={`text-lg font-semibold ${balanceMes >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceMes >= 0 ? '+' : '-'}S/ {Math.abs(balanceMes).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div>
                <div className="text-sm text-gray-500">Balance gastos de vida</div>
                <div className="text-xs text-gray-500">Ganancia neta vs gasto vida (sin inversión ni envíos)</div>
              </div>
              <select
                value={selectedPersona}
                onChange={(e) => setSelectedPersona(e.target.value)}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {SELLERS.map((s) => (
                  <option key={`vida-bal-${s}`} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Ganancia neta</div>
                <div className="text-lg font-semibold text-gray-900">S/ {ingresoSeleccionado.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Gasto vida total</div>
                <div className="text-lg font-semibold text-gray-900">S/ {gastosVidaPen.toFixed(2)}</div>
              </div>
              <div className={`p-3 bg-gray-50 rounded-lg border ${balanceVida >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                <div className="text-gray-500">Resultado</div>
                <div className={`text-lg font-semibold ${balanceVida >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceVida >= 0 ? '+' : '-'}S/ {Math.abs(balanceVida).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Gasto débito</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalDebitoPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Ticket prom.: S/ {(totalDebitoPen / Math.max(1, gastosSolo.filter(g=>g.metodoPago==='debito').length)).toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Gasto crédito</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalCreditoPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Ticket prom.: S/ {(totalCreditoPen / Math.max(1, gastosSolo.filter(g=>g.metodoPago==='credito').length)).toFixed(2)}</div>
            </div>
          </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">Gastos por concepto</h3>
                    <span className="text-xs text-gray-500">Credito y debito</span>
                  </div>
                  <button
                    onClick={() => setShowPie(true)}
                    className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Ver grafico
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Credito</div>
                    {sumValues(byConceptCredito).length === 0 ? (
                      <div className="text-sm text-gray-500">Sin datos.</div>
                    ) : (
                      <ul className="space-y-1">
                        {sumValues(byConceptCredito).map(([k, v]) => (
                          <li key={`c-${k}`} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold">S/ {v.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Debito</div>
                    {sumValues(byConceptDebito).length === 0 ? (
                      <div className="text-sm text-gray-500">Sin datos.</div>
                    ) : (
                      <ul className="space-y-1">
                        {sumValues(byConceptDebito).map(([k, v]) => (
                          <li key={`d-${k}`} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold">S/ {v.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">Gastos de vida</h3>
                    <span className="text-xs text-gray-500">Incluye debito y credito (sin inversion ni envios)</span>
                  </div>
                  <button
                    onClick={() => setShowPieVida(true)}
                    className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Ver grafico
                  </button>
                </div>
                {sumValues(byConceptVida).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {sumValues(byConceptVida).map(([k, v]) => (
                      <li key={`vida-${k}`} className="flex items-center justify-between">
                        <span className="capitalize text-gray-800">{k}</span>
                        <span className="font-semibold text-gray-900">S/ {v.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  Movs: {gastosVidaMovs.length} \u00b7 Total S/ {gastosVidaPen.toFixed(2)}
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Gastos por tarjeta / banco</h3>
                <span className="text-xs text-gray-500">Solo tarjetas de credito</span>
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
          </div>

          <div className="grid grid-cols-1 gap-4">
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
          </div>
          </>
        )}
      </div>
    </div>
    {showPie && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-5xl relative">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPie(false)}
          >
            x
          </button>
          <h3 className="text-xl font-semibold mb-2">Gastos por concepto (%)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Distribucion del total gastado en el mes. Incluye montos y porcentajes por concepto.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PieBlock title="Débito" total={totalDebitoPen} data={pieDataDeb} gradient={pieGradientDeb} />
            <PieBlock title="Crédito" total={totalCreditoPen} data={pieDataCre} gradient={pieGradientCre} />
          </div>
        </div>
      </div>
    )}
    {showPieVida && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-3xl relative">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPieVida(false)}
          >
            x
          </button>
          <h3 className="text-xl font-semibold mb-2">Gastos de vida por concepto (%)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Incluye debito y credito (sin inversion ni envios)
          </p>
          <PieBlock title="Gastos de vida" total={gastosVidaPen} data={pieDataVida} gradient={pieGradientVida} />
        </div>
      </div>
    )}
  </>
  );
}

function PieBlock({ title, total, data, gradient }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className="text-sm text-gray-600">S/ {Number(total || 0).toFixed(2)}</span>
      </div>
      {(!data || data.length === 0) ? (
        <div className="text-sm text-gray-500">No hay datos.</div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            className="mx-auto"
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: gradient,
              border: '6px solid #e5e7eb',
            }}
          />
          <div className="flex-1 space-y-1 max-h-44 overflow-auto text-sm">
            {data.map((d) => (
              <div key={`${title}-${d.label}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: d.color }} />
                  <span className="capitalize text-gray-800">{d.label}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="font-semibold text-gray-900">{d.pct.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600">S/ {Number(d.monto || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}






