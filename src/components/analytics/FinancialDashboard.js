import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import './chartSetup';
import { getFinancialDashboard, invalidateAnalyticsCache } from '../../services/analytics';

const money = (value) => value == null ? 'No disponible' : Number(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
const number = (value) => value == null ? 'No disponible' : Number(value).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const percent = (value) => value == null ? 'No disponible' : `${Number(value).toFixed(2)}%`;
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const CATEGORY_LABELS = { macbook: 'MacBook', iphone: 'iPhone', ipad: 'iPad', watch: 'Apple Watch', imac: 'iMac', macmini: 'Mac mini', airpods: 'AirPods', accesorios: 'Accesorios', otro: 'Otros' };
const label = (value) => CATEGORY_LABELS[value] || value || 'Sin categoría';
const SERIES = [
  ['purchases', 'Compras', '#64748b'], ['income', 'Ventas', '#2563eb'],
  ['cost', 'Costo vendido', '#f59e0b'], ['grossProfit', 'Ganancia bruta', '#059669'],
];
const columns = [
  ['category', 'Categoría'], ['purchased', 'Comprados'], ['sold', 'Vendidos'],
  ['income', 'Ingresos'], ['cost', 'Costo vendido'], ['grossProfit', 'Ganancia'],
  ['margin', 'Margen'], ['markup', 'Markup'], ['medianDays', 'Mediana días'], ['roiRealized', 'ROI realizado'],
];

function Kpi({ title, value, tip, onClick, tone = 'slate', previous, current }) {
  const border = tone === 'good' ? 'border-emerald-200' : tone === 'bad' ? 'border-red-200' : 'border-slate-200';
  const change = current != null && previous != null ? Number(current) - Number(previous) : null;
  return <button type="button" title={tip} onClick={onClick} className={`rounded-2xl border ${border} bg-white p-4 text-left shadow-sm hover:shadow-md`}>
    <span className="block text-xs font-medium text-slate-500">{title}</span>
    <strong className="mt-2 block text-xl text-slate-950">{value}</strong>
    <span className="mt-2 block text-xs text-slate-500">{tip}</span>
    {change != null && <span className="mt-1 block text-xs text-slate-500">Período anterior: {money(previous)} · cambio {change >= 0 ? '+' : ''}{money(change)}</span>}
  </button>;
}

function Section({ title, children, subtitle }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4"><h3 className="text-lg font-semibold text-slate-950">{title}</h3>{subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}</div>
    {children}
  </section>;
}

function Details({ title, rows, onClose }) {
  return <div className="fixed inset-0 z-[110] overflow-y-auto bg-slate-950/50 p-3 sm:p-8" role="dialog" aria-modal="true" aria-label={title}>
    <div className="mx-auto max-w-4xl rounded-2xl bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="rounded-lg border px-3 py-2">Cerrar</button></div>
      {rows?.length ? <div className="max-h-[70vh] overflow-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-2">Registro</th><th className="p-2">Fecha</th><th className="p-2">Unidades</th><th className="p-2">Ingreso</th><th className="p-2">Costo / capital</th><th className="p-2">Ganancia</th></tr></thead><tbody>{rows.map((row) => <tr key={`${row.id}-${row.productoId || ''}`} className="border-b"><td className="p-2">{row.name || `#${row.id}`}</td><td className="p-2">{row.date || row.purchaseDate || '—'}</td><td className="p-2">{number(row.units)}</td><td className="p-2">{row.income == null ? '—' : money(row.income)}</td><td className="p-2">{money(row.cost ?? row.capital)}</td><td className="p-2">{row.profit == null ? '—' : money(row.profit)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-slate-500">No hay registros para este detalle.</p>}
    </div>
  </div>;
}

export default function FinancialDashboard({ view = 'resumen', from, to, filters = {} }) {
  const [groupBy, setGroupBy] = useState('month');
  const [periodPreset, setPeriodPreset] = useState('page');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [advanced, setAdvanced] = useState({ gama: '', procesador: '', pantalla: '', ram: '', ssd: '', estadoTracking: '' });
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [budget, setBudget] = useState('');
  const [strategy, setStrategy] = useState('balanced');
  const [visible, setVisible] = useState(['income', 'cost', 'grossProfit']);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [detail, setDetail] = useState(null);
  const [sort, setSort] = useState(['grossProfit', -1]);
  const [price, setPrice] = useState({ cost: '', sale: '', commission: '', extra: '', target: '' });
  const [goalMonth, setGoalMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [goals, setGoals] = useState({ income: '', grossProfit: '', operatingResult: '', margin: '', inventoryCapital: '' });
  const goalsKey = `analysis-goals:v1:${data?.filters?.vendedor || filters.vendedor || 'general'}:${goalMonth}`;
  useEffect(() => {
    try { setGoals({ income: '', grossProfit: '', operatingResult: '', margin: '', inventoryCapital: '', ...JSON.parse(localStorage.getItem(goalsKey) || '{}') }); }
    catch { setGoals({ income: '', grossProfit: '', operatingResult: '', margin: '', inventoryCapital: '' }); }
  }, [goalsKey]);
  const updateGoal = (key, value) => {
    const next = { ...goals, [key]: value };
    setGoals(next);
    try { localStorage.setItem(goalsKey, JSON.stringify(next)); } catch {}
  };
  const range = useMemo(() => {
    if (periodPreset === 'page') return { from, to };
    if (periodPreset === 'all') return { from: undefined, to: undefined };
    if (periodPreset === 'custom') return { from: customFrom || undefined, to: customTo || undefined };
    const end = new Date();
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - (periodPreset === '30d' ? 29 : 89));
    return { from: localDate(start), to: localDate(end) };
  }, [periodPreset, from, to, customFrom, customTo]);
  const paramsKey = JSON.stringify({ ...filters, ...range, groupBy, tipo, estado, ...advanced, budget, strategy });
  useEffect(() => {
    const refresh = () => { invalidateAnalyticsCache(); setRetry((value) => value + 1); };
    window.addEventListener('ventas-updated', refresh);
    window.addEventListener('productos-updated', refresh);
    window.addEventListener('gastos-updated', refresh);
    return () => {
      window.removeEventListener('ventas-updated', refresh);
      window.removeEventListener('productos-updated', refresh);
      window.removeEventListener('gastos-updated', refresh);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getFinancialDashboard(JSON.parse(paramsKey)).then((result) => { if (active) setData(result); })
      .catch((e) => { if (active) setError(e?.message || 'No se pudo cargar el análisis financiero.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [paramsKey, retry]);

  const summary = data?.summary || {};
  const sales = data?.sales || [];
  const inventory = data?.inventory?.records || [];
  const categories = useMemo(() => [...(data?.categories || [])].sort((a, b) => {
    const [key, direction] = sort;
    if (key === 'category') return direction * String(a.category).localeCompare(String(b.category));
    return direction * (Number(a[key] ?? -Infinity) - Number(b[key] ?? -Infinity));
  }), [data, sort]);
  const chart = useMemo(() => ({
    labels: (data?.evolution || []).map((row) => row.period),
    datasets: SERIES.filter(([key]) => visible.includes(key)).map(([key, name, color]) => ({ label: name, data: (data?.evolution || []).map((row) => row[key]), borderColor: color, backgroundColor: color, tension: 0.25, spanGaps: false })),
  }), [data, visible]);
  const show = (title, rows) => setDetail({ title, rows });
  const exportCategories = () => {
    const lines = [columns.map(([, title]) => title).join(';'), ...categories.map((row) => columns.map(([key]) => String(key === 'category' ? label(row.category) : row[key] ?? '').replaceAll(';', ',')).join(';'))];
    const blob = new Blob(['\uFEFF', lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rentabilidad-${range.from || 'todo'}-${range.to || 'todo'}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const priceCost = Number(price.cost || 0), priceSale = Number(price.sale || 0);
  const extra = Number(price.commission || 0) + Number(price.extra || 0);
  const estimate = price.cost !== '' && price.sale !== '' ? priceSale - priceCost - extra : null;
  const target = Number(price.target || 0);
  const targetPrice = price.cost !== '' && target >= 0 && target < 100 ? (priceCost + extra) / (1 - target / 100) : null;

  if (loading && !data) return <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div>;
  if (error) return <Section title="Análisis financiero"><p className="text-sm text-red-700">{error}</p><button className="mt-3 rounded-lg border px-3 py-2 text-sm" onClick={() => setRetry((value) => value + 1)}>Reintentar</button></Section>;
  if (!data) return null;

  return <div className="mb-6 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white">
      <div><h2 className="text-xl font-semibold">{view === 'resumen' ? 'Resumen general' : view === 'economico' ? 'Capital e inversión' : 'Rentabilidad'}</h2><p className="text-xs text-slate-300">{range.from || 'Inicio'} — {range.to || 'Hoy'} · {data.filters?.vendedor || filters.vendedor || 'General'} · datos registrados</p></div>
      <div className="flex flex-wrap gap-2 text-sm">
        <select aria-label="Período financiero" className="rounded-lg bg-white p-2 text-slate-900" value={periodPreset} onChange={(e) => setPeriodPreset(e.target.value)}><option value="page">Período de la página</option><option value="30d">Últimos 30 días</option><option value="90d">Últimos 90 días</option><option value="custom">Rango personalizado</option><option value="all">Todo</option></select>
        <select aria-label="Tipo de producto financiero" className="rounded-lg bg-white p-2 text-slate-900" value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(CATEGORY_LABELS).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select>
        <select aria-label="Estado financiero" className="rounded-lg bg-white p-2 text-slate-900" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos los estados</option><option value="nuevo">Nuevo</option><option value="usado">Usado</option><option value="open box">Open box</option></select>
        <button onClick={() => setAdvancedOpen((open) => !open)} className="rounded-lg border border-slate-500 px-3 py-2">Más filtros</button>
        <button onClick={() => { setPeriodPreset('page'); setCustomFrom(''); setCustomTo(''); setTipo(''); setEstado(''); setAdvanced({ gama: '', procesador: '', pantalla: '', ram: '', ssd: '', estadoTracking: '' }); setGroupBy('month'); }} className="rounded-lg border border-slate-500 px-3 py-2">Restablecer filtros</button>
      </div>
    </div>
    {periodPreset === 'custom' && <div className="flex flex-wrap gap-2 rounded-xl border bg-white p-3 text-xs"><label>Desde <input aria-label="Desde financiero" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="ml-2 rounded-lg border p-2" /></label><label>Hasta <input aria-label="Hasta financiero" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="ml-2 rounded-lg border p-2" /></label></div>}
    {advancedOpen && <div className="grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-3 lg:grid-cols-6">{[['gama', 'Modelo / gama'], ['procesador', 'Procesador'], ['pantalla', 'Pantalla'], ['ram', 'RAM'], ['ssd', 'SSD'], ['estadoTracking', 'Tracking']].map(([key, title]) => <label key={key} className="text-xs text-slate-600">{title}<input className="mt-1 w-full rounded-lg border p-2 text-sm" value={advanced[key]} onChange={(e) => setAdvanced((current) => ({ ...current, [key]: e.target.value }))} /></label>)}</div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Kpi title="Capital invertido" value={money(summary.capitalInvested)} tip={`${data.definitions.capital} Compras del período: ${money(summary.purchaseCapitalInPeriod)}.`} onClick={() => show('Todos los productos comprados', data.purchases)} />
      <Kpi title="Capital inmovilizado" value={money(summary.inventoryCapital)} tip={data.definitions.inventory} onClick={() => show('Stock actual', inventory)} tone={summary.inventoryCapital > 0 ? 'slate' : 'good'} />
      <Kpi title="Capital recuperado" value={money(summary.recoveredCapital)} tip="Costo histórico de lo vendido en este período." onClick={() => show('Ventas del período', sales)} current={summary.recoveredCapital} previous={data.comparison?.cost} />
      <Kpi title="Ingresos por ventas" value={money(summary.income)} tip={data.definitions.income} onClick={() => show('Ventas del período', sales)} current={summary.income} previous={data.comparison?.income} />
      <Kpi title="Rotación mediana" value={summary.medianDays == null ? 'No disponible' : `${number(summary.medianDays)} días`} tip="Días entre compra y venta, sobre registros con ambas fechas." onClick={() => show('Ventas con fechas', sales.filter((row) => row.days != null))} />
      <Kpi title="Rentabilidad sobre costo vendido" value={percent(summary.markup)} tip="Ganancia bruta dividida entre costo de productos vendidos." onClick={() => show('Ventas del período', sales)} tone={summary.markup < 0 ? 'bad' : 'good'} />
    </div>
    {summary.missingCosts > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Falta el costo de {summary.missingCosts} ventas. La ganancia y el margen agregados se muestran como no disponibles.</p>}

    <Section title="Evolución económica" subtitle="Las compras afectan al capital, mientras que la ganancia usa únicamente el costo de lo vendido.">
      <div className="mb-3 flex flex-wrap gap-2"><select aria-label="Agrupar evolución" className="rounded-lg border p-2 text-sm" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}><option value="day">Día</option><option value="month">Mes</option><option value="year">Año</option></select>{SERIES.map(([key, name, color]) => <label key={key} className="flex items-center gap-1 rounded-lg border px-2 text-xs"><input type="checkbox" checked={visible.includes(key)} onChange={() => setVisible((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])} /><span style={{ color }}>{name}</span></label>)}</div>
      {data.evolution.length ? <div className="h-72"><Line data={chart} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${money(context.parsed.y)}` } } }, scales: { y: { beginAtZero: true } } }} /></div> : <p className="text-sm text-slate-500">No hay movimientos en el período.</p>}
    </Section>

    {(view === 'resumen' || view === 'economico') && <>
      <Section title="Conclusiones y oportunidades" subtitle="Reglas basadas en registros; cada alerta indica su muestra.">
        {data.insights.length ? <div className="grid gap-3 md:grid-cols-3">{data.insights.slice(0, view === 'resumen' ? 3 : undefined).map((insight) => <div key={insight.title} className={`rounded-xl border p-3 ${insight.level === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}><strong className="text-sm">{insight.title}</strong><p className="mt-1 text-xs">{insight.detail}</p><p className="mt-2 text-xs font-medium">{insight.action}</p><button className="mt-2 text-xs underline" onClick={() => show(insight.category ? label(insight.category) : insight.title, insight.category ? sales.filter((row) => row.category === insight.category) : inventory)}>Ver registros</button></div>)}</div> : <p className="text-sm text-slate-500">No hay conclusiones suficientes para estos filtros.</p>}
      </Section>
    </>}

    {view === 'economico' && <>
      <Section title="Rentabilidad por categoría" subtitle="ROI realizado = ganancia bruta / costo de unidades vendidas. Pulsa una fila para ver las ventas.">
        <div className="mb-3 flex justify-end"><button onClick={exportCategories} className="rounded-lg border px-3 py-2 text-sm">Exportar CSV</button></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-xs"><thead><tr className="border-b text-slate-500">{columns.map(([key, title]) => <th key={key} className="p-2"><button className="font-semibold" onClick={() => setSort(([previous, direction]) => [key, previous === key ? -direction : -1])}>{title} ↕</button></th>)}</tr></thead><tbody>{categories.map((row) => <tr key={row.category} className="cursor-pointer border-b hover:bg-slate-50" onClick={() => show(`${label(row.category)} · ventas`, sales.filter((sale) => sale.category === row.category))}><td className="p-2 font-semibold">{label(row.category)}</td><td className="p-2">{number(row.purchased)}</td><td className="p-2">{number(row.sold)}</td><td className="p-2">{money(row.income)}</td><td className="p-2">{money(row.cost)}</td><td className="p-2">{money(row.grossProfit)}</td><td className="p-2">{percent(row.margin)}</td><td className="p-2">{percent(row.markup)}</td><td className="p-2">{number(row.medianDays)}</td><td className="p-2">{percent(row.roiRealized)}</td></tr>)}</tbody></table></div>
      </Section>
      <Section title="Inventario y capital inmovilizado" subtitle="Antigüedad desde la compra. El stock actual no cambia al filtrar fechas de venta.">
        <div className="mb-4 grid gap-3 sm:grid-cols-4">{data.inventory.byStatus.map((bucket) => <button key={bucket.status} className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-left hover:bg-blue-100" onClick={() => show(bucket.status, bucket.records)}><span className="text-xs text-blue-700">{bucket.status}</span><strong className="mt-1 block">{number(bucket.units)} unidades</strong><span className="text-sm">{money(bucket.capital)}</span></button>)}</div>
        <div className="grid gap-3 sm:grid-cols-4">{data.inventory.aging.map((bucket) => <button key={bucket.label} className="rounded-xl border p-3 text-left hover:bg-slate-50" onClick={() => show(`Inventario ${bucket.label} días`, bucket.records)}><span className="text-xs text-slate-500">{bucket.label} días</span><strong className="mt-1 block">{number(bucket.units)} unidades</strong><span className="text-sm">{money(bucket.capital)}</span></button>)}</div>
      </Section>
      <Section title="¿En qué debería invertir?" subtitle="Simulación histórica por categoría. No supone disponibilidad ni precios de proveedor.">
        <div className="mb-3 flex flex-wrap gap-2"><input aria-label="Presupuesto de inversión" type="number" min="0" placeholder="Presupuesto S/" value={budget} onChange={(e) => setBudget(e.target.value)} className="rounded-lg border p-2" /><select aria-label="Estrategia de inversión" value={strategy} onChange={(e) => setStrategy(e.target.value)} className="rounded-lg border p-2"><option value="balanced">Equilibrio</option><option value="profit">Priorizar ganancia</option><option value="speed">Priorizar rotación</option></select></div>
        {budget && data.investment.length ? <div className="grid gap-2 md:grid-cols-3">{data.investment.map((item) => <div key={item.category} className="rounded-xl border p-3 text-sm"><strong>{label(item.category)}</strong><p>Compra histórica: {money(item.unitCost)} por unidad</p><p>Ganancia histórica: {money(item.unitProfit)} por unidad</p><p>Rotación mediana: {number(item.medianDays)} días · {item.sample} ventas</p><p>Con este presupuesto: hasta {item.affordableUnits} unidades al costo histórico</p></div>)}</div> : <p className="text-sm text-slate-500">Ingresa un presupuesto. Se necesitan al menos tres ventas rentables por categoría.</p>}
      </Section>
    </>}

    {view === 'ganancias' && <>
      <Section title="Estado de resultados" subtitle="La utilidad neta requiere gastos, impuestos y cobros completos.">
        <div className="max-w-xl space-y-2 text-sm">{[['Ingresos por ventas', summary.income], ['(-) Costo de productos vendidos', summary.cost], ['(=) Ganancia bruta', summary.grossProfit], ['(-) Gastos operativos', summary.operatingExpenses], ['(=) Resultado operativo', summary.operatingResult]].map(([name, value]) => <button key={name} className="flex w-full justify-between border-b py-2 text-left" onClick={() => show(name, name.includes('Costo') || name.includes('Ganancia') || name.includes('Ingresos') ? sales : [])}><span>{name}</span><strong>{money(value)}</strong></button>)}</div>
        <p className="mt-3 text-xs text-amber-700">{summary.expenseStatus}</p>
        <p className="mt-2 text-xs text-slate-600">Cobros verificados: {money(summary.collectedVerified)}. Cobertura de ventas con ingreso vinculado: {percent(summary.collectionCoverage)}. El flujo de caja sigue no disponible porque faltan pagos de compras y otros movimientos.</p>
      </Section>
      <div className="grid gap-4 md:grid-cols-4"><Kpi title="Margen bruto" value={percent(summary.margin)} tip="Ganancia bruta / ingresos." onClick={() => show('Ventas', sales)} /><Kpi title="Markup" value={percent(summary.markup)} tip="Ganancia bruta / costo vendido." onClick={() => show('Ventas', sales)} /><Kpi title="Ganancia por S/ 1,000" value={money(summary.profitPerThousand)} tip="Sobre capital efectivamente vendido." onClick={() => show('Ventas', sales)} /><Kpi title="Resultado operativo" value={money(summary.operatingResult)} tip={summary.expenseStatus} onClick={() => show('Gastos operativos', [])} /></div>
      <Section title="Ranking de rentabilidad" subtitle="Ordenado por ganancia bruta de categoría; abre el detalle para ver las ventas."><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{categories.map((row) => <button key={row.category} onClick={() => show(label(row.category), sales.filter((sale) => sale.category === row.category))} className="rounded-xl border p-3 text-left"><strong>{label(row.category)}</strong><p className="mt-1 text-sm">{money(row.grossProfit)} · {percent(row.margin)}</p><span className="text-xs text-slate-500">{row.sample} ventas · mediana {number(row.medianDays)} días</span></button>)}</div></Section>
      <Section title="Rentabilidad por modelo" subtitle="Agrupación por categoría, gama, chip, pantalla, RAM, almacenamiento y estado."><div className="max-h-80 overflow-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b text-slate-500"><th className="p-2">Modelo</th><th className="p-2">Ventas</th><th className="p-2">Ganancia</th><th className="p-2">Margen</th><th className="p-2">Días</th></tr></thead><tbody>{(data.models || []).map((row) => <tr key={row.name} onClick={() => show(row.name, sales.filter((sale) => sale.model === row.name))} className="cursor-pointer border-b hover:bg-slate-50"><td className="p-2">{row.name}</td><td className="p-2">{number(row.sales)}</td><td className="p-2">{money(row.grossProfit)}</td><td className="p-2">{percent(row.margin)}</td><td className="p-2">{number(row.medianDays)}</td></tr>)}</tbody></table></div></Section>
      <Section title="Rentabilidad por estado"><div className="grid gap-2 sm:grid-cols-3">{(data.states || []).map((row) => <button key={row.name} onClick={() => show(row.name, sales.filter((sale) => sale.state === row.name))} className="rounded-xl border p-3 text-left"><strong>{row.name}</strong><p className="text-sm">{number(row.units)} unidades · {money(row.grossProfit)}</p><span className="text-xs text-slate-500">Margen {percent(row.margin)} · mediana {number(row.medianDays)} días</span></button>)}</div></Section>
      <Section title="Proyección de cierre" subtitle="Estimación separada de los resultados registrados.">{data.projection ? <div className="text-sm"><p>Ingreso estimado: <strong>{money(data.projection.income)}</strong> (real {money(data.projection.actualIncome)}; rango histórico {data.projection.incomeRange.map(money).join(' a ')})</p><p>Ganancia bruta estimada: <strong>{money(data.projection.grossProfit)}</strong> (real {money(data.projection.actualGrossProfit)}; rango histórico {data.projection.grossProfitRange.map(money).join(' a ')})</p><p className="mt-2 text-xs text-slate-500">{data.projection.method} Muestra: {data.projection.sampleMonths.join(', ')}. El rango usa los meses de menor y mayor resultado; no garantiza resultados futuros.</p></div> : <p className="text-sm text-slate-500">No disponible: se necesitan tres meses completos con ventas y costos verificables.</p>}</Section>
      <Section title="Simulador de precios" subtitle="Los cálculos son estimaciones y no cambian precios guardados."><div className="grid gap-2 sm:grid-cols-5">{[['cost', 'Costo S/'], ['sale', 'Venta S/'], ['commission', 'Comisiones S/'], ['extra', 'Otros gastos S/'], ['target', 'Margen objetivo %']].map(([key, name]) => <label key={key} className="text-xs">{name}<input type="number" min="0" className="mt-1 w-full rounded-lg border p-2 text-sm" value={price[key]} onChange={(e) => setPrice((current) => ({ ...current, [key]: e.target.value }))} /></label>)}</div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><p>Equilibrio: <strong>{price.cost === '' ? 'No disponible' : money(priceCost + extra)}</strong></p><p>Resultado estimado: <strong>{money(estimate)}</strong></p><p>Precio para margen objetivo: <strong>{money(targetPrice)}</strong></p></div></Section>
      <Section title="Metas comerciales" subtitle="Las metas se guardan en este navegador por vendedor y mes.">
        <label className="text-xs">Mes <input aria-label="Mes de metas" type="month" value={goalMonth} onChange={(e) => setGoalMonth(e.target.value)} className="ml-2 rounded-lg border p-2" /></label>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{[['income', 'Ventas S/'], ['grossProfit', 'Ganancia bruta S/'], ['operatingResult', 'Resultado operativo S/'], ['margin', 'Margen %'], ['inventoryCapital', 'Capital máximo inmovilizado S/']].map(([key, title]) => {
          const goal = Number(goals[key]);
          const actual = summary[key];
          const comparable = range.from?.startsWith(goalMonth) && goal > 0 && actual != null;
          const achieved = comparable ? (key === 'inventoryCapital' ? actual <= goal : actual >= goal) : null;
          return <label key={key} className="rounded-xl border p-3 text-xs">{title}<input type="number" min="0" step="0.01" value={goals[key]} onChange={(e) => updateGoal(key, e.target.value)} className="mt-1 w-full rounded-lg border p-2 text-sm" /><span className={`mt-2 block ${achieved ? 'text-emerald-700' : 'text-slate-500'}`}>{comparable ? `${Math.round(actual / goal * 100)}% · diferencia ${key === 'margin' ? percent(actual - goal) : money(actual - goal)}` : 'Selecciona el mismo mes para ver avance'}</span></label>;
        })}</div>
      </Section>
    </>}
    {detail && <Details title={detail.title} rows={detail.rows} onClose={() => setDetail(null)} />}
  </div>;
}
