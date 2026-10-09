const METRICS = ['compras', 'ventas', 'gastos', 'ingresos', 'ganancia'];
const round = (value) => Math.round((Number(value) || 0) * 100) / 100;
const empty = () => ({ compras: 0, ventas: 0, gastos: 0, ingresos: 0, ganancia: 0 });
const keyFor = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const sum = (rows, field) => Object.fromEntries(METRICS.map((metric) => [metric,
  round(rows.reduce((total, row) => total + (Number((field ? row[field] : row)?.[metric]) || 0), 0))]));
const average = (rows, key) => rows.length ? rows.reduce((total, row) => total + row[key], 0) / rows.length : 0;

export function buildProjectionHistory(salesRows = [], purchases = []) {
  const byMonth = new Map();
  for (const sale of salesRows || []) {
    const month = String(sale?.month || '').slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;
    const row = byMonth.get(month) || empty();
    row.ventas += Number(sale?.ventas ?? sale?.cantidad ?? sale?.count ?? 0) || 0;
    row.ingresos += Number(sale?.ingresos || 0) || 0;
    row.ganancia += Number(sale?.ganancia || 0) || 0;
    byMonth.set(month, row);
  }
  for (const purchase of purchases || []) {
    const month = String(purchase?.fechaCompra || '').slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) continue;
    const row = byMonth.get(month) || empty();
    row.compras += 1;
    row.gastos += Number(purchase?.costoTotal || 0) || 0;
    byMonth.set(month, row);
  }
  return byMonth;
}

export function availableProjectionBaseYears(history, asOf = new Date()) {
  return Array.from(new Set(Array.from(history.keys())
    .filter((month) => month.slice(0, 4) !== '2025' || Number(month.slice(5, 7)) >= 8)
    .map((month) => Number(month.slice(0, 4)))
    .filter((year) => year >= 2025 && (year < asOf.getFullYear() || (year === asOf.getFullYear() && asOf.getMonth() >= 6)))))
    .sort((a, b) => b - a);
}

// Past months only see earlier data. Future months use actuals through the last completed month.
export function buildSalesProjection(history, baseYear, asOf = new Date()) {
  const targetYear = Number(baseYear) + 1;
  const baseStart = Number(baseYear) === 2025 ? 8 : 1;
  const baseEnd = Number(baseYear) === asOf.getFullYear() ? asOf.getMonth() : 12;
  const firstKey = keyFor(baseYear, baseStart);
  const historyStart = Number(baseYear) === 2025 ? firstKey : '2026-01';
  const currentKey = keyFor(asOf.getFullYear(), asOf.getMonth() + 1);
  const lastCompletedKey = keyFor(asOf.getFullYear(), asOf.getMonth());
  const earliestActual = Array.from(history.keys()).some((key) => key >= historyStart) ? historyStart : undefined;

  const estimate = (monthKey) => {
    const cutoff = monthKey <= currentKey ? monthKey : currentKey;
    const observed = [];
    if (earliestActual) {
      for (let key = earliestActual; key < cutoff; ) {
        if (key >= historyStart && key <= lastCompletedKey) observed.push({ key, ...(history.get(key) || empty()) });
        const [year, month] = key.split('-').map(Number);
        key = keyFor(month === 12 ? year + 1 : year, month === 12 ? 1 : month + 1);
      }
    }
    if (!observed.length) return empty();
    const recent = observed.slice(-3);
    const baseline = observed.filter(({ key }) => key.startsWith(`${baseYear}-`));
    const base = baseline.length ? baseline : observed;
    const fullYears = [...new Set(observed.map(({ key }) => Number(key.slice(0, 4))))]
      .filter((year) => year >= 2026 && observed.filter(({ key }) => key.startsWith(`${year}-`)).length === 12)
      .slice(-2);
    const seasonalFactor = (metric) => {
      if (fullYears.length < 2) return 1;
      const targetMonth = monthKey.slice(5, 7);
      const ratios = fullYears.map((year) => {
        const rows = observed.filter(({ key }) => key.startsWith(`${year}-`));
        const annualMean = average(rows, metric);
        const sameMonth = rows.find(({ key }) => key === `${year}-${targetMonth}`);
        return annualMean > 0 ? sameMonth[metric] / annualMean : 1;
      });
      return Math.max(0.5, Math.min(1.5, ratios.reduce((total, ratio) => total + ratio, 0) / ratios.length));
    };
    const monthlyRate = (metric) => (recent.length >= 3 && baseline.length
      ? 0.7 * average(recent, metric) + 0.3 * average(base, metric) : average(recent, metric)) * seasonalFactor(metric);
    // Weighted unit economics use transaction totals, not volatile monthly ratios.
    const totals = sum(observed.slice(-6));
    const fallback = sum(base);
    const ticket = totals.ventas ? totals.ingresos / totals.ventas : fallback.ventas ? fallback.ingresos / fallback.ventas : 0;
    const unitCost = totals.compras ? totals.gastos / totals.compras : fallback.compras ? fallback.gastos / fallback.compras : 0;
    const margin = totals.ingresos ? totals.ganancia / totals.ingresos : fallback.ingresos ? fallback.ganancia / fallback.ingresos : 0;
    const ventas = Math.max(0, monthlyRate('ventas'));
    const compras = Math.max(0, monthlyRate('compras'));
    const ingresos = Math.max(0, ventas * ticket);
    return { ventas: round(ventas), compras: round(compras), ingresos: round(ingresos),
      gastos: round(Math.max(0, compras * unitCost)), ganancia: round(ingresos * margin) };
  };

  const months = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const key = keyFor(targetYear, month);
    const projected = estimate(key);
    const currentMonth = key === currentKey;
    const complete = key < currentKey;
    const elapsed = currentMonth ? asOf.getDate() / new Date(targetYear, month, 0).getDate() : 1;
    const actual = key <= currentKey ? Object.fromEntries(METRICS.map((metric) => [metric, round((history.get(key) || empty())[metric])])) : null;
    const projectedToDate = Object.fromEntries(METRICS.map((metric) => [metric, round(projected[metric] * elapsed)]));
    return { month: key, projected, projectedToDate, actual, currentMonth, complete };
  });
  const compared = months.filter((month) => month.actual);
  const completed = months.filter((month) => month.complete);
  const scored = completed.filter((month) => earliestActual && month.month > earliestActual);
  const errorAmount = scored.reduce((total, month) => total + Math.abs(month.actual.ingresos - month.projected.ingresos), 0);
  const actualAmount = scored.reduce((total, month) => total + month.actual.ingresos, 0);
  const errorPct = scored.length >= 3 && actualAmount > 0 ? round(100 * errorAmount / actualAmount) : null;
  return {
    baseYear: Number(baseYear), targetYear, baselineMonths: Array.from({ length: baseEnd - baseStart + 1 }, (_, i) => baseStart + i),
    months, monthsCompared: compared.length, errorPct, scoredMonths: scored.length,
    projectedFullYear: sum(months, 'projected'), projectedToDate: sum(compared, 'projectedToDate'),
    actualToDate: sum(compared, 'actual'),
  };
}
