import React, { useEffect, useMemo, useState } from 'react';



import api from '../api';



import { TC_FIJO } from '../utils/tipoCambio';







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



  const fmtDate = (d) => {



    if (!d) return '-';



    const dt = new Date(d);



    if (isNaN(dt.getTime())) return '-';



    const dd = String(dt.getDate()).padStart(2, '0');



    const mm = String(dt.getMonth() + 1).padStart(2, '0');



    const yyyy = dt.getFullYear();



    return `${dd}/${mm}/${yyyy}`;



  };



  const fmtUSD = (value) => {



    if (value === null || value === undefined) return '-';



    const n = Number(value);



    if (!isFinite(n)) return '-';



    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });



  };



  const fmtSolesLocal = (value) => {



    if (value === null || value === undefined) return '-';



    const n = Number(value);



    if (!isFinite(n)) return '-';



    return n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });



  };



  const medianLocal = (arr) => {



    const clean = (arr || []).filter((n) => isFinite(n) && n > 0).sort((a, b) => a - b);



    if (!clean.length) return null;



    const mid = Math.floor(clean.length / 2);



    if (clean.length % 2 === 1) return clean[mid];



    return (clean[mid - 1] + clean[mid]) / 2;



  };



  const avgLocal = (arr = []) => {



    const clean = arr.filter((n) => isFinite(n) && n > 0);



    if (!clean.length) return null;



    return +(clean.reduce((s, n) => s + n, 0) / clean.length).toFixed(2);



  };



  const roundUp10 = (value) => {



    const n = Number(value);



    if (!isFinite(n)) return null;



    return Math.ceil(n / 10) * 10;



  };



  const [loading, setLoading] = useState(true);



  const [error, setError] = useState('');







  // Filtros: fechas (bot?n) y producto (aplican al cambiar)


  const [dateForm, setDateForm] = useState({ from: '', to: '' });


  const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });


  const [productFilters, setProductFilters] = useState({ tipo: '', gama: '', proc: '', pantalla: '' });


  const cacheKey = useMemo(() => {



    const parts = [



      appliedDates.from || '',



      appliedDates.to || '',



      productFilters.tipo || '',



      productFilters.gama || '',



      productFilters.proc || '',



      productFilters.pantalla || '',



    ].join(':');



    return `analytics:lastSummary:v2:${parts}`;



  }, [appliedDates.from, appliedDates.to, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla]);







  // Lee snapshot cacheado para render inmediato (SWR: stale-while-revalidate)



  const [data, setData] = useState(() => {



    try {



      const raw = localStorage.getItem(`analytics:lastSummary:v2::`); // compat old key



      const raw2 = cacheKey ? localStorage.getItem(cacheKey) : null;



      const parsed = raw2 ? JSON.parse(raw2) : raw ? JSON.parse(raw) : null;



      return parsed && typeof parsed === 'object' ? parsed : null;



    } catch {



      return null;



    }



  });



  const [isStale, setIsStale] = useState(false);



  const [tab, setTab] = useState('economico'); // 'economico' | 'productos'



  const [lastUpdated, setLastUpdated] = useState(() => {



    try {



      const raw = cacheKey ? localStorage.getItem(`${cacheKey}:ts`) : null;



      return raw ? Number(raw) : null;



    } catch { return null; }



  });







  const load = async () => {



    setLoading(!data); // si hay snapshot, no bloquear todo el layout



    setIsStale(!!data);



    setError('');



    try {



      const q = new URLSearchParams();



      if (appliedDates.from) {



        q.set('fromVenta', appliedDates.from);



        q.set('fromCompra', appliedDates.from);



      }



      if (appliedDates.to) {



        q.set('toVenta', appliedDates.to);



        q.set('toCompra', appliedDates.to);



      }



      if (productFilters.tipo) q.set('tipo', productFilters.tipo);



      if (productFilters.gama) q.set('gama', productFilters.gama);



      if (productFilters.proc) q.set('procesador', productFilters.proc);



      if (productFilters.pantalla) q.set('pantalla', productFilters.pantalla);



      const res = await api.get(`/analytics/summary?${q.toString()}`);



      setData(res);



      try {



        localStorage.setItem(cacheKey, JSON.stringify(res));



        const ts = Date.now();



        localStorage.setItem(`${cacheKey}:ts`, String(ts));



        setLastUpdated(ts);



      } catch {}



    } catch (e) {



      setError(e.message || 'Error');



    } finally {



      setLoading(false);



      setIsStale(false);



    }



  };







  useEffect(() => {



    load();



    // eslint-disable-next-line react-hooks/exhaustive-deps



  }, [appliedDates.from, appliedDates.to, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla]);







  const maxByType = useMemo(() => {



    if (!data?.inventoryByType?.length) return 0;



    return Math.max(...data.inventoryByType.map((x) => x.unidades));



  }, [data]);







  const isGeneral = !appliedDates.from && !appliedDates.to;







  return (



    <div className="min-h-screen p-6 bg-gray-50">



      <div className="max-w-7xl mx-auto">



        <div className="flex items-center gap-2 mb-3">



          <button className={`px-3 py-1.5 rounded border text-sm ${tab==='economico'?'bg-gray-900 text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('economico')}>Análisis económico</button>



          <button className={`px-3 py-1.5 rounded border text-sm ${tab==='productos'?'bg-gray-900 text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('productos')}>Análisis de productos</button>



        </div>



        <div className="flex items-center justify-between mb-6">



          <h1 className="text-3xl font-semibold">Análisis</h1>



          <div className="flex items-center gap-2">



            <input



              type="date"



              className="border rounded px-2 py-1 text-sm"



              value={dateForm.from}



              onChange={(e) => setDateForm((s) => ({ ...s, from: e.target.value }))}



              placeholder="Fecha inicio"



            />



            <input



              type="date"



              className="border rounded px-2 py-1 text-sm"



              value={dateForm.to}



              onChange={(e) => setDateForm((s) => ({ ...s, to: e.target.value }))}



              placeholder="Fecha fin"



            />



            <button



              className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700"



              onClick={() => setAppliedDates(dateForm)}



            >



              Aplicar filtro



            </button>



            <button



              className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"



              onClick={() => {



                setDateForm({ from: '', to: '' });



                setAppliedDates({ from: '', to: '' });



                setProductFilters({ tipo: '', gama: '', proc: '', pantalla: '' });



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







        {error ? (



          <div className="text-red-600">{error}</div>



        ) : !data && loading ? (



          <div className="text-gray-500">Cargando...</div>



        ) : (



          <>



            {/* Indicador de actualizado */}



            {lastUpdated ? (



              <div className="text-xs text-gray-500 mb-2">Actualizado {new Date(lastUpdated).toLocaleString()} {isStale ? '(actualizando...)' : ''}</div>



            ) : null}



            {/* Resumen superior */}



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}grid grid-cols-1 md:grid-cols-5 gap-4 mb-6`}>



              <Card title={isGeneral ? "Inventario activo" : "Inventario"} value={isGeneral ? (data.summary?.inventoryActiveUnits ?? '-') : (data.summary?.comprasPeriodoUnidades ?? '-')} sub={`Unidades`} />



              <Card title="Capital inmovilizado" value={<Currency v={data.summary?.capitalInmovilizado} />} />



              <Card title="Capital total" value={<Currency v={data.summary?.capitalTotal} />} />



              <Card title="Rotación (mediana)" value={`${data.summary?.rotationMedianDaysOverall ?? '-'} días`} />



              <Card title={isGeneral ? "Margen % promedio (últ. mes)" : "Margen % promedio (mes)"} value={(() => { const rows = data.sales?.perMonth || []; const row = rows[rows.length - 1]; return row ? <Percent v={row.margenPromedio} /> : '-'; })()} sub={(() => { const rows = data.sales?.perMonth || []; const row = rows[rows.length - 1]; return row ? (<span>Ganancia: <Currency v={row.ganancia} /></span>) : null; })()} />



            </div>







            {/* Inventario por tipo (general) */}



            {isGeneral && (



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



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







            {/* Pendientes por vender (solo recogidos) — vista General */}



            {isGeneral && (



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



              <div className="flex items-center justify-between mb-3">



                <h2 className="text-lg font-semibold">Pendientes por vender (recogidos)</h2>



                <div className="text-xs text-gray-500">Lista completa de stock recogido sin venta</div>



              </div>



              {(() => {



                const rows = (data?.noVendidosDelPeriodo || []).filter((p) => !!p.fechaRecogido);



                return (



                  <div className="max-h-[28rem] overflow-auto">



                    {rows.length === 0 ? (



                      <div className="text-sm text-gray-500">No hay productos recogidos pendientes de venta.</div>



                    ) : (



                      <table className="w-full text-sm">



                        <thead>



                          <tr className="text-left text-gray-500">



                            <th className="py-1">#</th>



                            <th className="py-1">Producto</th>



                            <th className="py-1">Fecha compra</th>



                            <th className="py-1">Días desde recogido</th>



                          </tr>



                        </thead>



                        <tbody>



                          {rows.map((p, i) => (



                            <tr key={`pg-${p.productoId}-${i}`} className="border-t">



                              <td className="py-1">{p.productoId}</td>



                              <td className="py-1">{p.display || p.tipo}</td>



                              <td className="py-1">{fmtDate(p.fechaCompra)}</td>



                              <td className="py-1">{p.diasDesdeRecogido ?? '-'}</td>



                            </tr>



                          ))}



                        </tbody>



                      </table>



                    )}



                  </div>



                );



              })()}



            </div>



            )}







            {/* Compras del mes (modo Mes) */}



            {!isGeneral && (



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



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



                        <td className="py-1">{fmtDate(p.fechaCompra)}</td>



                        <td className="py-1"><Currency v={p.costoTotal} /></td>



                      </tr>



                    ))}



                  </tbody>



                </table>



              </div>



            </div>



            )}







            {/* Productos del mes: Vendidos vs Pendientes (modo Mes) */}



            {!isGeneral && (



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



              <div className="flex items-center justify-between mb-3">



                <h2 className="text-lg font-semibold">Productos del mes</h2>



                <div className="text-xs text-gray-500">Vendidos y por vender segÃºn el mes seleccionado</div>



              </div>



              {(() => {



                // Vendidos del mes con fechaVenta, precioVenta y % ganancia



                const vendidosItems = (data?.sales?.porTipoDetalle || [])



                  .flatMap((r) => (r?.vendidos?.items || []));



                // Pendientes con fechaCompra y días desde recogido



                const pendientesItems = (data?.noVendidosDelPeriodo || []);



                const vendidosTotal = vendidosItems.length;



                const pendientesTotal = pendientesItems.length;



                return (



                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">



                    <div>



                      <div className="flex items-center justify-between mb-2">



                        <h3 className="text-md font-semibold">Vendidos del mes</h3>



                        <span className="text-xs text-gray-500">{vendidosTotal} items</span>



                      </div>



                      <div className="max-h-72 overflow-auto">



                        {vendidosItems.length === 0 ? (



                          <div className="text-sm text-gray-500">Sin ventas en el mes.</div>



                        ) : (



                          <table className="w-full text-sm">



                            <thead>



                              <tr className="text-left text-gray-500">



                                <th className="py-1">#</th>



                                <th className="py-1">Producto</th>



                                <th className="py-1">Fecha venta</th>



                                <th className="py-1">Precio venta</th>



                                <th className="py-1">% ganancia</th>



                              </tr>



                            </thead>



                            <tbody>



                              {vendidosItems.map((v, i) => (



                                <tr key={`vm-${v.productoId}-${i}`} className="border-t">



                                  <td className="py-1">{v.productoId}</td>



                                  <td className="py-1">{v.display}</td>



                                  <td className="py-1">{fmtDate(v.fechaVenta)}</td>



                                  <td className="py-1"><Currency v={v.precioVenta} /></td>



                                  <td className="py-1"><Percent v={v.margen} /></td>



                                </tr>



                              ))}



                            </tbody>



                          </table>



                        )}



                      </div>



                    </div>



                    <div>



                      <div className="flex items-center justify-between mb-2">



                        <h3 className="text-md font-semibold">Pendientes por vender</h3>



                        <span className="text-xs text-gray-500">{pendientesTotal} items</span>



                      </div>



                      <div className="max-h-72 overflow-auto">



                        {pendientesItems.length === 0 ? (



                          <div className="text-sm text-gray-500">Sin pendientes del mes.</div>



                        ) : (



                          <table className="w-full text-sm">



                            <thead>



                              <tr className="text-left text-gray-500">



                                <th className="py-1">#</th>



                                <th className="py-1">Producto</th>



                                <th className="py-1">Fecha compra</th>



                                <th className="py-1">Días desde recogido</th>



                              </tr>



                            </thead>



                            <tbody>



                              {pendientesItems.map((p, i) => (



                                <tr key={`pm-${p.productoId}-${i}`} className="border-t">



                                  <td className="py-1">{p.productoId}</td>



                                  <td className="py-1">{p.display || p.tipo}</td>



                                  <td className="py-1">{fmtDate(p.fechaCompra)}</td>



                                  <td className="py-1">{p.diasDesdeRecogido ?? '-'}</td>



                                </tr>



                              ))}



                            </tbody>



                          </table>



                        )}



                      </div>



                    </div>



                  </div>



                );



              })()}



            </div>



            )}







            {/* AntigÃ¼edad de inventario (general) */}



            {isGeneral && (



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



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



              <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



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



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



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



            <div className={`${tab !== 'economico' ? 'hidden ' : ''}grid grid-cols-1 md:grid-cols-2 gap-6 mb-10`}>



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







        {/* Análisis de productos (MacBook) */}



        {tab === 'productos' && (



          <div className="bg-white rounded-xl border shadow-sm p-5 mb-10">



            <h2 className="text-lg font-semibold mb-4">Análisis de productos</h2>



            {(() => {



              const groups = data?.productGroups || [];



              const gamas = Array.from(new Set(groups.map((g)=>g.gama).filter(Boolean))).sort();



              const procs = Array.from(new Set(groups.map((g)=>g.proc).filter(Boolean))).sort();



              const pantallas = Array.from(new Set(groups.map((g)=>g.pantalla).filter(Boolean))).sort();



              const filtered = groups.filter((g) => {



                if (productFilters.tipo && g.tipo !== productFilters.tipo) return false;



                if (productFilters.gama && g.gama !== productFilters.gama) return false;



                if (productFilters.proc && g.proc !== productFilters.proc) return false;



                if (productFilters.pantalla && g.pantalla !== productFilters.pantalla) return false;



                return true;



              });



              return (



                <>



                  <div className="flex flex-wrap gap-3 mb-4">



                    <label className="text-sm">Tipo



                      <select



                        className="ml-2 border rounded px-2 py-1 text-sm"



                        value={productFilters.tipo}



                        onChange={(e)=> setProductFilters((s)=>({ ...s, tipo: e.target.value, gama: '', proc: '', pantalla: '' }))}



                      >



                        <option value="">Todos los tipos</option>



                        <option value="macbook">MacBook</option>



                        <option value="iphone">iPhone</option>



                        <option value="ipad">iPad</option>



                        <option value="watch">Watch</option>



                        <option value="otro">Otro</option>



                      </select>



                    </label>



                    <label className="text-sm">Gama



                      <select



                        className="ml-2 border rounded px-2 py-1 text-sm"



                        value={productFilters.gama}



                        onChange={(e)=> setProductFilters((s)=>({ ...s, gama: e.target.value }))}



                      >



                        <option value="">Todas</option>



                        {gamas.map(x=> <option key={x} value={x}>{x}</option>)}



                      </select>



                    </label>



                    <label className="text-sm">Procesador



                      <select



                        className="ml-2 border rounded px-2 py-1 text-sm"



                        value={productFilters.proc}



                        onChange={(e)=> setProductFilters((s)=>({ ...s, proc: e.target.value }))}



                      >



                        <option value="">Todos</option>



                        {procs.map(x=> <option key={x} value={x}>{x}</option>)}



                      </select>



                    </label>



                    <label className="text-sm">Pantalla



                      <select



                        className="ml-2 border rounded px-2 py-1 text-sm"



                        value={productFilters.pantalla}



                        onChange={(e)=> setProductFilters((s)=>({ ...s, pantalla: e.target.value }))}



                      >



                        <option value="">Todas</option>



                        {pantallas.map(x=> <option key={x} value={x}>{x}</option>)}



                      </select>



                    </label>



                  </div>



                  <div className="grid grid-cols-1 gap-5">



                    {filtered.map((g, idx) => {



                      const comprasDetalle = [...(g.comprasDetalle || [])].sort(



                        (a, b) => (Number(a?.costoTotal || 0) - Number(b?.costoTotal || 0)),



                      );



                      const ventasDetalle = [...(g.ventasDetalle || [])].sort(



                        (a, b) => (Number(a?.precioVenta || 0) - Number(b?.precioVenta || 0)),



                      );



                      const ventaRef = (() => {



                        const precios = ventasDetalle.map((v) => Number(v?.precioVenta || 0)).filter((n) => isFinite(n) && n > 0);



                        return medianLocal(precios) || Number(g.ventas?.p50 || 0) || null;



                      })();



                      const costoRef = (() => {



                        const costos = comprasDetalle.map((c) => Number(c?.costoTotal || 0)).filter((n) => isFinite(n) && n > 0);



                        if (costos.length) return +(costos.reduce((s, n) => s + n, 0) / costos.length).toFixed(2);



                        return Number(g.compras?.mean || 0) || null;



                      })();



                      const preciosUSD = comprasDetalle.map((c) => Number(c?.precioUSD || 0)).filter((n) => isFinite(n) && n > 0);



                      const promedioUSD = avgLocal(preciosUSD);



                      const ventaPromedio = avgLocal(ventasDetalle.map((v) => Number(v?.precioVenta || 0)).filter((n) => isFinite(n) && n > 0));



                      const ventaBaseHist = ventaPromedio || ventaRef || null;



                      const ventaRango20 = costoRef ? roundUp10(costoRef * 1.2) : null;



                      const ventaRango40 = costoRef ? roundUp10(costoRef * 1.4) : null;



                      const baseRango = (ventaRango20 != null && ventaRango40 != null)



                        ? ((ventaRango20 + ventaRango40) / 2)



                        : (costoRef ? costoRef * 1.3 : null);



                      const ventaObjetivo = (() => {



                        if (!ventaBaseHist && !baseRango) return null;



                        const candidato = (ventaBaseHist && baseRango)



                          ? ((ventaBaseHist + baseRango) / 2)



                          : (ventaBaseHist ?? baseRango);



                        if (!isFinite(candidato)) return null;



                        return roundUp10(candidato);



                      })();



                      const tcPromedio = (() => {



                        const ratios = comprasDetalle



                          .map((row) => {



                            const usd = Number(row?.precioUSD || 0);



                            const costo = Number(row?.costoTotal || 0);



                            if (usd > 0 && costo > 0) return costo / usd;



                            return null;



                          })



                          .filter((n) => isFinite(n) && n > 0);



                        if (!ratios.length) return null;



                        return +(ratios.reduce((s, n) => s + n, 0) / ratios.length).toFixed(4);



                      })();



                      const tcReferencia = tcPromedio || TC_FIJO || null;



                      const ventaObjetivoUSD = (ventaObjetivo && tcReferencia) ? +((ventaObjetivo / tcReferencia).toFixed(2)) : null;



                      const margenObjetivo = (ventaObjetivo && costoRef) ? +((((ventaObjetivo - costoRef) / costoRef) * 100).toFixed(2)) : null;



                      const ventaBaseParaCompra = ventaObjetivo || ventaBaseHist || null;



                      const compraMax20USD = (ventaBaseParaCompra && tcReferencia)



                        ? +(((ventaBaseParaCompra / 1.2) / tcReferencia).toFixed(2))



                        : null;



                      const compraMax40USD = (ventaBaseParaCompra && tcReferencia)



                        ? +(((ventaBaseParaCompra / 1.4) / tcReferencia).toFixed(2))



                        : null;



                      const compraRangoUSD = (compraMax20USD && compraMax40USD)



                        ? `${fmtUSD(Math.min(compraMax20USD, compraMax40USD))} - ${fmtUSD(Math.max(compraMax20USD, compraMax40USD))}`



                        : '-';



                      const ventaRangoTexto = (ventaRango20 != null && ventaRango40 != null)



                        ? `${fmtSolesLocal(Math.min(ventaRango20, ventaRango40))} - ${fmtSolesLocal(Math.max(ventaRango20, ventaRango40))}`



                        : '-';



                      return (



                        <div key={`${g.gama}-${g.proc}-${g.pantalla}-${idx}`} className="border rounded-xl p-4 space-y-4">



                          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">



                            <div>



                              <div className="text-sm text-gray-500 capitalize">{g.tipo}</div>



                              <div className="text-lg font-semibold">



                                {g.label}{' '}



                                <span className="text-sm text-gray-500 font-normal">



                                  ({g.compras?.count || 0} compras)



                                </span>



                              </div>



                              <div className="text-xs text-gray-500 mt-1">



                                Variantes: RAM {g.ramDistinct?.join(', ') || '-'} • SSD {g.ssdDistinct?.join(', ') || '-'}



                              </div>



                              <div className="text-xs text-gray-500">



                                Promedios históricos: compra <Currency v={g.compras?.mean} /> · venta <Currency v={g.ventas?.mean} /> · margen <Percent v={g.ventas?.margenPromedio || 0} />



                              </div>



                            </div>



                            <div className="w-full lg:w-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-gray-700">



                              <div className="font-semibold text-gray-800">Recomendación</div>



                              <div className="text-xs text-gray-600">Basado en lo que se pagó (USD) y se vendió (S/) para mantener márgenes del 20%-40%.</div>



                              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">



                                <div className="rounded border border-emerald-200 bg-white/50 p-2 space-y-1">



                                  <div className="text-xs uppercase text-gray-500">Compra objetivo (USD)</div>



                                  <div className="flex justify-between"><span>Promedio pagado:</span><strong>{fmtUSD(promedioUSD)}</strong></div>



                                  <div className="flex justify-between"><span>Rango sugerido (20%-40%):</span><strong>{compraRangoUSD}</strong></div>



                                  <div className="flex justify-between"><span>TC usado:</span><strong>{tcReferencia ? tcReferencia.toFixed(2) : '-'}</strong></div>



                                </div>



                                <div className="rounded border border-blue-200 bg-white/50 p-2 space-y-1">



                                  <div className="text-xs uppercase text-gray-500">Venta objetivo (S/)</div>



                                  <div className="flex justify-between"><span>Ventas históricas:</span><strong>{ventaBaseHist ? fmtSolesLocal(ventaBaseHist) : '-'}</strong></div>



                                  <div className="flex justify-between"><span>Rango sugerido (20%-40%):</span><strong>{ventaRangoTexto}</strong></div>



                                  {ventaObjetivo ? (



                                    <>



                                      <div className="flex justify-between"><span>Venta objetivo:</span><strong>{fmtSolesLocal(ventaObjetivo)}</strong></div>



                                      <div className="flex justify-between"><span>Venta objetivo (USD):</span><strong>{fmtUSD(ventaObjetivoUSD)}</strong></div>



                                      <div className="flex justify-between"><span>Margen esperado:</span><strong>{margenObjetivo != null ? `${margenObjetivo.toFixed(2)} %` : '-'}</strong></div>



                                    </>



                                  ) : null}



                                </div>



                              </div>



                            </div>



                          </div>



                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">



                            <div>



                              <div className="text-sm font-semibold mb-1">Compras del modelo</div>



                              <div className="text-xs text-gray-500 mb-2">Fechas, precio en USD y costo total (S/) ordenados del menor al mayor.</div>



                              {comprasDetalle.length ? (



                                <div className="max-h-52 overflow-auto rounded border">



                                  <table className="w-full text-xs text-gray-700">



                                    <thead className="bg-gray-50 text-gray-500">



                                      <tr>



                                        <th className="py-1 px-2 text-left">Fecha</th>



                                        <th className="py-1 px-2 text-left">Estado</th>



                                        <th className="py-1 px-2 text-left">Precio (USD)</th>



                                        <th className="py-1 px-2 text-left">Costo total (S/)</th>



                                      </tr>



                                    </thead>



                                    <tbody>



                                      {comprasDetalle.map((row) => (



                                        <tr key={`compra-${g.label}-${row.productoId}`} className="border-t">



                                          <td className="py-1 px-2">{fmtDate(row.fechaCompra)}</td>



                                          <td className="py-1 px-2 capitalize">{row.estado || '-'}</td>



                                          <td className="py-1 px-2">{fmtUSD(row.precioUSD)}</td>



                                          <td className="py-1 px-2 font-semibold">{fmtSolesLocal(row.costoTotal)}</td>



                                        </tr>



                                      ))}



                                    </tbody>



                                  </table>



                                </div>



                              ) : (



                                <div className="text-xs text-gray-500">No hay compras registradas para este grupo.</div>



                              )}



                            </div>



                            <div>



                              <div className="text-sm font-semibold mb-1">Ventas del modelo</div>



                              <div className="text-xs text-gray-500 mb-2">Precio en S/, ganancia, % y días desde la recogida hasta la venta.</div>



                              {ventasDetalle.length ? (



                                <div className="max-h-52 overflow-auto rounded border">



                                  <table className="w-full text-xs text-gray-700">



                                    <thead className="bg-gray-50 text-gray-500">



                                      <tr>



                                        <th className="py-1 px-2 text-left">Fecha venta</th>



                                        <th className="py-1 px-2 text-left">Precio (S/)</th>



                                        <th className="py-1 px-2 text-left">Ganancia</th>



                                        <th className="py-1 px-2 text-left">% margen</th>



                                        <th className="py-1 px-2 text-left">Días</th>



                                      </tr>



                                    </thead>



                                    <tbody>



                                      {ventasDetalle.map((row) => (



                                        <tr key={`venta-${g.label}-${row.ventaId}`} className="border-t">



                                          <td className="py-1 px-2">{fmtDate(row.fechaVenta)}</td>



                                          <td className="py-1 px-2">{fmtSolesLocal(row.precioVenta)}</td>



                                          <td className="py-1 px-2">{fmtSolesLocal(row.ganancia)}</td>



                                          <td className="py-1 px-2">



                                            {isFinite(Number(row.porcentaje)) ? `${Number(row.porcentaje).toFixed(2)} %` : '-'}



                                          </td>



                                          <td className="py-1 px-2">{row.dias != null ? `${row.dias} d` : '-'}</td>



                                        </tr>



                                      ))}



                                    </tbody>



                                  </table>



                                </div>



                              ) : (



                                <div className="text-xs text-gray-500">Sin ventas históricas para este grupo.</div>



                              )}



                            </div>



                          </div>



                        </div>



                      );



                    })}



                  </div>



                </>



              );



            })()}



          </div>



        )}



      </div>



    </div>



  );



}



































































