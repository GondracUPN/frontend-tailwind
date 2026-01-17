import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getProfitComparison } from '../../services/analytics';
import { formatCurrency, formatPercent } from './format';

function trendMeta(value) {
  if (value == null || value === 0) return { arrow: '->', cls: 'text-gray-500' };
  if (value > 0) return { arrow: '^', cls: 'text-emerald-600' };
  return { arrow: 'v', cls: 'text-red-600' };
}

function formatDelta(value, suffix = '') {
  if (value == null) return '--';
  const n = Number(value);
  if (!isFinite(n)) return '--';
  return `${n > 0 ? '+' : ''}${n}${suffix}`;
}

function SummaryCard({ title, current, previous, deltaAbs, deltaPct, isPercent }) {
  const trend = trendMeta(deltaAbs);
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="text-lg font-semibold mt-1">{current}</div>
      <div className="text-xs text-gray-500">Anterior: {previous}</div>
      <div className={`text-xs font-medium mt-1 ${trend.cls}`}>
        {trend.arrow} {formatDelta(deltaAbs, isPercent ? ' pp' : '')} ({formatDelta(deltaPct, '%')})
      </div>
    </div>
  );
}

function MarginSummaryCard({
  title,
  utilidad,
  utilidadPrev,
  utilidadDelta,
  markup,
  markupPrev,
  markupDelta,
}) {
  const trendU = trendMeta(utilidadDelta);
  const trendM = trendMeta(markupDelta);
  return (
    <div className="border rounded-lg p-3 bg-gray-50">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div>
          <div className="text-xs text-gray-500">Utilidad</div>
          <div className="text-lg font-semibold">{formatPercent(utilidad)}</div>
          <div className="text-xs text-gray-500">Anterior: {formatPercent(utilidadPrev)}</div>
          <div className={`text-xs font-medium mt-1 ${trendU.cls}`}>
            {trendU.arrow} {formatDelta(utilidadDelta, ' pp')}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Markup</div>
          <div className="text-lg font-semibold">{formatPercent(markup)}</div>
          <div className="text-xs text-gray-500">Anterior: {formatPercent(markupPrev)}</div>
          <div className={`text-xs font-medium mt-1 ${trendM.cls}`}>
            {trendM.arrow} {formatDelta(markupDelta, ' pp')}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfitComparison({ from, to, filters, mode = 'month', onModeChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const params = useMemo(() => ({ ...filters, from, to }), [filters, from, to]);

  const load = useCallback(async () => {
    if (!from || !to) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await getProfitComparison(params);
      setData(res);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, [from, to, params]);

  useEffect(() => {
    load();
  }, [load]);

  if (!from || !to) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="text-sm text-gray-500">Selecciona un rango de fechas para comparar.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5">
        <div className="h-40 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5 flex items-center justify-between">
        <div className="text-sm text-red-600">{error}</div>
        <button className="text-xs px-2 py-1 rounded border" onClick={load}>
          Reintentar
        </button>
      </div>
    );
  }

  if (!data?.current) {
    return (
      <div className="bg-white rounded-xl border shadow-sm p-5 text-sm text-gray-500">
        No hay datos para el rango seleccionado.
      </div>
    );
  }

  const { current, previous, delta, insights, previousRange } = data;
  const isYearMode = mode === 'year';
  const calcUtilidad = (m) => (m.income > 0 ? (m.profit / m.income) * 100 : 0);
  const calcMarkup = (m) => (m.cost > 0 ? (m.profit / m.cost) * 100 : 0);
  const utilidadCurr = calcUtilidad(current);
  const utilidadPrev = calcUtilidad(previous);
  const utilidadPp = +(utilidadCurr - utilidadPrev).toFixed(2);
  const markupCurr = calcMarkup(current);
  const markupPrev = calcMarkup(previous);
  const markupPp = +(markupCurr - markupPrev).toFixed(2);

  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Comparacion</h3>
          <div className="text-xs text-gray-500">
            Actual: {from} al {to} - Anterior: {previousRange?.from} al {previousRange?.to}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onModeChange ? (
            <button
              className="text-xs px-2 py-1 rounded border"
              onClick={() => onModeChange(isYearMode ? 'month' : 'year')}
            >
              {isYearMode ? 'Ver por mes' : 'Ver por año'}
            </button>
          ) : null}
          <button
            className="text-xs px-2 py-1 rounded border"
            onClick={() => setExpanded((s) => !s)}
          >
            {expanded ? 'Ocultar detalle' : 'Ver detalle'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <SummaryCard
          title="Ingresos"
          current={formatCurrency(current.income)}
          previous={formatCurrency(previous.income)}
          deltaAbs={delta.incomeAbs}
          deltaPct={delta.incomePct}
        />
        <SummaryCard
          title="Costos"
          current={formatCurrency(current.cost)}
          previous={formatCurrency(previous.cost)}
          deltaAbs={delta.costAbs}
          deltaPct={delta.costPct}
        />
        <SummaryCard
          title="Ganancia"
          current={formatCurrency(current.profit)}
          previous={formatCurrency(previous.profit)}
          deltaAbs={delta.profitAbs}
          deltaPct={delta.profitPct}
        />
        <MarginSummaryCard
          title="Margenes"
          utilidad={utilidadCurr}
          utilidadPrev={utilidadPrev}
          utilidadDelta={utilidadPp}
          markup={markupCurr}
          markupPrev={markupPrev}
          markupDelta={markupPp}
        />
        {current.orders != null ? (
          <SummaryCard
            title="Ventas totales"
            current={current.orders}
            previous={previous.orders}
            deltaAbs={delta.ordersAbs}
            deltaPct={delta.ordersPct}
          />
        ) : null}
        {current.avgTicket != null ? (
          <SummaryCard
            title="Ticket promedio"
            current={formatCurrency(current.avgTicket)}
            previous={formatCurrency(previous.avgTicket)}
            deltaAbs={delta.avgTicketAbs}
            deltaPct={delta.avgTicketPct}
          />
        ) : null}
      </div>

      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <div className="text-xs text-gray-500 mb-2">Insights</div>
        <ul className="space-y-1 text-sm text-gray-700">
          {(insights || []).map((ins, idx) => (
            <li
              key={`${ins.text}-${idx}`}
              className={ins.level === 'warning' ? 'text-red-600' : ins.level === 'success' ? 'text-emerald-700' : ''}
            >
              {ins.text}
            </li>
          ))}
        </ul>
      </div>

      {expanded ? (
        <div className="overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr className="text-left text-gray-600">
                <th className="py-2 px-3">Metrica</th>
                <th className="py-2 px-3">Actual</th>
                <th className="py-2 px-3">Anterior</th>
                <th className="py-2 px-3">Delta</th>
                <th className="py-2 px-3">Delta %</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-2 px-3">Ingresos</td>
                <td className="py-2 px-3">{formatCurrency(current.income)}</td>
                <td className="py-2 px-3">{formatCurrency(previous.income)}</td>
                <td className="py-2 px-3">{formatDelta(delta.incomeAbs)}</td>
                <td className="py-2 px-3">{formatDelta(delta.incomePct, '%')}</td>
              </tr>
              <tr className="border-t">
                <td className="py-2 px-3">Costos</td>
                <td className="py-2 px-3">{formatCurrency(current.cost)}</td>
                <td className="py-2 px-3">{formatCurrency(previous.cost)}</td>
                <td className="py-2 px-3">{formatDelta(delta.costAbs)}</td>
                <td className="py-2 px-3">{formatDelta(delta.costPct, '%')}</td>
              </tr>
              <tr className="border-t">
                <td className="py-2 px-3">Ganancia</td>
                <td className="py-2 px-3">{formatCurrency(current.profit)}</td>
                <td className="py-2 px-3">{formatCurrency(previous.profit)}</td>
                <td className="py-2 px-3">{formatDelta(delta.profitAbs)}</td>
                <td className="py-2 px-3">{formatDelta(delta.profitPct, '%')}</td>
              </tr>
              <tr className="border-t">
                <td className="py-2 px-3">Utilidad</td>
                <td className="py-2 px-3">{formatPercent(utilidadCurr)}</td>
                <td className="py-2 px-3">{formatPercent(utilidadPrev)}</td>
                <td className="py-2 px-3">{formatDelta(utilidadPp, ' pp')}</td>
                <td className="py-2 px-3">--</td>
              </tr>
              <tr className="border-t">
                <td className="py-2 px-3">Markup</td>
                <td className="py-2 px-3">{formatPercent(markupCurr)}</td>
                <td className="py-2 px-3">{formatPercent(markupPrev)}</td>
                <td className="py-2 px-3">{formatDelta(markupPp, ' pp')}</td>
                <td className="py-2 px-3">--</td>
              </tr>
              {current.orders != null ? (
                <tr className="border-t">
                  <td className="py-2 px-3">Ventas totales</td>
                  <td className="py-2 px-3">{current.orders}</td>
                  <td className="py-2 px-3">{previous.orders}</td>
                  <td className="py-2 px-3">{formatDelta(delta.ordersAbs)}</td>
                  <td className="py-2 px-3">{formatDelta(delta.ordersPct, '%')}</td>
                </tr>
              ) : null}
              {current.avgTicket != null ? (
                <tr className="border-t">
                  <td className="py-2 px-3">Ticket promedio</td>
                  <td className="py-2 px-3">{formatCurrency(current.avgTicket)}</td>
                  <td className="py-2 px-3">{formatCurrency(previous.avgTicket)}</td>
                  <td className="py-2 px-3">{formatDelta(delta.avgTicketAbs)}</td>
                  <td className="py-2 px-3">{formatDelta(delta.avgTicketPct, '%')}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
