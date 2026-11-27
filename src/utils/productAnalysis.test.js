import {
  analyzeModel, buildConditionFactors, conditionKey, evaluateOffer, mergeGroupsByModel,
  salePriceStats, shippingSolesOf, targetMarkup, weightedMedian,
} from './productAnalysis';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

const venta = (productoId, precioVenta, { d = 10, cat = 'caja', dias = 5, ganancia = 500 } = {}) => ({
  productoId, precioVenta, fechaVenta: daysAgo(d), accesoriosCategoria: cat, dias, ganancia, porcentaje: 20,
});
const compra = (productoId, precioUSD, costoTotal, cat = 'caja') => ({
  productoId, precioUSD, costoTotal, fechaCompra: daysAgo(30), accesoriosCategoria: cat,
});

const group = (estado, compras, ventas) => ({
  tipo: 'macbook', gama: 'Air', proc: 'M2', pantalla: '13', ram: '8GB', ssd: '256GB', estado, label: 'MacBook Air 13" M2',
  comprasDetalle: compras, ventasDetalle: ventas,
});

test('clasifica la condición por estado y presentación', () => {
  expect(conditionKey('nuevo', 'sin_nada')).toBe('nuevo');
  expect(conditionKey('new', 'caja')).toBe('nuevo');
  expect(conditionKey('usado', 'caja')).toBe('usado_caja');
  expect(conditionKey('usado', 'accesorios')).toBe('usado_accesorios');
  expect(conditionKey('usado', 'sin_nada')).toBe('usado_simple');
  expect(conditionKey('', undefined)).toBe('usado_simple');
});

test('une nuevo y usado del mismo modelo en una sola ficha', () => {
  const models = mergeGroupsByModel([
    group('nuevo', [compra(1, 900, 3600)], [venta(1, 4500)]),
    group('usado', [compra(2, 600, 2500, 'sin_nada')], [venta(2, 3200, { cat: 'sin_nada' })]),
  ]);
  expect(models).toHaveLength(1);
  expect(models[0].ventas.map((v) => v.condicion).sort()).toEqual(['nuevo', 'usado_simple']);
});

test('el precio de venta usa la mediana reciente e ignora atípicos', () => {
  const stats = salePriceStats([
    venta(1, 3300, { d: 200 }), venta(2, 3400, { d: 20 }), venta(3, 3500, { d: 15 }),
    venta(4, 3450, { d: 10 }), venta(5, 9999, { d: 5 }),
  ], NOW);
  expect(stats.outliers).toBe(1);
  expect(stats.value).toBe(3450);
  expect(stats.max).toBe(3500);
  expect(weightedMedian([{ value: 1, weight: 1 }, { value: 3, weight: 1 }])).toBe(2);
});

test('ganancia objetivo según rotación', () => {
  expect(targetMarkup(3)).toBe(0.22);
  expect(targetMarkup(15)).toBe(0.3);
  expect(targetMarkup(60)).toBe(0.4);
  expect(targetMarkup(null)).toBe(0.3);
});

test('el envío estimado sale de costo puesto menos precio en USD', () => {
  expect(shippingSolesOf([compra(1, 1000, 3900), compra(2, 800, 3100), compra(3, 500, 1800)], 3.7)).toBe(140);
});

test('compra máxima en soles (local) y en USD (eBay, descontando envío)', () => {
  const ventas = [1, 2, 3, 4, 5].map((id) => venta(id, 3500, { dias: 15 }));
  const compras = [1, 2, 3, 4, 5].map((id) => compra(id, 700, 2690));
  const [model] = mergeGroupsByModel([group('usado', compras, ventas)]);
  const result = analyzeModel(model, { now: NOW, tc: 3.7, factorsFor: buildConditionFactors([model], NOW) });
  const caja = result.conditions.find((c) => c.key === 'usado_caja');
  expect(caja).toEqual(expect.objectContaining({
    sale: 3500, confidence: 'alta', source: 'propio', markup: 0.3, shippingSoles: 100,
    maxCostSoles: 2690, idealCostSoles: 2420,
  }));
  // (2690 − 100) / 3.7 = 700 ; (2420 − 100) / 3.7 = 627 → 625
  expect(caja.maxUsd).toBe(700);
  expect(caja.idealUsd).toBe(625);
});

test('las condiciones sin ventas se estiman desde las otras con su factor', () => {
  const ventas = [1, 2, 3].map((id) => venta(id, 3000));
  const [model] = mergeGroupsByModel([group('usado', [], ventas)]);
  const result = analyzeModel(model, { now: NOW, tc: 3.7, factorsFor: () => ({ nuevo: 1.2, usado_caja: 1, usado_accesorios: 0.95, usado_simple: 0.9 }) });
  const simple = result.conditions.find((c) => c.key === 'usado_simple');
  expect(simple).toEqual(expect.objectContaining({ source: 'estimado', sale: 2700, confidence: 'media', nSales: 0 }));
  expect(result.conditions.find((c) => c.key === 'nuevo').sale).toBe(3600);
});

test('los factores se miden con modelos que tienen ambas condiciones', () => {
  const groups = [1, 2].map((n) => ({
    ...group('usado', [], [venta(n * 10, 3000, { cat: 'caja' }), venta(n * 10 + 1, 2400, { cat: 'sin_nada' })]),
    gama: `Air${n}`,
  }));
  const factorsFor = buildConditionFactors(mergeGroupsByModel(groups), NOW);
  expect(factorsFor('macbook').usado_simple).toBeCloseTo(0.8);
  expect(factorsFor('ipad').usado_simple).toBeCloseTo(0.8);
});

test('evaluar una oferta en soles y en USD', () => {
  const condition = { sale: 3500, maxCostSoles: 2690, idealCostSoles: 2420, shippingSoles: 100 };
  expect(evaluateOffer({ price: 2400, currency: 'PEN', condition, tc: 3.7 }).verdict).toBe('muy_buena');
  expect(evaluateOffer({ price: 2600, currency: 'PEN', condition, tc: 3.7 }).verdict).toBe('buena');
  const usd = evaluateOffer({ price: 800, currency: 'USD', condition, tc: 3.7 });
  expect(usd.costSoles).toBeCloseTo(3060);
  expect(usd.verdict).toBe('justa');
  expect(evaluateOffer({ price: 3400, currency: 'PEN', condition, tc: 3.7 }).verdict).toBe('cara');
});
