import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';



import api from '../api';
import ProfitTimeSeries from '../components/analytics/ProfitTimeSeries';
import IncomeCostProfitChart from '../components/analytics/IncomeCostProfitChart';
import MarginByMonth from '../components/analytics/MarginByMonth';
import ProfitComparison from '../components/analytics/ProfitComparison';

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





 // Filtros: mes (aplica al cambiar), vendedor y producto
 const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });
 const [sellerFilter, setSellerFilter] = useState('');
 const [compareMode, setCompareMode] = useState('month');

 const [productFilters, setProductFilters] = useState({ tipo: '', gama: '', proc: '', pantalla: '' });


 const cacheKey = useMemo(() => {



 const parts = [



 appliedDates.from || '',



 appliedDates.to || '',



 productFilters.tipo || '',



 productFilters.gama || '',



 productFilters.proc || '',



 productFilters.pantalla || '',
 sellerFilter || '',



 ].join(':');



 return `analytics:lastSummary:v3:${parts}`;



 }, [appliedDates.from, appliedDates.to, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter]);







 // Lee snapshot cacheado para render inmediato (SWR: stale-while-revalidate)



 const [data, setData] = useState(() => {



 try {



 const raw = cacheKey ? localStorage.getItem(cacheKey) : null;







 const parsed = raw ? JSON.parse(raw) : null;



 return parsed && typeof parsed === 'object' ? parsed : null;



 } catch {



 return null;



 }



});

const dataRef = useRef(data);
useEffect(() => {
dataRef.current = data;
}, [data]);

const [isStale, setIsStale] = useState(false);



 const [tab, setTab] = useState('economico'); // 'economico' | 'productos'



 const [lastUpdated, setLastUpdated] = useState(() => {



 try {



 const raw = cacheKey ? localStorage.getItem(`${cacheKey}:ts`) : null;



 return raw ? Number(raw) : null;



 } catch { return null; }



 });

 const [yearlyData, setYearlyData] = useState(null);
 const [yearlyError, setYearlyError] = useState('');

 const monthStart = (monthStr = '') => {
 if (!monthStr) return '';
 const [y, m] = monthStr.split('-').map((v) => Number(v));
 if (!y || !m) return '';
 return `${y}-${String(m).padStart(2, '0')}-01`;
 };

 const monthEnd = (monthStr = '') => {
 if (!monthStr) return '';
 const [y, m] = monthStr.split('-').map((v) => Number(v));
 if (!y || !m) return '';
 const lastDay = new Date(y, m, 0).getDate();
 return `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
 };

 const yearStart = (yearStr = '') => {
 if (!yearStr) return '';
 const y = Number(yearStr);
 if (!y) return '';
 return `${y}-01-01`;
 };

 const yearEnd = (yearStr = '') => {
 if (!yearStr) return '';
 const y = Number(yearStr);
 if (!y) return '';
 return `${y}-12-31`;
 };

 const yearKey = appliedDates.from ? appliedDates.from.split('-')[0] : String(new Date().getFullYear());
 const profitRange = useMemo(() => {
 const from = monthStart(appliedDates.from);
 const to = monthEnd(appliedDates.to);
 return { from: from || undefined, to: to || undefined };
 }, [appliedDates.from, appliedDates.to]);

 const compareRange = useMemo(() => {
 if (compareMode === 'year') {
 return { from: yearStart(yearKey), to: yearEnd(yearKey) };
 }
 if (appliedDates.from) {
 return { from: monthStart(appliedDates.from), to: monthEnd(appliedDates.to || appliedDates.from) };
 }
 return { from: yearStart(yearKey), to: yearEnd(yearKey) };
 }, [appliedDates.from, appliedDates.to, compareMode, yearKey]);

 const profitFilters = useMemo(
 () => ({
 tipo: productFilters.tipo || undefined,
 gama: productFilters.gama || undefined,
 procesador: productFilters.proc || undefined,
 pantalla: productFilters.pantalla || undefined,
 vendedor: sellerFilter || undefined,
 }),
 [productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter],
 );
 const loadYearly = useCallback(async () => {
 setYearlyError('');
 try {
 const q = new URLSearchParams();
 const fromYear = yearStart(yearKey);
 const toYear = yearEnd(yearKey);
 if (fromYear) {
 q.set('fromVenta', fromYear);
 q.set('fromCompra', fromYear);
 }
 if (toYear) {
 q.set('toVenta', toYear);
 q.set('toCompra', toYear);
 }
 if (productFilters.tipo) q.set('tipo', productFilters.tipo);
 if (productFilters.gama) q.set('gama', productFilters.gama);
 if (productFilters.proc) q.set('procesador', productFilters.proc);
 if (productFilters.pantalla) q.set('pantalla', productFilters.pantalla);
 if (sellerFilter) q.set('vendedor', sellerFilter);
 const res = await api.get(`/analytics/summary?${q.toString()}`);
 setYearlyData(res);
 } catch (e) {
 setYearlyError(e.message || 'Error');
 }
 }, [yearKey, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter]);







 const load = useCallback(async () => {



 setLoading(!dataRef.current); // si hay snapshot, no bloquear todo el layout



 setIsStale(!!dataRef.current);



 setError('');



 try {



 const q = new URLSearchParams();



 const fromDate = monthStart(appliedDates.from);



 const toDate = monthEnd(appliedDates.to);



 if (fromDate) {



 q.set('fromVenta', fromDate);



 q.set('fromCompra', fromDate);



 }



 if (toDate) {



 q.set('toVenta', toDate);



 q.set('toCompra', toDate);



 }
 if (productFilters.tipo) q.set('tipo', productFilters.tipo);



 if (productFilters.gama) q.set('gama', productFilters.gama);



 if (productFilters.proc) q.set('procesador', productFilters.proc);



 if (productFilters.pantalla) q.set('pantalla', productFilters.pantalla);
 if (sellerFilter) q.set('vendedor', sellerFilter);



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



 }, [appliedDates.from, appliedDates.to, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter, cacheKey]);







 useEffect(() => {
 load();
 }, [load]);

 useEffect(() => {
 loadYearly();
 }, [loadYearly]);







 const maxByType = useMemo(() => {



 if (!data?.inventoryByType?.length) return 0;



 return Math.max(...data.inventoryByType.map((x) => x.unidades));



 }, [data]);







 const isGeneral = !appliedDates.from && !appliedDates.to;







 return (



 <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 bg-gray-50">



 <div className="max-w-7xl mx-auto">



 <div className="flex flex-wrap gap-2 mb-3">
 <button className={`w-full sm:w-auto px-3 py-1.5 rounded border text-sm ${tab==='economico'?'bg-gray-900 text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('economico')}>Analisis economico</button>
 <button className={`w-full sm:w-auto px-3 py-1.5 rounded border text-sm ${tab==='productos'?'bg-gray-900 text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('productos')}>Analisis de productos</button>
 <button className={`w-full sm:w-auto px-3 py-1.5 rounded border text-sm ${tab==='ganancias'?'bg-gray-900 text-white':'bg-white hover:bg-gray-50'}`} onClick={()=>setTab('ganancias')}>Analisis de ganancias</button>
 </div>



 <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">



 <h1 className="text-3xl font-semibold">Analisis</h1>



 <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">



 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={sellerFilter}
 onChange={(e) => setSellerFilter(e.target.value)}
 >
 <option value="">General</option>
 <option value="Gonzalo">Gonzalo</option>
 <option value="Renato">Renato</option>
 </select>

 <input
 type="month"
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={appliedDates.from}
 onChange={(e) => {
 const v = e.target.value;
 setAppliedDates({ from: v, to: v });
 }}
 placeholder="Mes"
 />
 <button
 className="w-full sm:w-auto px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
 onClick={() => {



 setAppliedDates({ from: '', to: '' });



 setProductFilters({ tipo: '', gama: '', proc: '', pantalla: '' });
 setSellerFilter('');



 }}



 >



 Limpiar



 </button>



 <button
 onClick={() => (typeof setVista === 'function' ? setVista(analisisBack) : window.history.back())}
 className="w-full sm:w-auto px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100"
 >



 &larr; Volver



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



 <div className={`${tab !== 'economico' ? 'hidden ' : ''}grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6`}>



 <Card
 title="Inventario"
 value={
 <div className="flex items-center gap-4">
 <div className="flex flex-col">
 <span className="text-xs text-gray-500">Neto</span>
 <span>
 {data.summary?.inventoryUnsoldUnits ?? data.summary?.inventoryActiveUnits ?? '-'}
 </span>
 </div>
 <span className="text-gray-300">|</span>
 <div className="flex flex-col">
 <span className="text-xs text-gray-500">Activo</span>
 <span>{data.summary?.inventoryAvailableUnits ?? '-'}</span>
 </div>
 </div>
 }
 />



 <Card title="Capital inmovilizado" value={<Currency v={data.summary?.capitalInmovilizado} />} />



 <Card title="Capital total" value={<Currency v={data.summary?.capitalTotal} />} />



 <Card title="Rotacion (mediana)" value={`${data.summary?.rotationMedianDaysOverall ?? '-'} dias`} />



 <Card title={isGeneral ? "Margenes promedio (ult. mes)" : "Margenes promedio (mes)"} value={(() => { const rows = data.sales?.perMonth || []; const row = rows[rows.length - 1]; if (!row) return '-'; const ingresos = Number(row.ingresos || 0); const ganancia = Number(row.ganancia || 0); const costo = ingresos - ganancia; const utilidad = ingresos > 0 ? (ganancia / ingresos) * 100 : 0; const markup = costo > 0 ? (ganancia / costo) * 100 : 0; return (<span className="flex items-center gap-2"><Percent v={utilidad} /><span className="text-gray-400">/</span><Percent v={markup} /></span>); })()} sub={(() => { const rows = data.sales?.perMonth || []; const row = rows[rows.length - 1]; return row ? (<span>Ganancia: <Currency v={row.ganancia} /></span>) : null; })()} />



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



 <div className="overflow-x-auto">
 <table className="min-w-[420px] w-full text-sm">



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







 {/* Pendientes por vender (solo recogidos) vista General */}



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



 <table className="min-w-[520px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">#</th>



 <th className="py-1">Producto</th>



 <th className="py-1">Fecha compra</th>



 <th className="py-1">Dias desde recogido</th>



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



 <div className="text-xs text-gray-500">Unidades: {data.summary?.comprasPeriodoUnidades ?? 0} Capital: <Currency v={data.summary?.comprasPeriodoCapital || 0} /></div>



 </div>



 <div className="max-h-72 overflow-auto">



 <table className="min-w-[520px] w-full text-sm">



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



 <div className="text-xs text-gray-500">Vendidos y por vender segAn el mes seleccionado</div>



 </div>



 {(() => {



 // Vendidos del mes con fechaVenta, precioVenta y % ganancia



 const vendidosItems = (data?.sales?.porTipoDetalle || [])



 .flatMap((r) => (r?.vendidos?.items || []));



 // Pendientes con fechaCompra y dias desde recogido



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



 <table className="min-w-[560px] w-full text-sm">



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



 <table className="min-w-[520px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">#</th>



 <th className="py-1">Producto</th>



 <th className="py-1">Fecha compra</th>



 <th className="py-1">Dias desde recogido</th>



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







 {/* AntigAedad de inventario (general) */}



 {isGeneral && (



 <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



 <h2 className="text-lg font-semibold mb-3">Verificador de inventario por antiguedad</h2>



 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">



 <div>



 <div className="text-sm font-medium mb-1">15-29 dias</div>



 <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">



 {(data.aging?.bucket15_29 || []).map((p) => (



 <li key={`a1-${p.productoId}`} className="flex justify-between border-b py-1">



 <span>#{p.productoId} {p.display || p.tipo}</span>



 <span className="text-gray-500">{p.diasEnStock} dias</span>



 </li>



 ))}



 </ul>



 </div>



 <div>



 <div className="text-sm font-medium mb-1">30-59 dias</div>



 <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">



 {(data.aging?.bucket30_59 || []).map((p) => (



 <li key={`a2-${p.productoId}`} className="flex justify-between border-b py-1">



 <span>#{p.productoId} {p.display || p.tipo}</span>



 <span className="text-gray-500">{p.diasEnStock} dias</span>



 </li>



 ))}



 </ul>



 </div>



 <div>



 <div className="text-sm font-medium mb-1">60+ dias</div>



 <ul className="text-sm text-gray-700 space-y-1 max-h-56 overflow-auto">



 {(data.aging?.bucket60_plus || []).map((p) => (



 <li key={`a3-${p.productoId}`} className="flex justify-between border-b py-1">



 <span>#{p.productoId} {p.display || p.tipo}</span>



 <span className="text-gray-500">{p.diasEnStock} dias</span>



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
 <div className="overflow-x-auto">
 <table className="min-w-[520px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">Mes</th>



 <th className="py-1">Ingresos</th>



 <th className="py-1">Ganancia</th>



 <th className="py-1">Margenes (Utilidad / Markup)</th>



 </tr>



 </thead>



 <tbody>



 {(data.sales?.perMonth || []).map((m) => (



 <tr key={m.month} className="border-t">



 <td className="py-1">{m.month}</td>



 <td className="py-1"><Currency v={m.ingresos} /></td>



 <td className="py-1"><Currency v={m.ganancia} /></td>



 <td className="py-1">{(() => { const ingresos = Number(m.ingresos || 0); const ganancia = Number(m.ganancia || 0); const costo = ingresos - ganancia; const utilidad = ingresos > 0 ? (ganancia / ingresos) * 100 : 0; const markup = costo > 0 ? (ganancia / costo) * 100 : 0; return (<span className="flex items-center gap-2"><Percent v={utilidad} /><span className="text-gray-400">/</span><Percent v={markup} /></span>); })()}</td>



 </tr>



 ))}



 </tbody>



 </table>
 </div>



 </div>



 ) : null}

 {tab === 'ganancias' && (
 <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
 <h2 className="text-lg font-semibold mb-3">Resumen de ganancias</h2>
 {(() => {
 const perMonth = data?.sales?.perMonth || [];
 const perYearMonth = yearlyData?.sales?.perMonth || [];
 const monthKey = appliedDates.from || '';
 const perYear = perYearMonth.filter((m) => String(m.month || '').startsWith(`${yearKey}-`));
 const totalIngresos = perYear.reduce((s, m) => s + (Number(m.ingresos) || 0), 0);
 const totalGanancia = perYear.reduce((s, m) => s + (Number(m.ganancia) || 0), 0);
 const totalCosto = totalIngresos - totalGanancia;
 const totalUtilidad = totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : 0;
 const totalMarkup = totalCosto > 0 ? (totalGanancia / totalCosto) * 100 : 0;
 const monthRow = monthKey ? perMonth.find((m) => m.month === monthKey) : null;
 const monthIngresos = monthRow ? Number(monthRow.ingresos || 0) : null;
 const monthGanancia = monthRow ? Number(monthRow.ganancia || 0) : null;
 const monthCosto = monthIngresos != null && monthGanancia != null ? (monthIngresos - monthGanancia) : null;
 const monthUtilidad = monthRow && monthIngresos ? (monthGanancia / monthIngresos) * 100 : null;
 const monthMarkup = monthRow && monthCosto ? (monthGanancia / monthCosto) * 100 : null;
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <Card
 title={`Ganancia ${yearKey}`}
 value={<Currency v={totalGanancia} />}
 sub={
 yearlyError
 ? <span className="text-red-600">{yearlyError}</span>
 : <span>Ingresos: <Currency v={totalIngresos} /> - Utilidad: <Percent v={totalUtilidad} /> - Markup: <Percent v={totalMarkup} /></span>
 }
 />
 <Card
 title={monthKey ? `Ganancia ${monthKey}` : 'Selecciona un mes'}
 value={monthRow ? <Currency v={monthGanancia} /> : '-'}
 sub={
 monthRow
 ? <span>Ingresos: <Currency v={monthIngresos} /> - Utilidad: <Percent v={monthUtilidad} /> - Markup: <Percent v={monthMarkup} /></span>
 : <span>Usa el filtro de mes para ver el detalle.</span>
 }
 />
 </div>
 );
 })()}
 </div>
 )}

 {tab === 'ganancias' && (
 <div className="mb-6">
 <ProfitComparison
 from={compareRange.from}
 to={compareRange.to}
 filters={profitFilters}
 mode={compareMode}
 onModeChange={setCompareMode}
 />
 </div>
 )}

 {tab === 'ganancias' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
 <ProfitTimeSeries from={profitRange.from} to={profitRange.to} filters={profitFilters} />
 <IncomeCostProfitChart from={profitRange.from} to={profitRange.to} filters={profitFilters} />
 <div className="lg:col-span-2">
 <MarginByMonth from={profitRange.from} to={profitRange.to} filters={profitFilters} />
 </div>
 </div>
 )}

 {/* Logistica */}



 <div className={`${tab !== 'economico' ? 'hidden ' : ''}bg-white rounded-xl border shadow-sm p-5 mb-6`}>



 <h2 className="text-lg font-semibold mb-3">Logistica</h2>



 <div className="grid grid-cols-1 md:grid-cols-5 gap-6">



 <div>



 <div className="text-sm font-medium mb-2">Tiempo compra ? recepcion</div>



 <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraARecepcion?.mean ?? '-'} dias</div>



 <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraARecepcion?.median ?? '-'} dias</div>



 </div>



 <div>



 <div className="text-sm font-medium mb-2">Tiempo compra ? recojo</div>



 <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraARecogido?.mean ?? '-'} dias</div>



 <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraARecogido?.median ?? '-'} dias</div>



 </div>



 <div>



 <div className="text-sm font-medium mb-2">Tiempo recepcion ? recojo</div>



 <div className="text-sm text-gray-700">Promedio: {data.logistica?.recepcionARecogido?.mean ?? '-'} dias</div>



 <div className="text-sm text-gray-700">Mediana: {data.logistica?.recepcionARecogido?.median ?? '-'} dias</div>



 </div>



 <div>



 <div className="text-sm font-medium mb-2">Tiempo recojo ? venta</div>



 <div className="text-sm text-gray-700">Promedio: {data.logistica?.recogidoAVenta?.mean ?? '-'} dias</div>



 <div className="text-sm text-gray-700">Mediana: {data.logistica?.recogidoAVenta?.median ?? '-'} dias</div>



 </div>



 <div>



 <div className="text-sm font-medium mb-2">Tiempo compra ? venta</div>



 <div className="text-sm text-gray-700">Promedio: {data.logistica?.compraAVenta?.mean ?? '-'} dias</div>



 <div className="text-sm text-gray-700">Mediana: {data.logistica?.compraAVenta?.median ?? '-'} dias</div>



 </div>



 </div>



 <div className="mt-6">



 <h3 className="text-md font-semibold mb-2">Promedios por tipo</h3>



 <div className="max-h-64 overflow-auto">



 <table className="min-w-[680px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">Tipo</th>



 <th className="py-1">Compra / Recepcion</th>



 <th className="py-1">Compra / Recojo</th>



 <th className="py-1">Recepcion / Recojo</th>



 <th className="py-1">Recojo / Venta</th>



 <th className="py-1">Compra / Venta</th>



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



 <div className="text-sm font-medium mb-2">Tardios por transportista</div>



 <div className="max-h-40 overflow-auto">



 <table className="min-w-[420px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">Transportista</th>



 <th className="py-1">Tardios %</th>



 <th className="py-1">Mediana dias</th>



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



 <div className="text-sm font-medium mb-2">Desempeno por casillero</div>



 <div className="max-h-40 overflow-auto">



 <table className="min-w-[420px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">Casillero</th>



 <th className="py-1">Tardios %</th>



 <th className="py-1">Mediana dias</th>



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



 <span>#{v.id} {v.display || v.tipo}</span>



 <span className="text-gray-500"><Percent v={v.margen} /></span>



 </li>



 ))}



 </ul>



 </div>



 <div className="bg-white rounded-xl border shadow-sm p-5">



 <h2 className="text-lg font-semibold mb-3">Alertas: transito prolongado</h2>



 <ul className="text-sm text-gray-700 space-y-1 max-h-72 overflow-auto">



 {(data.alerts?.transitLongItems || []).map((p, i) => (



 <li key={`tl-${p.productoId}-${i}`} className="flex justify-between border-b py-1">



 <span>#{p.productoId} {p.display || p.tipo} {p.estado}</span>



 <span className="text-gray-500">{p.dias} dias</span>



 </li>



 ))}



 </ul>



 </div>



 </div>



 </>



 )}







 {/* Analisis de productos (MacBook) */}



 {tab === 'productos' && (



 <div className="bg-white rounded-xl border shadow-sm p-5 mb-10">



 <h2 className="text-lg font-semibold mb-4">Analisis de productos</h2>



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



 <div className="flex flex-wrap gap-3 mb-4 items-end">
 <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">Tipo
 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={productFilters.tipo}
 onChange={(e)=> setProductFilters((s)=>({ ...s, tipo: e.target.value, gama: '', proc: '', pantalla: '' }))}
 >



 <option value="">Todos los tipos</option>



 <option value="macbook">MacBook</option>



 <option value="iphone">iPhone</option>



 <option value="ipad">iPad</option>



 <option value="watch">Apple Watch</option>



 <option value="otro">Otro</option>



 </select>
 </label>

 <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">Gama
 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={productFilters.gama}
 onChange={(e)=> setProductFilters((s)=>({ ...s, gama: e.target.value }))}
 >



 <option value="">Todas</option>



 {gamas.map(x=> <option key={x} value={x}>{x}</option>)}



 </select>
 </label>

 <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">Procesador
 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={productFilters.proc}
 onChange={(e)=> setProductFilters((s)=>({ ...s, proc: e.target.value }))}
 >



 <option value="">Todos</option>



 {procs.map(x=> <option key={x} value={x}>{x}</option>)}



 </select>
 </label>

 <label className="text-sm flex flex-col gap-1 w-full sm:w-auto">Pantalla
 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
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
 (a, b) => {
   const ta = a?.fechaCompra ? Date.parse(a.fechaCompra) : 0;
   const tb = b?.fechaCompra ? Date.parse(b.fechaCompra) : 0;
   if (ta && tb) return ta - tb;
   return ta - tb;
 },
);



 const ventasDetalleRaw = [...(g.ventasDetalle || [])];
 const ventasByProducto = new Map(ventasDetalleRaw.map((v) => [v.productoId, v]));
 const ventasDetalle = comprasDetalle.map((c) => ventasByProducto.get(c.productoId) || null);



 const ventaRef = (() => {



 const precios = ventasDetalleRaw.map((v) => Number(v?.precioVenta || 0)).filter((n) => isFinite(n) && n > 0);



 return medianLocal(precios) || Number(g.ventas?.p50 || 0) || null;



 })();



 const costoRef = (() => {



 const costos = comprasDetalle.map((c) => Number(c?.costoTotal || 0)).filter((n) => isFinite(n) && n > 0);



 if (costos.length) return +(costos.reduce((s, n) => s + n, 0) / costos.length).toFixed(2);



 return Number(g.compras?.mean || 0) || null;



 })();



 const preciosUSD = comprasDetalle.map((c) => Number(c?.precioUSD || 0)).filter((n) => isFinite(n) && n > 0);



 const promedioUSD = avgLocal(preciosUSD);



 const ventaPromedio = avgLocal(ventasDetalleRaw.map((v) => Number(v?.precioVenta || 0)).filter((n) => isFinite(n) && n > 0));



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



 Variantes: RAM {g.ramDistinct?.join(', ') || '-'} SSD {g.ssdDistinct?.join(', ') || '-'}



 </div>



 <div className="text-xs text-gray-500">



 Promedios historicos: compra <Currency v={g.compras?.mean} /> - venta <Currency v={g.ventas?.mean} /> - margen <Percent v={g.ventas?.margenPromedio || 0} />



 </div>



 </div>



 <div className="w-full lg:w-auto rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-gray-700">



 <div className="font-semibold text-gray-800">Recomendacion</div>



 <div className="text-xs text-gray-600">Basado en lo que se pago (USD) y se vendio (S/) para mantener margenes del 20%-40%.</div>



 <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">



 <div className="rounded border border-emerald-200 bg-white/50 p-2 space-y-1">



 <div className="text-xs uppercase text-gray-500">Compra objetivo (USD)</div>



 <div className="flex justify-between"><span>Promedio pagado:</span><strong>{fmtUSD(promedioUSD)}</strong></div>



 <div className="flex justify-between"><span>Rango sugerido (20%-40%):</span><strong>{compraRangoUSD}</strong></div>



 <div className="flex justify-between"><span>TC usado:</span><strong>{tcReferencia ? tcReferencia.toFixed(2) : '-'}</strong></div>



 </div>



 <div className="rounded border border-blue-200 bg-white/50 p-2 space-y-1">



 <div className="text-xs uppercase text-gray-500">Venta objetivo (S/)</div>



 <div className="flex justify-between"><span>Ventas historicas:</span><strong>{ventaBaseHist ? fmtSolesLocal(ventaBaseHist) : '-'}</strong></div>



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



 <div>
 <div className="text-sm font-semibold mb-1">Compras y ventas del modelo</div>
<div className="text-xs text-gray-500 mb-2">Compras ordenadas por fecha y su venta correspondiente en la misma fila.</div>
 {(comprasDetalle.length || ventasDetalle.length) ? (
 <div className="max-h-64 overflow-auto rounded border">
 <table className="min-w-[900px] w-full text-xs text-gray-700">
 <thead className="bg-gray-50 text-gray-500">
 <tr>
 <th className="py-1 px-2 text-left" colSpan={4}>Compras</th>
 <th className="py-1 px-2 text-left" colSpan={5}>Ventas</th>
 </tr>
 <tr>
 <th className="py-1 px-2 text-left">Fecha</th>
 <th className="py-1 px-2 text-left">Estado</th>
 <th className="py-1 px-2 text-left">Precio (USD)</th>
 <th className="py-1 px-2 text-left">Costo total (S/)</th>
 <th className="py-1 px-2 text-left">Fecha venta</th>
 <th className="py-1 px-2 text-left">Precio (S/)</th>
 <th className="py-1 px-2 text-left">Ganancia</th>
 <th className="py-1 px-2 text-left">% margen</th>
 <th className="py-1 px-2 text-left">Dias</th>
 </tr>
 </thead>
 <tbody>
 {comprasDetalle.map((row, rowIdx) => {
 const venta = ventasDetalle[rowIdx];
 return (
 <tr key={`compra-venta-${g.label}-${row.productoId}`} className="border-t">
 <td className="py-1 px-2">{fmtDate(row.fechaCompra)}</td>
 <td className="py-1 px-2 capitalize">{row.estado || '-'}</td>
 <td className="py-1 px-2">{fmtUSD(row.precioUSD)}</td>
 <td className="py-1 px-2 font-semibold">{fmtSolesLocal(row.costoTotal)}</td>
 <td className="py-1 px-2">{venta ? fmtDate(venta.fechaVenta) : '-'}</td>
 <td className="py-1 px-2">{venta ? fmtSolesLocal(venta.precioVenta) : '-'}</td>
 <td className="py-1 px-2">{venta ? fmtSolesLocal(venta.ganancia) : '-'}</td>
 <td className="py-1 px-2">{venta && isFinite(Number(venta.porcentaje)) ? `${Number(venta.porcentaje).toFixed(2)} %` : '-'}</td>
 <td className="py-1 px-2">{venta && venta.dias != null ? `${venta.dias} d` : '-'}</td>
 </tr>
 );
 })}
 {!comprasDetalle.length && ventasDetalle.length ? (
 <tr className="border-t">
 <td className="py-2 px-2 text-center text-gray-500" colSpan={9}>No hay compras registradas para este grupo.</td>
 </tr>
 ) : null}
 </tbody>
 </table>
 </div>
 ) : (
 <div className="text-xs text-gray-500">No hay compras ni ventas registradas para este grupo.</div>
 )}
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






































