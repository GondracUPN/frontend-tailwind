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







function Bar({ label, value, max, subValue = null, totalBase = null }) {
 const total = Number(value || 0);
 const activeRaw = subValue == null ? null : Number(subValue || 0);
 const active = activeRaw == null ? null : Math.max(0, Math.min(total, activeRaw));
 const baseTotal = Number(totalBase || 0) > 0 ? Number(totalBase) : Number(max || 0);
 const pct = baseTotal ? Math.min(100, Math.round((total / baseTotal) * 100)) : 0;
 const activePctOnBought = (active != null && total > 0) ? Math.min(100, Math.round((active / total) * 100)) : 0;
 const subPct = active != null ? Math.round((pct * activePctOnBought) / 100) : 0;
 return (
 <div className="mb-4 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2">
 <div className="flex items-start justify-between gap-3 mb-2">
 <div className="text-sm font-medium text-slate-700">{label}</div>
 <div className="flex items-center gap-2 shrink-0">
 <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[11px] font-semibold">
 T: {total}
 </span>
 {active != null && (
 <span className="inline-flex items-center rounded-full bg-sky-100 text-sky-700 px-2 py-0.5 text-[11px] font-semibold">
 A: {active}
 </span>
 )}
 </div>
 </div>
 <div className="h-3 rounded-full bg-emerald-50 border border-emerald-100 relative overflow-hidden">
 <div
 className="h-3 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 transition-all duration-500"
 style={{ width: `${pct}%` }}
 />
 {active != null && (
 <div
 className="h-3 rounded-full absolute left-0 top-0 bg-gradient-to-r from-emerald-200 to-teal-200 transition-all duration-500"
 style={{ width: `${subPct}%` }}
 />
 )}
 </div>
 <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
 <span>Total: {pct}%</span>
 {active != null ? <span>Activo: {activePctOnBought}%</span> : <span>&nbsp;</span>}
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



 const fmtSignedSoles = (value) => {

 const n = Number(value);

 if (!isFinite(n)) return '-';

 const sign = n > 0 ? '+' : '';

 return `${sign}${fmtSolesLocal(n)}`;

};



const medianLocal = (arr) => {



 const clean = (arr || []).filter((n) => isFinite(n) && n > 0).sort((a, b) => a - b);



 if (!clean.length) return null;



 const mid = Math.floor(clean.length / 2);



 if (clean.length % 2 === 1) return clean[mid];



 return (clean[mid - 1] + clean[mid]) / 2;



 };



 const normalizeEstado = (value) => {

 const s = value == null ? '' : String(value);

 return s.trim().toLowerCase();

};

const applyEstadoFilter = (series = [], estado) => {

 const key = normalizeEstado(estado);

 if (!key || key === 'todos') return series;

 return series.filter((p) => normalizeEstado(p?.estado) === key);

};

const countEstados = (series = []) => {

 const counts = { nuevo: 0, usado: 0, total: 0 };

 series.forEach((p) => {

  counts.total += 1;

  const e = normalizeEstado(p?.estado);

  if (e === 'nuevo') counts.nuevo += 1;

  if (e === 'usado') counts.usado += 1;

 });

 return counts;

};






const avgLocal = (arr = []) => {



 const clean = arr.filter((n) => isFinite(n) && n > 0);



 if (!clean.length) return null;



 return +(clean.reduce((s, n) => s + n, 0) / clean.length).toFixed(2);



 };



 const quantileLocal = (arr, q) => {

 const clean = (arr || []).filter((n) => isFinite(n)).sort((a, b) => a - b);

 if (!clean.length) return null;

 const pos = (clean.length - 1) * q;

 const base = Math.floor(pos);

 const rest = pos - base;

 if (clean[base + 1] !== undefined) return clean[base] + rest * (clean[base + 1] - clean[base]);

 return clean[base];

};

const sanitizeSeries = (series = []) => {

 const vals = series.map((p) => p.val).filter((v) => isFinite(v));

 if (vals.length < 4) return { series: series.slice(), removed: 0, bounds: null };

 const q1 = quantileLocal(vals, 0.25);

 const q3 = quantileLocal(vals, 0.75);

 if (q1 == null || q3 == null) return { series: series.slice(), removed: 0, bounds: null };

 const iqr = Math.max(1, q3 - q1);

 const lower = q1 - 1.5 * iqr;

 const upper = q3 + 1.5 * iqr;

 const filtered = series.filter((p) => p.val >= lower && p.val <= upper);

 return { series: filtered, removed: Math.max(0, series.length - filtered.length), bounds: { lower, upper } };

};

const buildTrendStats = (series = []) => {

 if (series.length < 2) return null;

 const first = series[0];

 const last = series[series.length - 1];

 const days = Math.max(1, Math.round((last.ts - first.ts) / (1000 * 60 * 60 * 24)));

 const change = +(last.val - first.val).toFixed(2);

 const per30 = +((change / days) * 30).toFixed(2);

 return { change, days, per30 };

};

const buildSpreadStats = (costSeries = [], saleSeries = []) => {

 const costVals = costSeries.map((p) => p.val).filter((v) => isFinite(v) && v > 0);

 const saleVals = saleSeries.map((p) => p.val).filter((v) => isFinite(v) && v > 0);

 const costMedian = medianLocal(costVals);

 const saleMedian = medianLocal(saleVals);

 if (!isFinite(costMedian) || !isFinite(saleMedian)) return null;

 const spread = +(saleMedian - costMedian).toFixed(2);

 const pct = costMedian ? +((spread / costMedian) * 100).toFixed(2) : null;

 return { costMedian, saleMedian, spread, pct };

};



const roundUp10 = (value) => {



 const n = Number(value);



 if (!isFinite(n)) return null;



 return Math.ceil(n / 10) * 10;



 };

 const buildSeries = (rows = [], { dateKey, valueKey } = {}) => {
  return rows
   .map((row) => {
    const rawDate = row?.[dateKey];
    const rawVal = row?.[valueKey];
    const ts = rawDate ? Date.parse(rawDate) : NaN;
    const val = Number(rawVal);
    if (!isFinite(ts) || !isFinite(val) || val <= 0) return null;
    return {
     ts,
     val,
     date: rawDate,
     productoId: row?.productoId ?? null,
     estado: normalizeEstado(row?.estado),
    };
   })
   .filter(Boolean)
   .sort((a, b) => a.ts - b.ts);
 };

 const buildDropStats = (series = []) => {
  const drops = [];
  for (let i = 1; i < series.length; i += 1) {
   const prev = series[i - 1];
   const cur = series[i];
   if (cur.val < prev.val) {
    const days = Math.max(1, Math.round((cur.ts - prev.ts) / (1000 * 60 * 60 * 24)));
    drops.push({ from: prev, to: cur, days, delta: prev.val - cur.val });
   }
  }
  const count = drops.length;
  const avgDays = count ? Math.round(drops.reduce((s, d) => s + d.days, 0) / count) : 0;
  const avgDrop = count ? +(drops.reduce((s, d) => s + d.delta, 0) / count).toFixed(2) : 0;
  return { count, avgDays, avgDrop, drops };
 };



 const [loading, setLoading] = useState(true);



 const [error, setError] = useState('');





 // Filtros: mes/anio (aplica al cambiar), vendedor y producto
 const [dateMode, setDateMode] = useState('month');
 const [appliedDates, setAppliedDates] = useState({ from: '', to: '' });
 const [sellerFilter, setSellerFilter] = useState('');
 const [compareMode, setCompareMode] = useState('month');

 const [productFilters, setProductFilters] = useState({ tipo: '', gama: '', proc: '', pantalla: '' });


 const cacheKey = useMemo(() => {



 const parts = [
 dateMode,



 appliedDates.from || '',



 appliedDates.to || '',



 productFilters.tipo || '',



 productFilters.gama || '',



 productFilters.proc || '',



 productFilters.pantalla || '',
 sellerFilter || '',



 ].join(':');



 return `analytics:lastSummary:v3:${parts}`;



 }, [dateMode, appliedDates.from, appliedDates.to, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter]);







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
 const [curvaModal, setCurvaModal] = useState({
  open: false,
  title: '',
  costSeries: [],
  saleSeries: [],
  costSeriesRaw: [],
  saleSeriesRaw: [],
  comprasDetalleRaw: [],
  costStats: null,
  saleStats: null,
  saleTrend: null,
  estadoFiltro: "todos",
  estadoCounts: { nuevo: 0, usado: 0 },
 });

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

 const openCurvaModal = ({ title, costSeries, saleSeries, comprasDetalle }) => {
  const counts = countEstados(comprasDetalle || []);
  const estadoFiltro = counts.nuevo || counts.usado
   ? (counts.nuevo >= counts.usado ? 'nuevo' : 'usado')
   : 'todos';
  setCurvaModal({
    open: true,
    title,
    costSeries,
    saleSeries,
    costSeriesRaw: costSeries,
    saleSeriesRaw: saleSeries,
    comprasDetalleRaw: comprasDetalle || [],
    estadoFiltro,
    estadoCounts: counts,
  });
 };

 const curvaDerived = (() => {
  const selectedEstado = curvaModal.estadoFiltro || 'todos';
  const costAll = curvaModal.costSeriesRaw || curvaModal.costSeries || [];
  const comprasAll = curvaModal.comprasDetalleRaw || [];
  const saleAll = curvaModal.saleSeriesRaw || curvaModal.saleSeries || [];
  let costFiltered = applyEstadoFilter(costAll, selectedEstado);
  let saleFiltered = applyEstadoFilter(saleAll, selectedEstado);
  const comprasFiltered = applyEstadoFilter(comprasAll, selectedEstado);
  let usedFallback = false;
  if (selectedEstado !== 'todos' && costFiltered.length === 0 && saleFiltered.length > 0) {
    const ids = new Set(saleFiltered.map((p) => p.productoId).filter(Boolean));
    if (ids.size) {
      costFiltered = costAll.filter((p) => ids.has(p.productoId));
      usedFallback = true;
    }
  }
  const costClean = sanitizeSeries(costFiltered);
  const saleClean = sanitizeSeries(saleFiltered);
  const costSeriesClean = costClean.series;
  const saleSeriesClean = saleClean.series;
  return {
    selectedEstado,
    costSeries: costSeriesClean,
    saleSeries: saleSeriesClean,
    costOutliers: costClean.removed,
    saleOutliers: saleClean.removed,
    spreadStats: buildSpreadStats(costSeriesClean, saleSeriesClean),
    costTrend: buildTrendStats(costSeriesClean),
    saleTrend: buildTrendStats(saleSeriesClean),
    costStats: buildDropStats(costSeriesClean),
    saleStats: buildDropStats(saleSeriesClean),
    costCount: costSeriesClean.length,
    saleCount: saleSeriesClean.length,
    costCountRaw: costFiltered.length,
    saleCountRaw: saleFiltered.length,
    comprasCountRaw: comprasFiltered.length,
    usedFallback,
  };
})();
const estadoCounts = curvaModal.estadoCounts || { nuevo: 0, usado: 0 };
const estadoOptions = [
  { key: 'todos', label: 'Todos', count: estadoCounts.total ?? (estadoCounts.nuevo + estadoCounts.usado) },
  { key: 'nuevo', label: 'Nuevo', count: estadoCounts.nuevo },
  { key: 'usado', label: 'Usado', count: estadoCounts.usado },
];
const renderCurvaChart = (costSeries, saleSeries) => {
  const all = [...(costSeries || []), ...(saleSeries || [])];
  if (!all.length) {
    return <div className="text-sm text-gray-500">No hay datos suficientes para graficar.</div>;
  }
  const width = 720;
  const height = 300;
  const pad = 42;
  const minX = Math.min(...all.map((p) => p.ts));
  const maxX = Math.max(...all.map((p) => p.ts));
  const minY = Math.min(...all.map((p) => p.val));
  const maxY = Math.max(...all.map((p) => p.val));
  const rangeX = Math.max(1, maxX - minX);
  const rangeY = Math.max(1, maxY - minY);
  const padY = rangeY * 0.12;
  const minYAdj = minY - padY;
  const maxYAdj = maxY + padY;
  const rangeYAdj = Math.max(1, maxYAdj - minYAdj);
  const x = (ts) => pad + ((ts - minX) / rangeX) * (width - pad * 2);
  const y = (val) => height - pad - ((val - minYAdj) / rangeYAdj) * (height - pad * 2);
  const buildPath = (series) => {
    if (!series.length) return '';
    return series
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${x(p.ts).toFixed(2)} ${y(p.val).toFixed(2)}`)
      .join(' ');
  };const buildArea = (series) => {
    if (!series.length) return '';
    const baseY = height - pad;
    const head = series
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${x(p.ts).toFixed(2)} ${y(p.val).toFixed(2)}`)
      .join(' ');
    const tail = `L ${x(series[series.length - 1].ts).toFixed(2)} ${baseY.toFixed(2)} L ${x(series[0].ts).toFixed(2)} ${baseY.toFixed(2)} Z`;
    return `${head} ${tail}`;
  };
  const costPath = buildPath(costSeries || []);
  const salePath = buildPath(saleSeries || []);
  const costArea = buildArea(costSeries || []);
  const saleArea = buildArea(saleSeries || []);
  const gridY = 5;
  const gridX = 6;
  const yTicks = Array.from({ length: gridY + 1 }, (_, i) => minYAdj + (rangeYAdj * i) / gridY);
  const xTicks = Array.from({ length: gridX + 1 }, (_, i) => minX + (rangeX * i) / gridX);
  const labelY = (val) => fmtSolesLocal(val).replace('S/', 'S/');
  const minLabel = fmtDate(new Date(minX));
  const maxLabel = fmtDate(new Date(maxX));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 rounded-xl border border-slate-200 bg-white shadow-sm">
      <defs>
        <linearGradient id="costArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="saleArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <clipPath id="chartClip">
          <rect x={pad} y={pad} width={width - pad * 2} height={height - pad * 2} rx="10" />
        </clipPath>
      </defs>

      <rect x="8" y="8" width={width - 16} height={height - 16} rx="16" fill="#f8fafc" />

      {yTicks.map((val, idx) => (
        <g key={`gridy-${idx}`}>
          <line
            x1={pad}
            y1={y(val)}
            x2={width - pad}
            y2={y(val)}
            stroke="#e2e8f0"
            strokeDasharray="4 6"
          />
          <text x={12} y={y(val) + 4} fontSize="10" fill="#94a3b8">
            {labelY(val)}
          </text>
        </g>
      ))}

      {xTicks.map((val, idx) => (
        <line
          key={`gridx-${idx}`}
          x1={x(val)}
          y1={pad}
          x2={x(val)}
          y2={height - pad}
          stroke="#f1f5f9"
        />
      ))}

      <g clipPath="url(#chartClip)">
        {costArea && <path d={costArea} fill="url(#costArea)" />}
        {saleArea && <path d={saleArea} fill="url(#saleArea)" />}
        {costPath && (
          <path d={costPath} fill="none" stroke="#10b981" strokeWidth="2.6" filter="url(#softGlow)" />
        )}
        {salePath && (
          <path d={salePath} fill="none" stroke="#6366f1" strokeWidth="2.6" filter="url(#softGlow)" />
        )}
        {(costSeries || []).map((p, idx) => (
          <circle key={`c-${idx}`} cx={x(p.ts)} cy={y(p.val)} r="4" fill="#10b981" stroke="#ffffff" strokeWidth="2"><title>{`Compra: ${fmtSolesLocal(p.val)} | ${fmtDate(p.date)}`}</title></circle>
        ))}
        {(saleSeries || []).map((p, idx) => (
          <circle key={`s-${idx}`} cx={x(p.ts)} cy={y(p.val)} r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="2"><title>{`Venta: ${fmtSolesLocal(p.val)} | ${fmtDate(p.date)}`}</title></circle>
        ))}
      </g>

      <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#cbd5f5" />
      <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#cbd5f5" />

      <text x={pad} y={height - 12} fontSize="10" fill="#94a3b8">{minLabel}</text>
      <text x={width - pad} y={height - 12} textAnchor="end" fontSize="10" fill="#94a3b8">
        {maxLabel}
      </text>
    </svg>
  );
 };

 const yearKey = dateMode === 'year' && appliedDates.from
 ? appliedDates.from
 : (appliedDates.from ? appliedDates.from.split('-')[0] : String(new Date().getFullYear()));
 const profitRange = useMemo(() => {
 const from = dateMode === 'year' ? yearStart(yearKey) : monthStart(appliedDates.from);
 const to = dateMode === 'year' ? yearEnd(yearKey) : monthEnd(appliedDates.to);
 return { from: from || undefined, to: to || undefined };
 }, [appliedDates.from, appliedDates.to, dateMode, yearKey]);

 const compareRange = useMemo(() => {
 if (dateMode === 'year' || compareMode === 'year') {
 return { from: yearStart(yearKey), to: yearEnd(yearKey) };
 }
 if (appliedDates.from) {
 return { from: monthStart(appliedDates.from), to: monthEnd(appliedDates.to || appliedDates.from) };
 }
 return { from: yearStart(yearKey), to: yearEnd(yearKey) };
 }, [appliedDates.from, appliedDates.to, compareMode, dateMode, yearKey]);

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



 const fromDate = dateMode === 'year' ? yearStart(yearKey) : monthStart(appliedDates.from);



 const toDate = dateMode === 'year' ? yearEnd(yearKey) : monthEnd(appliedDates.to);



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



 }, [appliedDates.from, appliedDates.to, dateMode, yearKey, productFilters.tipo, productFilters.gama, productFilters.proc, productFilters.pantalla, sellerFilter, cacheKey]);







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

 const generalInvRows = useMemo(() => {
 const rows = (data?.inventoryByType || []).map((x) => ({
 tipo: x.tipo,
 unidades: Number(x.unidades || 0),
 activos: Number(x.unidades || 0),
 capital: Number(x.capital || 0),
 }));
 return rows;
 }, [data?.inventoryByType]);

 const generalInvTotalUnits = useMemo(
 () => generalInvRows.reduce((s, x) => s + (Number(x.unidades || 0) || 0), 0),
 [generalInvRows],
 );

 const yearMonthKeyFromCompras = useMemo(() => {
 if (dateMode !== 'year') return '';
 const keys = (data?.comprasPeriodo || [])
 .map((p) => String(p?.fechaCompra || '').slice(0, 7))
 .filter((m) => /^\d{4}-\d{2}$/.test(m));
 if (!keys.length) return '';
 keys.sort();
 return keys[keys.length - 1];
 }, [dateMode, data?.comprasPeriodo]);

 const comprasDelMesEnYear = useMemo(() => {
 const all = data?.comprasPeriodo || [];
 if (dateMode !== 'year') return all;
 if (!yearMonthKeyFromCompras) return [];
 return all.filter((p) => String(p?.fechaCompra || '').slice(0, 7) === yearMonthKeyFromCompras);
 }, [dateMode, data?.comprasPeriodo, yearMonthKeyFromCompras]);

 const comprasPeriodoVista = useMemo(() => {
 if (dateMode === 'year') return comprasDelMesEnYear;
 return data?.comprasPeriodo || [];
 }, [dateMode, comprasDelMesEnYear, data?.comprasPeriodo]);

 const comprasPeriodoVistaResumen = useMemo(() => {
 const rows = comprasPeriodoVista || [];
 const unidades = rows.length;
 const activos = (() => {
 const key = dateMode === 'year' ? yearMonthKeyFromCompras : appliedDates.from;
 const list = (data?.noVendidosDelPeriodo || []).filter((p) => {
 if (!key) return true;
 return String(p?.fechaCompra || '').slice(0, 7) === key;
 });
 return list.length;
 })();
 const capital = rows.reduce((sum, p) => sum + (Number(p?.costoTotal || 0) || 0), 0);
 return { unidades, activos, capital };
 }, [comprasPeriodoVista, data?.noVendidosDelPeriodo, dateMode, yearMonthKeyFromCompras, appliedDates.from]);

 const inventarioTipoComprasVista = useMemo(() => {
 const key = dateMode === 'year' ? yearMonthKeyFromCompras : appliedDates.from;
 const activosSet = new Set(
 (data?.noVendidosDelPeriodo || [])
 .filter((p) => {
 if (!key) return true;
 return String(p?.fechaCompra || '').slice(0, 7) === key;
 })
 .map((p) => p?.productoId)
 .filter(Boolean)
 );
 const map = new Map();
 for (const p of comprasPeriodoVista || []) {
 const tipo = String(p?.tipo || 'otro').toLowerCase() || 'otro';
 const prev = map.get(tipo) || { tipo, unidades: 0, activos: 0, capital: 0 };
 prev.unidades += 1;
 if (activosSet.has(p?.productoId)) prev.activos += 1;
 prev.capital += Number(p?.costoTotal || 0) || 0;
 map.set(tipo, prev);
 }
 return Array.from(map.values()).sort((a, b) => b.unidades - a.unidades);
 }, [comprasPeriodoVista, data?.noVendidosDelPeriodo, dateMode, yearMonthKeyFromCompras, appliedDates.from]);

 const comprasPeriodoVistaLabel = useMemo(() => {
 if (dateMode === 'year') {
 return yearMonthKeyFromCompras ? `Mes: ${yearMonthKeyFromCompras}` : `A${'\u00f1'}o: ${appliedDates.from || yearKey}`;
 }
 return appliedDates.from ? `Mes: ${appliedDates.from}` : 'Mes seleccionado';
 }, [dateMode, yearMonthKeyFromCompras, appliedDates.from, yearKey]);







 const isGeneral = !appliedDates.from && !appliedDates.to;







 return (
 <> 



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

 <select
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={dateMode}
 onChange={(e) => {
 const v = e.target.value;
 setDateMode(v);
 if (v === 'year') {
 const y = String(new Date().getFullYear());
 setAppliedDates({ from: y, to: y });
 } else {
 setAppliedDates({ from: '', to: '' });
 }
 }}
 >
 <option value="month">Mes</option>
 <option value="year">A{'\u00f1'}o</option>
 </select>

 {dateMode === 'month' ? (
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
 ) : (
 <input
 type="number"
 className="border rounded px-2 py-1 text-sm w-full sm:w-auto"
 value={appliedDates.from || String(new Date().getFullYear())}
 onChange={(e) => {
 const v = e.target.value;
 setAppliedDates({ from: v, to: v });
 }}
 placeholder={`A${'\u00f1'}o`}
 min="2000"
 max="2100"
 step="1"
 />
 )}
 <button
 className="w-full sm:w-auto px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50"
 onClick={() => {



 setAppliedDates({ from: '', to: '' });



 setProductFilters({ tipo: '', gama: '', proc: '', pantalla: '' });
 setSellerFilter('');
 setDateMode('month');



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



 <div className="flex items-center gap-4 mb-2 text-[11px] text-slate-500">
<span className="inline-flex items-center gap-1.5">
<span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 inline-block" />
Total
</span>
<span className="inline-flex items-center gap-1.5">
<span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-200 to-teal-200 inline-block" />
Activo
</span>
</div>

{generalInvRows.map((x) => (



 <Bar key={x.tipo} label={`${x.tipo} (${x.unidades}, act: ${x.activos})`} value={x.unidades} subValue={x.activos} totalBase={generalInvTotalUnits} max={maxByType} />



 ))}



 </div>



 <div className="overflow-x-auto">
 <table className="min-w-[420px] w-full text-sm">



 <thead>



 <tr className="text-left text-gray-500">



 <th className="py-1">Tipo</th>



 <th className="py-1">Unidades</th>
<th className="py-1">% Total</th>
<th className="py-1">% Activo</th>



 <th className="py-1">Capital</th>



 </tr>



 </thead>



 <tbody>



 {generalInvRows.map((x) => (



 <tr key={x.tipo} className="border-t">



 <td className="py-1">{x.tipo}</td>



 <td className="py-1">{x.unidades}</td>
<td className="py-1">{generalInvTotalUnits > 0 ? `${Math.round((x.unidades / generalInvTotalUnits) * 100)}%` : '0%'}</td>
<td className="py-1">{x.unidades > 0 ? `${Math.round((x.activos / x.unidades) * 100)}%` : '0%'}</td>



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
 <div className={`${tab !== 'economico' ? 'hidden ' : ''}grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6`}>
 <div className="bg-white rounded-xl border shadow-sm p-5 min-h-[430px]">
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-lg font-semibold">Compras del mes</h2>
 <div className="text-xs text-gray-500">
 {comprasPeriodoVistaLabel}
 </div>
 </div>
 <div className="text-xs text-gray-500 mb-2">
 Unidades: {comprasPeriodoVistaResumen.unidades} (activo: {comprasPeriodoVistaResumen.activos}) Capital: <Currency v={comprasPeriodoVistaResumen.capital} />
 </div>
 <div className="max-h-80 overflow-auto">
 <table className="min-w-[560px] w-full text-sm">
 <thead>
 <tr className="text-left text-gray-500">
 <th className="py-1">#</th>
 <th className="py-1">Producto</th>
 <th className="py-1">Fecha compra</th>
 <th className="py-1">Costo</th>
 </tr>
 </thead>
 <tbody>
 {comprasPeriodoVista.map((p, i) => (
 <tr key={`${p.productoId}-${i}`} className="border-t">
 <td className="py-1">{p.productoId}</td>
 <td className="py-1">{p.display || p.tipo}</td>
 <td className="py-1">{fmtDate(p.fechaCompra)}</td>
 <td className="py-1"><Currency v={p.costoTotal} /></td>
 </tr>
 ))}
 {comprasPeriodoVista.length === 0 && (
 <tr>
 <td className="py-2 text-sm text-gray-500" colSpan={4}>No hay compras para el mes seleccionado.</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 <div className="bg-white rounded-xl border shadow-sm p-5 min-h-[430px]">
 <div className="flex items-center justify-between mb-3">
 <h2 className="text-lg font-semibold">Inventario por tipo</h2>
 <div className="text-xs text-gray-500">Unidades y capital del mismo mes</div>
 </div>
 <div className="mb-3">
 <div className="flex items-center gap-4 mb-2 text-[11px] text-slate-500">
 <span className="inline-flex items-center gap-1.5">
 <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 inline-block" />
 Total
 </span>
 <span className="inline-flex items-center gap-1.5">
 <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-200 to-teal-200 inline-block" />
 Activo
 </span>
 </div>
 {inventarioTipoComprasVista.map((x) => (
 <Bar key={`inv-vista-${x.tipo}`} label={`${x.tipo} (${x.unidades}, act: ${x.activos || 0})`} value={x.unidades} subValue={x.activos || 0} totalBase={comprasPeriodoVistaResumen.unidades} />
 ))}
 {!inventarioTipoComprasVista.length && (
 <div className="text-sm text-gray-500">Sin inventario para ese mes.</div>
 )}
 </div>
 <div className="overflow-x-auto">
 <table className="min-w-[520px] w-full text-sm">
 <thead>
 <tr className="text-left text-gray-500">
 <th className="py-1">Tipo</th>
 <th className="py-1">Unidades</th>
<th className="py-1">% Total</th>
<th className="py-1">% Activo</th>
 <th className="py-1">Capital</th>
 </tr>
 </thead>
 <tbody>
 {inventarioTipoComprasVista.map((x) => (
 <tr key={`inv-vista-t-${x.tipo}`} className="border-t">
 <td className="py-1">{x.tipo}</td>
 <td className="py-1">{x.unidades} (act: {x.activos || 0})</td>
 <td className="py-1">{comprasPeriodoVistaResumen.unidades > 0 ? `${Math.round((x.unidades / comprasPeriodoVistaResumen.unidades) * 100)}%` : '0%'}</td>
 <td className="py-1">{x.unidades > 0 ? `${Math.round(((x.activos || 0) / x.unidades) * 100)}%` : '0%'}</td>
 <td className="py-1"><Currency v={x.capital} /></td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
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
 const monthKey = dateMode === 'month' ? (appliedDates.from || '') : '';
 const perYear = perYearMonth.filter((m) => String(m.month || '').startsWith(`${yearKey}-`));
 const totalIngresos = perYear.reduce((s, m) => s + (Number(m.ingresos) || 0), 0);
 const totalGanancia = perYear.reduce((s, m) => s + (Number(m.ganancia) || 0), 0);
 const totalCosto = totalIngresos - totalGanancia;
 const totalUtilidad = totalIngresos > 0 ? (totalGanancia / totalIngresos) * 100 : 0;
 const totalMarkup = totalCosto > 0 ? (totalGanancia / totalCosto) * 100 : 0;
 const yearGastos = Number(data?.summary?.comprasPeriodoCapital ?? 0);
 const monthRow = monthKey ? perMonth.find((m) => m.month === monthKey) : null;
 const monthIngresos = monthRow ? Number(monthRow.ingresos || 0) : null;
 const monthGanancia = monthRow ? Number(monthRow.ganancia || 0) : null;
 const monthCosto = monthIngresos != null && monthGanancia != null ? (monthIngresos - monthGanancia) : null;
 const monthUtilidad = monthRow && monthIngresos ? (monthGanancia / monthIngresos) * 100 : null;
 const monthMarkup = monthRow && monthCosto ? (monthGanancia / monthCosto) * 100 : null;
 const monthGastos = monthKey ? Number(data?.summary?.comprasPeriodoCapital ?? 0) : null;
 if (dateMode === 'year') {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 <div className="scale-[0.98] origin-top-left">
 <Card
 title={`Ganancia ${yearKey}`}
 value={<Currency v={totalGanancia} />}
 sub={
 yearlyError
 ? <span className="text-red-600">{yearlyError}</span>
 : <span>Ingresos: <Currency v={totalIngresos} /> - Utilidad: <Percent v={totalUtilidad} /> - Markup: <Percent v={totalMarkup} /></span>
 }
 />
 </div>
 <div className="scale-[0.98] origin-top-left">
 <Card
 title={`Gastos ${yearKey}`}
 value={<Currency v={yearGastos} />}
 sub={<span>Total comprado en el a{'\u00f1'}o.</span>}
 />
 </div>
 </div>
 );
 }
 return (
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div className="scale-[0.98] origin-top-left">
 <Card
 title={`Ganancia ${yearKey}`}
 value={<Currency v={totalGanancia} />}
 sub={
 yearlyError
 ? <span className="text-red-600">{yearlyError}</span>
 : <span>Ingresos: <Currency v={totalIngresos} /> - Utilidad: <Percent v={totalUtilidad} /> - Markup: <Percent v={totalMarkup} /></span>
 }
 />
 </div>
 <div className="scale-[0.98] origin-top-left">
 <Card
 title={monthKey ? `Ganancia ${monthKey}` : 'Selecciona un mes'}
 value={monthRow ? <Currency v={monthGanancia} /> : '-'}
 sub={
 monthKey
 ? (
 <span>
 {monthRow ? <>Ingresos: <Currency v={monthIngresos} /> - Utilidad: <Percent v={monthUtilidad} /> - Markup: <Percent v={monthMarkup} /></> : null}
 </span>
 )
 : <span>Usa el filtro de mes para ver el detalle.</span>
 }
 />
 </div>
 <div className="scale-[0.98] origin-top-left">
 <Card
 title={monthKey ? `Gastos ${monthKey}` : 'Gastos del mes'}
 value={monthKey ? <Currency v={monthGastos} /> : '-'}
 sub={monthKey ? <span>Total comprado en el mes.</span> : <span>Selecciona un mes para ver gastos.</span>}
 />
 </div>
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

 const estadoByProducto = new Map(comprasDetalle.map((c) => [c.productoId, normalizeEstado(c.estado)]));
const costSeriesBase = buildSeries(comprasDetalle, { dateKey: 'fechaCompra', valueKey: 'costoTotal' });
const costSeries = costSeriesBase.map((p) => ({ ...p, estado: estadoByProducto.get(p.productoId) || p.estado || '' }));
const saleSeriesBase = buildSeries(ventasDetalleRaw, { dateKey: 'fechaVenta', valueKey: 'precioVenta' });
const saleSeries = saleSeriesBase.map((p) => ({ ...p, estado: estadoByProducto.get(p.productoId) || p.estado || '' }));



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



 {(g.tipo === 'iphone'
   ? (() => {
       const labelRaw = String(g?.label || '').trim();
       const gamaRaw = String(g?.gama || '').trim();
       const numFromLabel = labelRaw.match(/iphone\s*(\d+)/i)?.[1] || labelRaw.match(/\b(\d{2})\b/)?.[1] || '';
       const numFromGama = gamaRaw.match(/(\d+)/)?.[1] || '';
       const num = numFromGama || numFromLabel;
       const rest = gamaRaw.replace(/\d+/g, '').trim() || (labelRaw.replace(/iphone\s*\d*/i, '').trim());
       if (num) return rest ? `iPhone ${num} ${rest}` : `iPhone ${num}`;
       return gamaRaw ? `iPhone ${gamaRaw}` : 'iPhone';
     })()
   : g.label)}{' '}



 <span className="text-sm text-gray-500 font-normal">



 ({g.compras?.count || 0} compras)



 </span>



 </div>



 <div className="text-xs text-gray-500 mt-1">



 {g.tipo === 'iphone' ? (
   <>Variantes: Almacenamiento {g.ssdDistinct?.join(', ') || '-'}</>
 ) : g.tipo === 'ipad' ? (
   <>Variantes: RAM {g.ramDistinct?.join(', ') || '-'} Almacenamiento {g.ssdDistinct?.join(', ') || '-'}</>
 ) : (
   <>Variantes: RAM {g.ramDistinct?.join(', ') || '-'} SSD {g.ssdDistinct?.join(', ') || '-'}</>
 )}



 </div>



 <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
  <div>
   Promedios historicos: compra <Currency v={g.compras?.mean} /> - venta <Currency v={g.ventas?.mean} /> - margen <Percent v={g.ventas?.margenPromedio || 0} />
  </div>
  <button
   type="button"
   className="px-2 py-1 rounded border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50"
   onClick={() => {
    openCurvaModal({
     title: g.label || g.tipo || 'Producto',
     costSeries,
     saleSeries,
     comprasDetalle,
    });
   }}
  >
   Ver curvas
  </button>
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



 {curvaModal.open && (
  <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
   <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-gray-100 p-6 relative">
    <button
     className="absolute top-3 right-3 w-9 h-9 rounded-full text-xl font-bold text-gray-500 hover:bg-gray-100"
     onClick={() => setCurvaModal((s) => ({ ...s, open: false }))}
     aria-label="Cerrar"
    >
     x
    </button>
    <div className="mb-5 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-4">
     <div className="text-xs uppercase tracking-wide text-indigo-500 font-semibold">Curvas de progresion</div>
     <div className="text-xl font-semibold text-gray-900">{curvaModal.title}</div>
     <div className="text-xs text-gray-600 mt-1">
      Evolucion historica de costo (S/) y venta (S/). Los puntos son registros reales por fecha.
     </div>
     <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="text-gray-500">Estado:</span>
      {estadoOptions.map((opt) => (
       <button
        key={`estado-${opt.key}`}
        type="button"
        className={`px-3 py-1 rounded-full border ${curvaDerived.selectedEstado === opt.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
        onClick={() => setCurvaModal((s) => ({ ...s, estadoFiltro: opt.key }))}
       >
        {opt.label} ({opt.count})
       </button>
      ))}
      <span className="text-[11px] text-gray-400">Default: mayor cantidad</span>
     </div>
     <div className="mt-2 text-xs text-slate-600">
      <span className="font-medium">Compra:</span>{' '}
      {curvaDerived.spreadStats ? fmtSolesLocal(curvaDerived.spreadStats.costMedian) : '-'}
      {' '}|{' '}
      <span className="font-medium">Venta:</span>{' '}
      {curvaDerived.spreadStats ? fmtSolesLocal(curvaDerived.spreadStats.saleMedian) : '-'}
     </div>
     <div className="mt-1 text-[11px] text-slate-500">
      Compras: {curvaDerived.comprasCountRaw} (grafico {curvaDerived.costCount}) | Ventas: {curvaDerived.saleCountRaw} (grafico {curvaDerived.saleCount})
     </div>
     {curvaDerived.usedFallback ? (
      <div className="text-[11px] text-amber-700 mt-1">
       Algunas compras no tienen estado registrado; se emparejaron usando ventas del mismo producto.
      </div>
     ) : null}
    </div>
    <div className="space-y-3">
     <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-3 shadow-sm">
     {(!curvaDerived.costCount && !curvaDerived.saleCount) ? (
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
       Sin datos para el estado seleccionado.
      </div>
     ) : null}
      {renderCurvaChart(curvaDerived.costSeries, curvaDerived.saleSeries)}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 mt-3">
       <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 border border-emerald-200">
        <span className="inline-block w-4 h-0.5 bg-emerald-500" />
        Costo (S/)
       </div>
       <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 text-indigo-700 px-3 py-1 border border-indigo-200">
        <span className="inline-block w-4 h-0.5 bg-indigo-500" />
        Venta (S/)
       </div>
      </div>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
       <div className="rounded-lg border border-slate-200 bg-white/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Brecha tipica</div>
        {curvaDerived.spreadStats ? (
         <>
          <div className="mt-1 text-sm font-semibold text-slate-800">
           {fmtSignedSoles(curvaDerived.spreadStats.spread)}
           {curvaDerived.spreadStats.pct != null ? ' (' + curvaDerived.spreadStats.pct + '%)' : ''}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
           Compra {fmtSolesLocal(curvaDerived.spreadStats.costMedian)} | Venta {fmtSolesLocal(curvaDerived.spreadStats.saleMedian)}
          </div>
         </>
        ) : (
         <div className="text-xs text-gray-500 mt-1">Sin datos suficientes.</div>
        )}
       </div>
       <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-emerald-700">Tendencia costo</div>
        {curvaDerived.costTrend ? (
         <>
          <div className="mt-1 text-sm font-semibold text-emerald-900">
           {fmtSignedSoles(curvaDerived.costTrend.change)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
           Aprox {fmtSignedSoles(curvaDerived.costTrend.per30)} cada 30 dias
          </div>
         </>
        ) : (
         <div className="text-xs text-gray-500 mt-1">Sin datos suficientes.</div>
        )}
       </div>
       <div className="rounded-lg border border-indigo-200 bg-indigo-50/70 p-3">
        <div className="text-[11px] uppercase tracking-wide text-indigo-700">Tendencia venta</div>
        {curvaDerived.saleTrend ? (
         <>
          <div className="mt-1 text-sm font-semibold text-indigo-900">
           {fmtSignedSoles(curvaDerived.saleTrend.change)}
          </div>
          <div className="text-[11px] text-indigo-700 mt-1">
           Aprox {fmtSignedSoles(curvaDerived.saleTrend.per30)} cada 30 dias
          </div>
         </>
        ) : (
         <div className="text-xs text-gray-500 mt-1">Sin datos suficientes.</div>
        )}
       </div>
      </div>
     </div>
    </div>
    <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
     {(() => {
      const stats = curvaDerived.costStats;
      return (
       <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-sm">
        <div className="font-semibold text-emerald-800 text-base">Costo</div>
        {!stats || !stats.count ? (
         <div className="text-xs text-gray-600 mt-1">Sin bajas detectadas.</div>
        ) : (
         <>
          <div className="text-xs text-gray-700 mt-1">
           <span className="font-semibold">Bajas:</span> {stats.count}  | 
           <span className="font-semibold"> Promedio cada</span> {stats.avgDays} dias  | 
           <span className="font-semibold"> Caida promedio</span> {fmtSolesLocal(stats.avgDrop)}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
           Cada linea muestra de que fecha a que fecha bajo y cuanto cayo.
          </div>
          {curvaDerived.costOutliers ? (
           <div className="text-[11px] text-emerald-700 mt-1">
            Se omitieron {curvaDerived.costOutliers} puntos atipicos (mega ofertas) en costo.
           </div>
          ) : null}
          <ul className="text-xs text-gray-600 mt-2 space-y-1 max-h-32 overflow-auto pr-1">
           {stats.drops.slice(0, 8).map((d, i) => (
            <li key={`cost-drop-${i}`}>
             {fmtDate(d.from.date)} -> {fmtDate(d.to.date)}: -{fmtSolesLocal(d.delta)} ({d.days} dias)
            </li>
           ))}
           {stats.drops.length > 8 && (
            <li>y {stats.drops.length - 8} mas...</li>
           )}
          </ul>
         </>
        )}
       </div>
      );
     })()}
     {(() => {
      const stats = curvaDerived.saleStats;
      return (
       <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 shadow-sm">
        <div className="font-semibold text-indigo-800 text-base">Venta</div>
        {!stats || !stats.count ? (
         <div className="text-xs text-gray-600 mt-1">Sin bajas detectadas.</div>
        ) : (
         <>
          <div className="text-xs text-gray-700 mt-1">
           <span className="font-semibold">Bajas:</span> {stats.count}  | 
           <span className="font-semibold"> Promedio cada</span> {stats.avgDays} dias  | 
           <span className="font-semibold"> Caida promedio</span> {fmtSolesLocal(stats.avgDrop)}
          </div>
          <div className="text-[11px] text-gray-500 mt-2">
           Cada linea muestra de que fecha a que fecha bajo y cuanto cayo.
          </div>
          {curvaDerived.saleOutliers ? (
           <div className="text-[11px] text-indigo-700 mt-1">
            Se omitieron {curvaDerived.saleOutliers} puntos atipicos (mega ofertas) en venta.
           </div>
          ) : null}
          <ul className="text-xs text-gray-600 mt-2 space-y-1 max-h-32 overflow-auto pr-1">
           {stats.drops.slice(0, 8).map((d, i) => (
            <li key={`sale-drop-${i}`}>
             {fmtDate(d.from.date)} -> {fmtDate(d.to.date)}: -{fmtSolesLocal(d.delta)} ({d.days} dias)
            </li>
           ))}
           {stats.drops.length > 8 && (
            <li>y {stats.drops.length - 8} mas...</li>
           )}
          </ul>
         </>
        )}
       </div>
      );
     })()}
    </div>
   </div>
  </div>
 )}
 </>
 );



}
































