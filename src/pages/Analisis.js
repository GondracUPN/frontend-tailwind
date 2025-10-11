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
  const [filters, setFilters] = useState({
    fromVenta: '',
    toVenta: '',
    tipo: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const q = new URLSearchParams();
      if (filters.fromVenta) q.set('fromVenta', filters.fromVenta);
      if (filters.toVenta) q.set('toVenta', filters.toVenta);
      if (filters.tipo) q.set('tipo', filters.tipo);
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
  }, []);

  const maxByType = useMemo(() => {
    if (!data?.inventoryByType?.length) return 0;
    return Math.max(...data.inventoryByType.map((x) => x.unidades));
  }, [data]);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-semibold">Análisis</h1>
          <div className="flex items-center gap-2">
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={filters.fromVenta}
              onChange={(e) => setFilters((s) => ({ ...s, fromVenta: e.target.value }))}
            />
            <span className="text-sm text-gray-500">a</span>
            <input
              type="date"
              className="border rounded px-2 py-1 text-sm"
              value={filters.toVenta}
              onChange={(e) => setFilters((s) => ({ ...s, toVenta: e.target.value }))}
            />
            <select
              className="border rounded px-2 py-1 text-sm"
              value={filters.tipo}
              onChange={(e) => setFilters((s) => ({ ...s, tipo: e.target.value }))}
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
              onClick={load}
            >
              Aplicar filtros
            </button>
            <button
              className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
              onClick={() => setVista(analisisBack || 'home')}
            >
              Volver
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500">Cargando…</div>
        ) : error ? (
          <div className="text-red-600">{error}</div>
        ) : !data ? null : (
          <>
            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <Card title="Inventario activo" value={data.summary?.inventoryActiveUnits || 0} sub="Unidades" />
              <Card title="Capital inmovilizado" value={<Currency v={data.summary?.capitalInmovilizado || 0} />} />
              <Card title="Rotación (mediana)" value={`${data.summary?.rotationMedianDaysOverall ?? '-'} días`} />
              <Card
                title="Margen % promedio (últ. mes)"
                value={
                  (() => {
                    const m = data.summary?.monthlies || [];
                    const last = m[m.length - 1];
                    return last ? <Percent v={last.margenPromedio} /> : '-';
                  })()
                }
                sub={(() => {
                  const m = data.summary?.monthlies || [];
                  const last = m[m.length - 1];
                  return last ? (
                    <span>
                      Ganancia: <Currency v={last.ganancia} />
                    </span>
                  ) : null;
                })()}
              />
            </div>

            {/* Inventario por tipo */}
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

            {/* Verificador de inventario por antigüedad */}
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-semibold mb-3">Verificador de inventario por antigüedad</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm font-medium mb-1">15–29 días</div>
                  <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">
                    {(data.aging?.bucket15_29 || []).map((p) => (
                      <li key={`a1-${p.productoId}`} className="flex justify-between border-b py-1">
                        <span>#{p.productoId} • {p.display || p.tipo}</span>
                        <span className="text-gray-500">{p.diasEnStock} días</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <div className="text-sm font-medium mb-1">30–59 días</div>
                  <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">
                    {(data.aging?.bucket30_59 || []).map((p) => (
                      <li key={`a2-${p.productoId}`} className="flex justify-between border-b py-1">
                        <span>#{p.productoId} • {p.display || p.tipo}</span>
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
                        <span>#{p.productoId} • {p.display || p.tipo}</span>
                        <span className="text-gray-500">{p.diasEnStock} días</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Ventas y margen por mes */}
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

            {/* Margen por tipo y modelo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Margen % por tipo</h2>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-1">Tipo</th>
                      <th className="py-1">Margen % prom.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.sales?.marginByType || []).map((r) => (
                      <tr key={r.tipo} className="border-t">
                        <td className="py-1">{r.tipo}</td>
                        <td className="py-1"><Percent v={r.margenPromedio} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Margen % por modelo</h2>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1">Modelo</th>
                        <th className="py-1">Margen % prom.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.sales?.marginByModelo || []).map((r, i) => (
                        <tr key={`${r.modelo}-${i}`} className="border-t">
                          <td className="py-1">{r.modelo}</td>
                          <td className="py-1"><Percent v={r.margenPromedio} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Top / Bottom ventas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Top 10 ventas por ganancia</h2>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1">#</th>
                        <th className="py-1">Tipo/Modelo</th>
                        <th className="py-1">Ganancia</th>
                        <th className="py-1">Margen %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.sales?.topVentas || []).map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="py-1">{v.id}</td>
                          <td className="py-1">{v.display || v.tipo}</td>
                          <td className="py-1"><Currency v={v.ganancia} /></td>
                          <td className="py-1"><Percent v={v.margen} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Bottom 10 ventas por ganancia</h2>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1">#</th>
                        <th className="py-1">Tipo/Modelo</th>
                        <th className="py-1">Ganancia</th>
                        <th className="py-1">Margen %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.sales?.bottomVentas || []).map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="py-1">{v.id}</td>
                          <td className="py-1">{v.display || v.tipo}</td>
                          <td className="py-1"><Currency v={v.ganancia} /></td>
                          <td className="py-1"><Percent v={v.margen} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Logística */}
            <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
              <h2 className="text-lg font-semibold mb-3">Logística</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo compra → recepción</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraARecepcion?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraARecepcion?.median ?? '-'} días</div>
                </div>
                <div>
                  <div className="text-sm font-medium mb-2">Tiempo recepción → venta</div>
                  <div className="text-sm text-gray-700">Promedio: {data.logistica?.recepcionAVenta?.mean ?? '-'} días</div>
                  <div className="text-sm text-gray-700">Mediana: {data.logistica?.recepcionAVenta?.median ?? '-'} días</div>
                </div>
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
              </div>
              <div className="mt-4">
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

            {/* Alertas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h2 className="text-lg font-semibold mb-3">Alertas: margen bajo</h2>
                <ul className="text-sm text-gray-700 space-y-1 max-h-72 overflow-auto">
                  {(data.alerts?.lowMarginVentas || []).map((v) => (
                    <li key={`lm-${v.id}`} className="flex justify-between border-b py-1">
                      <span>#{v.id} • {v.display || v.tipo}</span>
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
                      <span>#{p.productoId} • {p.display || p.tipo} • {p.estado}</span>
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
