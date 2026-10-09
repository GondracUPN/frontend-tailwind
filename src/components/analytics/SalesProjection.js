import React, { useMemo, useState } from 'react';
import { availableProjectionBaseYears, buildProjectionHistory, buildSalesProjection } from '../../utils/salesProjection';

const METRICS = [
  { key: 'compras', label: 'Compras', count: true },
  { key: 'ventas', label: 'Ventas', count: true },
  { key: 'gastos', label: 'Inversión en compras' },
  { key: 'ingresos', label: 'Ingresos' },
  { key: 'ganancia', label: 'Ganancia de ventas' },
];
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const format = (value, count = false) => count
  ? Number(value || 0).toLocaleString('es-PE', { maximumFractionDigits: 1 })
  : Number(value || 0).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });

export default function SalesProjection({ salesRows, purchases, error, loading = false, asOf = new Date() }) {
  const [chosenBaseYear, setChosenBaseYear] = useState(null);
  const history = useMemo(() => buildProjectionHistory(salesRows, purchases), [salesRows, purchases]);
  const baseYears = useMemo(() => availableProjectionBaseYears(history, asOf), [history, asOf]);
  const baseYear = baseYears.includes(chosenBaseYear) ? chosenBaseYear : baseYears.includes(asOf.getFullYear() - 1) ? asOf.getFullYear() - 1 : baseYears[0];
  const projection = useMemo(() => baseYear ? buildSalesProjection(history, baseYear, asOf) : null,
    [history, baseYear, asOf]);
  const futureYear = projection?.targetYear > asOf.getFullYear();

  return <section aria-label="Proyección económica" className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Proyección de {projection?.targetYear || asOf.getFullYear()}</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">{futureYear ? 'Pronóstico del próximo año a partir del ritmo de compras y ventas registrado hasta hoy.' : 'Resultados reales hasta hoy frente a lo proyectado mes a mes.'}</p>
      </div>
      {baseYears.length > 0 && <label className="text-xs font-medium text-slate-700">Año proyectado
        <select aria-label="Año proyectado" value={baseYear} onChange={(event) => setChosenBaseYear(Number(event.target.value))}
          className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          {baseYears.map((year) => <option key={year} value={year}>{year + 1}</option>)}
        </select>
      </label>}
    </div>
    {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>
      : loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Cargando historial...</p>
        : !projection ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Se necesitan compras o ventas registradas desde agosto de 2025 para iniciar la proyección.</p>
          : <>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 text-sm text-slate-700">
              <strong>Base histórica:</strong> {baseYear === 2025 ? 'agosto a diciembre de 2025' : `enero a ${MONTHS[projection.baselineMonths.at(-1) - 1].toLowerCase()} de ${baseYear}`}.
              {' '}El volumen combina el ritmo de los últimos 3 meses completos (70%) con el promedio del año base (30%).
              {' '}El ingreso por venta, costo por compra y margen usan totales de los últimos 6 meses cerrados.
              {' '}La estacionalidad entra en el cálculo cuando existen dos años completos de historial.
              {' '}El mes en curso se compara según los días transcurridos.
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {METRICS.map(({ key, label, count }) => {
                const actual = projection.actualToDate[key];
                const expected = projection.projectedToDate[key];
                const difference = actual - expected;
                const comparison = key === 'gastos' ? (difference <= 0 ? 'Por debajo de lo previsto' : 'Por encima de lo previsto')
                  : (difference >= 0 ? 'Supera lo previsto' : 'Por debajo de lo previsto');
                return <div key={key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-medium text-slate-500">{label}</div>
                <div className="mt-2 text-xl font-semibold text-slate-900">{format(futureYear ? projection.projectedFullYear[key] : actual, count)}</div>
                {futureYear
                  ? <div className="mt-1 text-xs text-slate-500">Proyección para {projection.targetYear}</div>
                  : <><div className="mt-1 text-xs text-slate-500">Real hasta hoy · Previsto: {format(expected, count)}</div>
                    <div className={`mt-3 border-t border-slate-100 pt-2 text-xs font-medium ${key === 'gastos' ? (difference <= 0 ? 'text-emerald-700' : 'text-amber-700') : (difference >= 0 ? 'text-emerald-700' : 'text-amber-700')}`}>
                      {comparison}: {difference >= 0 ? '+' : '−'}{format(Math.abs(difference), count)}
                    </div></>}
              </div>;
              })}
            </div>
            {!futureYear && <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-slate-900">Error histórico</h3>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{projection.errorPct == null ? 'Sin muestra suficiente' : `${projection.errorPct}%`}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{projection.errorPct == null
                  ? 'Hacen falta al menos 3 meses cerrados con proyección y ventas reales.'
                  : `Error absoluto de ingresos respecto a ingresos reales en ${projection.scoredMonths} meses cerrados. Una cifra menor indica mejor ajuste.`}</p>
              </div>}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[890px] w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-600"><tr><th className="px-3 py-3">Mes</th>
                  {METRICS.map(({ key, label }) => <th key={key} className="px-3 py-3">{label}<span className="block font-normal">Previsto / Real</span></th>)}
                </tr></thead>
                <tbody>{projection.months.map((row, index) => <tr key={row.month} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-3 text-left font-medium text-slate-800">{MONTHS[index]} {projection.targetYear}<span className="block text-[10px] font-normal text-slate-500">{row.currentMonth ? 'En curso' : row.complete ? 'Cerrado' : 'Pendiente'}</span></th>
                  {METRICS.map(({ key, count }) => <td key={key} className="px-3 py-3 whitespace-nowrap"><span className="text-slate-500">{format(row.actual ? row.projectedToDate[key] : row.projected[key], count)}</span><span className="mx-1 text-slate-300">/</span><span className={row.actual ? 'font-medium text-slate-900' : 'text-slate-400'}>{row.actual ? format(row.actual[key], count) : '—'}</span></td>)}
                </tr>)}</tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">La ganancia corresponde al margen de las ventas. La inversión en compras se muestra aparte para evitar contarla dos veces. La proyección es una estimación; los meses con pocos datos pueden variar mucho.</p>
          </>}
  </section>;
}
