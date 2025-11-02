import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

function Card({ title, value, sub }) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub ? <div className="text-xs text-gray-500 mt-1">{sub}</div> : null}
    </div>
  );
}

function Currency({ v }) {
  const n = Number(v || 0);
  return <>{n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' })}</>;
}

function Percent({ v }) {
  const n = Number(v || 0);
  return <>{n.toFixed(2)}%</>;
}

function Bar({ label, value, max }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded">
        <div className="h-2 bg-blue-500 rounded" style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

export default function Analisis({ setVista, analisisBack = 'home' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const pad2 = (n) => String(n).padStart(2, '0');

  // Filtros del formulario y aplicados
  const [form, setForm] = useState({ month: '', tipo: '' });
  const [applied, setApplied] = useState({ month: '', tipo: '' });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (applied.month) {
        const [yStr, mStr] = applied.month.split('-');
        const y = Number(yStr);
        const m = Number(mStr);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          const fromVenta = `${y}-${pad2(m)}-01`;
          const lastDay = new Date(y, m, 0).getDate();
          const toVenta = `${y}-${pad2(m)}-${pad2(lastDay)}`;
          q.set('fromVenta', fromVenta);
          q.set('toVenta', toVenta);
          q.set('fromCompra', fromVenta);
          q.set('toCompra', toVenta);
        }
      }
      if (applied.tipo) q.set('tipo', applied.tipo);
      const res = await api.get(`/analytics/summary?${q.toString()}`);
      setData(res);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.month, applied.tipo]);

  const maxByType = useMemo(() => {
    if (!data?.inventoryByType?.length) return 0;
    return Math.max(...data.inventoryByType.map((x) => x.unidades));
  }, [data]);

  const isGeneral = !applied.month;

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">Análisis</h1>
          <div className="flex items-center gap-2">
            <input
              type="month"
              className="border rounded px-2 py-1 text-sm"
              value={form.month}
              onChange={(e) => setForm((s) => ({ ...s, month: e.target.value }))}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={form.tipo}
              onChange={(e) => setForm((s) => ({ ...s, tipo: e.target.value }))}
            >
              <option value="">Todos los tipos</option>
              <option value="macbook">MacBook</option>
              <option value="iphone">iPhone</option>
              <option value="ipad">iPad</option>
              <option value="watch">Watch</option>
              <option value="otro">Otro</option>
            </select>
            <button
              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"
              onClick={() => setApplied(form)}
            >
              Aplicar filtros
            </button>
            <button
              className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
              onClick={() => {
                setForm({ month: '', tipo: '' });
                setApplied({ month: '', tipo: '' });
              }}
            >
              Limpiar
            </button>
            <button
              onClick={() => (typeof setVista === 'function' ? setVista(analisisBack) : window.history.back())}
              className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100"
            >
              ← Volver
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500">Cargando…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !data ? null : (
          <>
            {/* Resumen superior */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              {isGeneral ? (
                <>
                  <Card title="Inventario activo" value={data.summary?.inventoryActiveUnits ?? '-'} sub={`Unidades`} />
                  <Card title="Capital inmovilizado" value={<Currency v={data.summary?.capitalInmovilizado} />} />
                  <Card title="Capital total" value={<Currency v={data.summary?.capitalTotal} />} />
                </>
              ) : (
                <>
                  <Card title="Inventario" value={data.summary?.comprasPeriodoUnidades ?? '-'} sub={`Unidades`} />
                  <Card title="Capital inmovilizado" value={<Currency v={data.summary?.capitalInmovilizado} />} />
                  <Card title="Capital total" value={<Currency v={data.summary?.capitalTotal} />} />
                </>
              )}
              <Card
                title="Rotación (mediana)"
                value={`${data.summary?.rotationMedianDaysOverall ?? '-'} días`}
              />
              <Card
                title={isGeneral ? "Margen % promedio (últ. mes)" : "Margen % promedio (mes)"}
                value={(() => {
                  const rows = data.sales?.perMonth || [];
                  const row = rows[rows.length - 1];
                  return row ? <Percent v={row.margenPromedio} /> : '-';
                })()}
                sub={(() => {
                  const rows = data.sales?.perMonth || [];
                  const row = rows[rows.length - 1];
                  return row ? (
                    <span>
                      Ganancia: <Currency v={row.ganancia} />
                    </span>
                  ) : null;
                })()}
              />
            </div>

            {/* Inventario por tipo (general) */}
            {isGeneral && (
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Inventario por tipo</h2>
                <div className="text-xs text-gray-500">Unidades activas y capital</div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  {(data.inventoryByType || []).map((x) => (
                    <Bar key={x.tipo} label={`${x.tipo} (${x.unidades})`} value={x.unidades} max={maxByType} />
                  ))}
                </div>
                <div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1">Tipo</th>
                        <th className="py-1">Unidades</th>
                        <th className="py-1">Capital</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.inventoryByType || []).map((x) => (
                        <tr key={x.tipo} className="border-t">
                          <td className="py-1">{x.tipo}</td>
                          <td className="py-1">{x.unidades}</td>
                          <td className="py-1"><Currency v={x.capital} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            )}

            {/* Compras del mes (modo Mes) */}
            {!isGeneral && (
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Compras del mes</h2>
                <div className="text-xs text-gray-500">Unidades: {data.summary?.comprasPeriodoUnidades ?? 0} · Capital: <Currency v={data.summary?.comprasPeriodoCapital || 0} /></div>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">#</th>
                      <th className="py-1">Producto</th>
                      <th className="py-1">Fecha compra</th>
                      <th className="py-1">Costo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.comprasPeriodo || []).map((p, i) => (
                      <tr key={`${p.productoId}-${i}`} className="border-t">
                        <td className="py-1">{p.productoId}</td>
                        <td className="py-1">{p.display || p.tipo}</td>
                        <td className="py-1">{p.fechaCompra || '-'}</td>
                        <td className="py-1"><Currency v={p.costoTotal} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            )}

            {/* Antigüedad de inventario (general) */}
            {isGeneral && (
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-semibold mb-3">Verificador de inventario por antigüedad</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">15-29 días</div>
                  <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">
                    {(data.aging?.bucket15_29 || []).map((p) => (
                      <li key={`a1-${p.productoId}`} className="flex justify-between border-b py-1">
                        <span>#{p.productoId} · {p.display || p.tipo}</span>
                        <span className="text-gray-500">{p.diasEnStock} días</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">30-59 días</div>
                  <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">
                    {(data.aging?.bucket30_59 || []).map((p) => (
                      <li key={`a2-${p.productoId}`} className="flex justify-between border-b py-1">
                        <span>#{p.productoId} · {p.display || p.tipo}</span>
                        <span className="text-gray-500">{p.diasEnStock} días</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">60+ días</div>
                  <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">
                    {(data.aging?.bucket60_plus || []).map((p) => (
                      <li key={`a3-${p.productoId}`} className="flex justify-between border-b py-1">
                        <span>#{p.productoId} · {p.display || p.tipo}</span>
                        <span className="text-gray-500">{p.diasEnStock} días</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            )}

            {/* Ventas y margen (general) */}
            {isGeneral ? (
              <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
                <h2 className="text-lg font-semibold mb-3">Ventas y margen por mes</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">Mes</th>
                      <th className="py-1">Ingresos</th>
                      <th className="py-1">Ganancia</th>
                      <th className="py-1">Margen % prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.sales?.perMonth || []).map((m) => (
                      <tr key={m.month} className="border-t">
                        <td className="py-1">{m.month}</td>
                        <td className="py-1"><Currency v={m.ingresos} /></td>
                        <td className="py-1"><Currency v={m.ganancia} /></td>
                        <td className="py-1"><Percent v={m.margenPromedio} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {/* Logística */}
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-semibold mb-3">Logística</h2>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo compra → recepción</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraARecepcion?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraARecepcion?.median ?? '-'} días</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo compra → recojo</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraARecogido?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraARecogido?.median ?? '-'} días</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo recepción → recojo</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.recepcionARecogido?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.recepcionARecogido?.median ?? '-'} días</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo recojo → venta</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.recogidoAVenta?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.recogidoAVenta?.median ?? '-'} días</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo compra → venta</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraAVenta?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraAVenta?.median ?? '-'} días</div>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="text-md font-semibold mb-2">Promedios por tipo</h3>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1">Tipo</th>
                        <th className="py-1">Compra→Recepción</th>
                        <th className="py-1">Compra→Recojo</th>
                        <th className="py-1">Recepción→Recojo</th>
                        <th className="py-1">Recojo→Venta</th>
                        <th className="py-1">Compra→Venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.logistica?.porTipo || []).map((r, i) => (
                        <tr key={`${r.tipo}-${i}`} className="border-t">
                          <td className="py-1">{r.tipo}</td>
                          <td className="py-1">{r.compraARecepcion?.mean ?? '-'}</td>
                          <td className="py-1">{r.compraARecogido?.mean ?? '-'}</td>
                          <td className="py-1">{r.recepcionARecogido?.mean ?? '-'}</td>
                          <td className="py-1">{r.recogidoAVenta?.mean ?? '-'}</td>
                          <td className="py-1">{r.compraAVenta?.mean ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <div className="text-sm font-medium mb-2">Tardíos por transportista</div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1">Transportista</th>
                          <th className="py-1">Tardíos %</th>
                          <th className="py-1">Mediana días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.logistica?.tardiasPorTransportista || []).map((r, i) => (
                          <tr key={`${r.transportista}-${i}`} className="border-t">
                            <td className="py-1">{r.transportista}</td>
                            <td className="py-1">{r.rate}%</td>
                            <td className="py-1">{r.medianDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Desempeño por casillero</div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-1">Casillero</th>
                          <th className="py-1">Tardíos %</th>
                          <th className="py-1">Mediana días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.logistica?.desempenoPorCasillero || []).map((r, i) => (
                          <tr key={`${r.casillero}-${i}`} className="border-t">
                            <td className="py-1">{r.casillero}</td>
                            <td className="py-1">{r.rate}%</td>
                            <td className="py-1">{r.medianDays}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Alertas: margen bajo</h2>
                <ul className="text-sm text-gray-700 space-y-1 max-h-72 overflow-auto">
                  {(data.alerts?.lowMarginVentas || []).map((v) => (
                    <li key={`lm-${v.id}`} className="flex justify-between border-b py-1">
                      <span>#{v.id} · {v.display || v.tipo}</span>
                      <span className="text-gray-500"><Percent v={v.margen} /></span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Alertas: tránsito prolongado</h2>
                <ul className="text-sm text-gray-700 space-y-1 max-h-72 overflow-auto">
                  {(data.alerts?.transitLongItems || []).map((p, i) => (
                    <li key={`tl-${p.productoId}-${i}`} className="flex justify-between border-b py-1">
                      <span>#{p.productoId} · {p.display || p.tipo} · {p.estado}</span>
                      <span className="text-gray-500">{p.dias} días</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

