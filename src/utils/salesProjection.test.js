import { availableProjectionBaseYears, buildProjectionHistory, buildSalesProjection } from './salesProjection';

const sale = (month, ventas, ticket = 1000) => ({ month, ventas, ingresos: ventas * ticket, ganancia: ventas * ticket * 0.2 });
const purchase = (month, count, cost = 600) => Array.from({ length: count }, (_, i) => ({ fechaCompra: `${month}-${String(i + 1).padStart(2, '0')}`, costoTotal: cost }));

test('2025 usa solo agosto a diciembre y actualiza el ritmo con meses cerrados de 2026', () => {
  const history = buildProjectionHistory([
    sale('2025-07', 100), ...[8, 9, 10, 11, 12].map((m) => sale(`2025-${String(m).padStart(2, '0')}`, 2)),
    sale('2026-01', 8), sale('2026-02', 8), sale('2026-03', 8),
  ], [
    ...purchase('2025-07', 40), ...[8, 9, 10, 11, 12].flatMap((m) => purchase(`2025-${String(m).padStart(2, '0')}`, 2)),
    ...purchase('2026-01', 8), ...purchase('2026-02', 8), ...purchase('2026-03', 8),
  ]);
  expect(availableProjectionBaseYears(history, new Date(2026, 3, 9))).toEqual([2025]);
  const result = buildSalesProjection(history, 2025, new Date(2026, 3, 9));
  expect(result.baselineMonths).toEqual([8, 9, 10, 11, 12]);
  expect(result.months[0].projected).toMatchObject({ ventas: 2, compras: 2, ingresos: 2000 });
  expect(result.months[1].projected.ventas).toBeGreaterThan(2);
  expect(result.months[3].projected.ventas).toBeCloseTo(6.2);
  expect(result.months[3].projectedToDate.ingresos).toBeCloseTo(result.months[3].projected.ingresos * 9 / 30, 1);
  expect(result.months[4].actual).toBeNull();
  expect(result.actualToDate.ventas).toBe(24);
});

test('la comparación histórica no usa ventas registradas después del mes estimado', () => {
  const base = [8, 9, 10, 11, 12].map((m) => sale(`2025-${m}`, 2));
  const before = buildProjectionHistory([...base, sale('2026-01', 4)]);
  const after = buildProjectionHistory([...base, sale('2026-01', 4), sale('2026-02', 80)]);
  const janBefore = buildSalesProjection(before, 2025, new Date(2026, 2, 9)).months[0].projected;
  const janAfter = buildSalesProjection(after, 2025, new Date(2026, 2, 9)).months[0].projected;
  expect(janAfter).toEqual(janBefore);
});

test('a mitad de 2026 permite proyectar 2027 con los meses cerrados de 2026', () => {
  const history = buildProjectionHistory([
    sale('2025-08', 2), ...Array.from({ length: 9 }, (_, i) => sale(`2026-${String(i + 1).padStart(2, '0')}`, 4)),
  ], Array.from({ length: 9 }, (_, i) => purchase(`2026-${String(i + 1).padStart(2, '0')}`, 3)).flat());
  expect(availableProjectionBaseYears(history, new Date(2026, 9, 9))).toEqual([2026, 2025]);
  const result = buildSalesProjection(history, 2026, new Date(2026, 9, 9));
  expect(result.baselineMonths).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  expect(result.months[0].actual).toBeNull();
  expect(result.projectedFullYear).toMatchObject({ ventas: 48, compras: 36, ingresos: 48000 });
});

test('usa estacionalidad solo tras dos años completos', () => {
  const sales = [2026, 2027].flatMap((year) => Array.from({ length: 12 }, (_, i) => sale(`${year}-${String(i + 1).padStart(2, '0')}`, i === 0 ? 10 : 2)));
  const history = buildProjectionHistory(sales);
  const result = buildSalesProjection(history, 2027, new Date(2028, 0, 9));
  expect(result.months[0].projected.ventas).toBeGreaterThan(result.months[1].projected.ventas);
});
