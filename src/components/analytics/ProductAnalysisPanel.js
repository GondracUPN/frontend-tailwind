import React, { useMemo, useState } from 'react';
import {
  CONFIDENCE_LABELS, OFFER_FACTOR, VERDICT_LABELS, analyzeModel, buildConditionFactors,
  conditionLabel, evaluateOffer, mergeGroupsByModel, rotationLabel, sourceText,
} from '../../utils/productAnalysis';

const fmtUSD = (value) => (value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const fmtPEN = (value) => (value == null || !Number.isFinite(Number(value)) ? '-' : Number(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 0, maximumFractionDigits: 0 }));
const fmtPct = (value) => (value == null || !Number.isFinite(Number(value)) ? '-' : `${Math.round(Number(value) * 100)} %`);
const fmtDate = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-PE', { timeZone: 'UTC' });
};

const CONFIDENCE_STYLES = {
  alta: 'bg-emerald-100 text-emerald-800',
  media: 'bg-amber-100 text-amber-800',
  baja: 'bg-rose-100 text-rose-700',
  sin_datos: 'bg-slate-100 text-slate-500',
};
const VERDICT_STYLES = {
  muy_buena: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  buena: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  justa: 'border-amber-200 bg-amber-50 text-amber-900',
  cara: 'border-rose-200 bg-rose-50 text-rose-800',
};
const CONDITION_STYLES = {
  nuevo: 'border-emerald-200',
  usado_caja: 'border-sky-200',
  usado_accesorios: 'border-indigo-200',
  usado_simple: 'border-slate-200',
};

function ConditionCard({ cond }) {
  const hasPrice = cond.sale != null;
  return (
    <div className={`flex flex-col rounded-lg border-2 bg-white p-3 text-sm ${CONDITION_STYLES[cond.key] || 'border-slate-200'}`} data-testid={`cond-${cond.key}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-semibold text-slate-900">{cond.label}</div>
          <div className="text-[11px] text-slate-500">{cond.hint}</div>
        </div>
        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${CONFIDENCE_STYLES[cond.confidence]}`}>
          {CONFIDENCE_LABELS[cond.confidence]}
        </span>
      </div>
      {!hasPrice ? (
        <div className="mt-3 text-xs text-slate-500">Sin compras ni ventas para calcular esta condición.</div>
      ) : (
        <>
          <div className="mt-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Se vende en</div>
            <div className="text-xl font-bold text-blue-800">{fmtPEN(cond.sale)}</div>
            <div className="text-[11px] text-slate-500">
              {sourceText(cond)}
              {cond.nSales > 1 && cond.saleMin != null ? ` · vendido entre ${fmtPEN(cond.saleMin)} y ${fmtPEN(cond.saleMax)}` : ''}
            </div>
          </div>
          <div className="mt-3 rounded-md bg-emerald-50 px-2 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Si te lo ofrecen en soles</div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-slate-600">ofrece</span>
              <strong className="text-emerald-900">{fmtPEN(cond.idealCostSoles)}</strong>
              <span className="text-xs text-slate-600">· máximo</span>
              <strong className="text-emerald-900">{fmtPEN(cond.maxCostSoles)}</strong>
            </div>
          </div>
          <div className="mt-2 rounded-md bg-amber-50 px-2 py-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Si lo compras en USD (eBay/USA)</div>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-xs text-slate-600">ofrece</span>
              <strong className="text-amber-900">{fmtUSD(cond.idealUsd)}</strong>
              <span className="text-xs text-slate-600">· máximo</span>
              <strong className="text-amber-900">{fmtUSD(cond.maxUsd)}</strong>
            </div>
            <div className="text-[11px] text-slate-500">ya descuenta envío e impuestos ≈ {fmtPEN(cond.shippingSoles || 0)}</div>
          </div>
          <div className="mt-2 text-[11px] text-slate-600">
            Pagando el máximo ganas ≈ <strong>{fmtPEN(cond.sale - cond.maxCostSoles)}</strong> ({fmtPct(cond.markup)} sobre el costo).
            {cond.nSales > 0 && cond.gainMedian != null ? <> Históricamente ganaste {fmtPEN(cond.gainMedian)} por equipo.</> : null}
          </div>
          {(cond.nPurchases > 0 || cond.paidUsdMedian) && (
            <div className="mt-1 text-[11px] text-slate-400">
              {cond.nPurchases} {cond.nPurchases === 1 ? 'compra' : 'compras'} · pagaste normalmente {fmtUSD(cond.paidUsdMedian)} ({fmtPEN(cond.paidSolesMedian)} puesto)
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OfferCalculator({ analysis, tc }) {
  const options = analysis.conditions.filter((c) => c.sale != null);
  const [condKey, setCondKey] = useState(options[0]?.key || '');
  const [currency, setCurrency] = useState('PEN');
  const [price, setPrice] = useState('');
  const condition = options.find((c) => c.key === condKey) || options[0];
  const result = condition ? evaluateOffer({ price, currency, condition, tc }) : null;
  if (!options.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="font-semibold text-slate-800">¿Te ofrecieron uno? Evalúa la oferta</div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-600">Condición
          <select className="rounded border px-2 py-1 text-sm" value={condition?.key} onChange={(e) => setCondKey(e.target.value)} aria-label="Condición de la oferta">
            {options.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </label>
        <div className="flex flex-col gap-1 text-xs text-slate-600">Moneda
          <div className="flex overflow-hidden rounded border">
            {[['PEN', 'Soles'], ['USD', 'USD (eBay)']].map(([key, label]) => (
              <button key={key} type="button" className={`px-2 py-1 text-sm ${currency === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'}`} onClick={() => setCurrency(key)}>{label}</button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-600">Precio ofrecido
          <input type="number" min="0" inputMode="decimal" className="w-32 rounded border px-2 py-1 text-sm" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={currency === 'PEN' ? 'S/' : 'USD'} aria-label="Precio ofrecido" />
        </label>
      </div>
      {result && (
        <div className={`mt-2 rounded-md border px-3 py-2 ${VERDICT_STYLES[result.verdict]}`} role="status">
          <div className="font-semibold">{VERDICT_LABELS[result.verdict]}</div>
          <div className="text-xs">
            Te costaría {fmtPEN(result.costSoles)}{result.shippingSoles ? ` (incluye ≈ ${fmtPEN(result.shippingSoles)} de envío e impuestos)` : ''}.
            {' '}Vendiéndolo en {fmtPEN(condition.sale)} ganarías {fmtPEN(result.gain)} ({fmtPct(result.markup)} sobre el costo).
          </div>
        </div>
      )}
    </div>
  );
}

function ModelCard({ analysis, estadoFilter, tc, onOpenCurves }) {
  const [showDetail, setShowDetail] = useState(false);
  const conditions = analysis.conditions.filter((c) => {
    if (estadoFilter === 'nuevo') return c.key === 'nuevo';
    if (estadoFilter === 'usado') return c.key !== 'nuevo';
    return true;
  });
  const ventasByProducto = new Map(analysis.ventas.map((v) => [v.productoId, v]));
  const best = [...conditions].filter((c) => c.nSales > 0).sort((a, b) => b.nSales - a.nSales)[0];
  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs capitalize text-gray-500">{analysis.tipo}</div>
          <div className="text-lg font-semibold">{analysis.label}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            {analysis.ram && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">RAM {analysis.ram}</span>}
            {analysis.ssd && <span className="rounded-full bg-blue-50 px-2.5 py-1 text-blue-700">{analysis.tipo === 'iphone' || analysis.tipo === 'ipad' ? 'Almacenamiento' : 'SSD'} {analysis.ssd}</span>}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{analysis.nPurchases} compras · {analysis.nSales} ventas</span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
              {analysis.rotationDays != null ? `${rotationLabel(analysis.rotationDays)}: ~${Math.round(analysis.rotationDays)} días en venderse` : rotationLabel(null)}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50" onClick={() => setShowDetail((v) => !v)}>
            {showDetail ? 'Ocultar compras y ventas' : 'Ver compras y ventas'}
          </button>
          <button type="button" className="rounded border border-indigo-200 bg-white px-2 py-1 text-xs text-indigo-700 hover:bg-indigo-50" onClick={() => onOpenCurves?.(analysis)}>
            Ver curvas
          </button>
        </div>
      </div>
      {best && (
        <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <strong>{best.label}:</strong> se vende en ~{fmtPEN(best.sale)}. Paga como máximo {fmtPEN(best.maxCostSoles)} si te lo ofrecen en soles, o {fmtUSD(best.maxUsd)} en eBay.
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {conditions.map((cond) => <ConditionCard key={cond.key} cond={cond} />)}
      </div>
      <OfferCalculator analysis={{ ...analysis, conditions }} tc={tc} />
      {showDetail && (
        <div className="max-h-72 overflow-auto rounded border">
          <table className="w-full min-w-[960px] text-xs text-gray-700">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-2 py-1 text-left">Fecha compra</th>
                <th className="px-2 py-1 text-left">Condición</th>
                <th className="px-2 py-1 text-left">Pagado (USD)</th>
                <th className="px-2 py-1 text-left">Costo puesto (S/)</th>
                <th className="px-2 py-1 text-left">Fecha venta</th>
                <th className="px-2 py-1 text-left">Vendido (S/)</th>
                <th className="px-2 py-1 text-left">Ganancia</th>
                <th className="px-2 py-1 text-left">% sobre costo</th>
                <th className="px-2 py-1 text-left">Días</th>
              </tr>
            </thead>
            <tbody>
              {analysis.compras.map((row) => {
                const venta = ventasByProducto.get(row.productoId);
                return (
                  <tr key={`row-${row.productoId}`} className="border-t">
                    <td className="px-2 py-1">{fmtDate(row.fechaCompra)}</td>
                    <td className="px-2 py-1">{conditionLabel(row.condicion)}</td>
                    <td className="px-2 py-1">{fmtUSD(row.precioUSD)}</td>
                    <td className="px-2 py-1 font-semibold">{fmtPEN(row.costoTotal)}</td>
                    <td className="px-2 py-1">{venta ? fmtDate(venta.fechaVenta) : 'En stock'}</td>
                    <td className="px-2 py-1">{venta ? fmtPEN(venta.precioVenta) : '-'}</td>
                    <td className="px-2 py-1">{venta ? fmtPEN(venta.ganancia) : '-'}</td>
                    <td className="px-2 py-1">{venta && Number.isFinite(Number(venta.porcentaje)) ? `${Number(venta.porcentaje).toFixed(1)} %` : '-'}</td>
                    <td className="px-2 py-1">{venta && venta.dias != null ? `${venta.dias} d` : '-'}</td>
                  </tr>
                );
              })}
              {!analysis.compras.length && (
                <tr className="border-t"><td className="px-2 py-2 text-center text-gray-500" colSpan={9}>No hay compras registradas para este modelo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * @param {{ groups: object[], allGroups: object[], estadoFilter?: string, tc: number, tcLabel?: string, onOpenCurves?: (model: object) => void, now?: number }} props
 */
export default function ProductAnalysisPanel({ groups, allGroups, estadoFilter = '', tc, tcLabel, onOpenCurves, now }) {
  const factorsFor = useMemo(
    () => buildConditionFactors(mergeGroupsByModel(allGroups || groups || []), now),
    [allGroups, groups, now],
  );
  const analyses = useMemo(
    () => mergeGroupsByModel(groups || []).map((model) => analyzeModel(model, { now, tc, factorsFor })),
    [groups, tc, factorsFor, now],
  );
  return (
    <div className="space-y-4">
      <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-700">Cómo leer este análisis</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Se vende en</strong>: precio típico de venta (mediana; lo vendido en los últimos 90 días pesa el doble y se ignoran precios atípicos).</li>
          <li>Cada modelo se separa en <strong>nuevo, usado con caja, usado solo accesorios y usado simple</strong>. Si una condición tiene menos de 3 ventas, se completa con lo que valen las otras condiciones del mismo modelo, según la diferencia de precio medida en todo el historial.</li>
          <li><strong>Máximo a pagar</strong>: deja la ganancia objetivo según rotación: 22 % si se vende en menos de 7 días, 30 % hasta 30 días y 40 % si tarda más. <strong>Ofrece</strong> es el {Math.round(OFFER_FACTOR * 100)} % del máximo, para negociar.</li>
          <li><strong>En soles</strong> es lo que pagarías a alguien en Perú (sin envío). <strong>En USD</strong> ya descuenta el envío e impuestos que pagaste normalmente por ese modelo. TC usado: {tc ? tc.toFixed(3) : '-'}{tcLabel ? ` (${tcLabel})` : ''}.</li>
          <li><strong>Confianza</strong>: alta con 5 o más ventas en esa condición, media con 3–4 o si se estimó desde otras condiciones con datos suficientes, baja con 1–2 o pocos datos.</li>
        </ul>
      </details>
      {!analyses.length && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No hay productos para esta combinación de filtros. Prueba limpiando uno de ellos.
        </div>
      )}
      {analyses.map((analysis) => (
        <ModelCard key={analysis.key} analysis={analysis} estadoFilter={estadoFilter} tc={tc} onOpenCurves={onOpenCurves} />
      ))}
    </div>
  );
}
