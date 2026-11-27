// Análisis de productos: precio de venta esperado y cuánto pagar al comprar,
// separado por condición (nuevo / usado con caja / usado solo accesorios / usado simple).
// Funciones puras: la pestaña Análisis → Análisis de productos solo muestra lo que sale de aquí.

const DAY_MS = 24 * 60 * 60 * 1000;

export const CONDITIONS = [
  { key: 'nuevo', label: 'Nuevo', hint: 'Sellado o sin uso, con su caja' },
  { key: 'usado_caja', label: 'Usado con caja', hint: 'Trae la caja (y lo que venga con ella)' },
  { key: 'usado_accesorios', label: 'Usado solo accesorios', hint: 'Sin caja, con cargador, cable u otros' },
  { key: 'usado_simple', label: 'Usado simple', hint: 'Solo el equipo, sin caja ni accesorios' },
];

/** Precio típico de cada condición relativo a "usado con caja" cuando no hay datos para medirlo. */
export const DEFAULT_CONDITION_FACTORS = { nuevo: 1.15, usado_caja: 1, usado_accesorios: 0.95, usado_simple: 0.9 };

/** Ganancia sobre costo que se busca según lo rápido que se vende el modelo. */
export const MARKUP_BY_ROTATION = { rapida: 0.22, normal: 0.3, lenta: 0.4, sinDatos: 0.3 };

/** Al negociar se abre con este % del máximo. */
export const OFFER_FACTOR = 0.9;

const RECENT_DAYS = 90;
const MIN_SALES_OWN = 3;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const positive = (value) => {
  const n = num(value);
  return n != null && n > 0 ? n : null;
};

export const median = (values) => {
  const clean = (values || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
};

const quantile = (sorted, q) => {
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] != null ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
};

/** Quita atípicos (regla IQR 1.5) cuando hay al menos 4 valores. */
export const trimOutliers = (items, pick = (x) => x) => {
  if (items.length < 4) return items;
  const sorted = items.map(pick).sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  return items.filter((item) => pick(item) >= lo && pick(item) <= hi);
};

/** Mediana ponderada: cada elemento { value, weight }. */
export const weightedMedian = (items) => {
  const clean = items.filter((it) => Number.isFinite(it.value) && it.weight > 0).sort((a, b) => a.value - b.value);
  if (!clean.length) return null;
  const total = clean.reduce((s, it) => s + it.weight, 0);
  let acc = 0;
  for (let i = 0; i < clean.length; i += 1) {
    acc += clean[i].weight;
    if (acc > total / 2) return clean[i].value;
    if (acc === total / 2) return (clean[i].value + clean[i + 1].value) / 2;
  }
  return clean[clean.length - 1].value;
};

const ts = (value) => {
  if (!value) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
};

const roundTo = (value, step, mode = 'round') => {
  if (value == null || !Number.isFinite(value)) return null;
  const fn = mode === 'down' ? Math.floor : mode === 'up' ? Math.ceil : Math.round;
  // Pequeño margen para que 2590 / 3.7 no quede en 699.999… por coma flotante.
  return fn(value / step + (mode === 'down' ? 1e-9 : mode === 'up' ? -1e-9 : 0)) * step;
};

export const normalizeEstado = (value) => {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'nuevo' || s === 'new') return 'nuevo';
  return 'usado';
};

export const conditionKey = (estado, accesoriosCategoria) => {
  if (normalizeEstado(estado) === 'nuevo') return 'nuevo';
  if (accesoriosCategoria === 'caja') return 'usado_caja';
  if (accesoriosCategoria === 'accesorios') return 'usado_accesorios';
  return 'usado_simple';
};

export const conditionLabel = (key) => CONDITIONS.find((c) => c.key === key)?.label || key;

export const modelLabel = (group) => {
  if (group?.tipo !== 'iphone') return group?.label || group?.tipo || 'Producto';
  const labelRaw = String(group?.label || '').trim();
  const gamaRaw = String(group?.gama || '').trim();
  const numFromLabel = labelRaw.match(/iphone\s*(\d+)/i)?.[1] || labelRaw.match(/\b(\d{2})\b/)?.[1] || '';
  const numFromGama = gamaRaw.match(/(\d+)/)?.[1] || '';
  const n = numFromGama || numFromLabel;
  const rest = gamaRaw.replace(/\d+/g, '').trim() || labelRaw.replace(/iphone\s*\d*/i, '').trim();
  if (n) return rest ? `iPhone ${n} ${rest}` : `iPhone ${n}`;
  return gamaRaw ? `iPhone ${gamaRaw}` : 'iPhone';
};

const modelKeyOf = (g) => [g.tipo || 'otro', g.gama || '-', g.proc || '-', g.pantalla || '-', g.ram || '-', g.ssd || '-'].join('|');

/**
 * Junta los grupos del backend (que vienen separados por estado) en un modelo,
 * y etiqueta cada compra y venta con su condición.
 */
export const mergeGroupsByModel = (groups = []) => {
  const byKey = new Map();
  for (const g of groups) {
    const key = modelKeyOf(g);
    const model = byKey.get(key) || {
      key, tipo: g.tipo, gama: g.gama, proc: g.proc, pantalla: g.pantalla, ram: g.ram, ssd: g.ssd,
      label: modelLabel(g), estados: [], compras: [], ventas: [],
    };
    const estado = normalizeEstado(g.estado);
    if (!model.estados.includes(estado)) model.estados.push(estado);
    for (const c of g.comprasDetalle || []) {
      model.compras.push({ ...c, estadoNorm: estado, condicion: conditionKey(estado, c.accesoriosCategoria) });
    }
    for (const v of g.ventasDetalle || []) {
      model.ventas.push({ ...v, estadoNorm: estado, condicion: conditionKey(estado, v.accesoriosCategoria) });
    }
    byKey.set(key, model);
  }
  return [...byKey.values()]
    .map((m) => ({
      ...m,
      compras: m.compras.sort((a, b) => (ts(a.fechaCompra) || 0) - (ts(b.fechaCompra) || 0)),
      ventas: m.ventas.sort((a, b) => (ts(a.fechaVenta) || 0) - (ts(b.fechaVenta) || 0)),
    }))
    .sort((a, b) => b.ventas.length - a.ventas.length || b.compras.length - a.compras.length);
};

/** Precio de venta típico: mediana con más peso a lo vendido en los últimos 90 días, sin atípicos. */
export const salePriceStats = (ventas, now = Date.now()) => {
  const items = ventas
    .map((v) => ({ value: positive(v.precioVenta), t: ts(v.fechaVenta) }))
    .filter((it) => it.value != null);
  if (!items.length) return null;
  const kept = trimOutliers(items, (it) => it.value);
  const weighted = kept.map((it) => ({ value: it.value, weight: it.t != null && now - it.t <= RECENT_DAYS * DAY_MS ? 1 : 0.5 }));
  const values = kept.map((it) => it.value).sort((a, b) => a - b);
  const last = items.reduce((acc, it) => (it.t != null && (acc == null || it.t > acc) ? it.t : acc), null);
  return {
    value: weightedMedian(weighted),
    min: values[0],
    max: values[values.length - 1],
    n: items.length,
    outliers: items.length - kept.length,
    lastSaleDays: last != null ? Math.max(0, Math.round((now - last) / DAY_MS)) : null,
  };
};

export const rotationOf = (ventas) => median(ventas.map((v) => num(v.dias)).filter((d) => d != null && d >= 0));

export const rotationLabel = (days) => {
  if (days == null) return 'sin datos de rotación';
  if (days < 7) return 'se vende rápido';
  if (days <= 30) return 'rotación normal';
  return 'se vende lento';
};

export const targetMarkup = (rotationDays) => {
  if (rotationDays == null) return MARKUP_BY_ROTATION.sinDatos;
  if (rotationDays < 7) return MARKUP_BY_ROTATION.rapida;
  if (rotationDays <= 30) return MARKUP_BY_ROTATION.normal;
  return MARKUP_BY_ROTATION.lenta;
};

/** Envío + impuestos por compra en eBay/USA, en soles: costo total − precio USD × TC. */
export const shippingSolesOf = (compras, tc) => {
  if (!(tc > 0)) return null;
  const diffs = compras
    .map((c) => {
      const usd = positive(c.precioUSD);
      const total = positive(c.costoTotal);
      return usd && total ? total - usd * tc : null;
    })
    .filter((d) => d != null)
    .map((d) => Math.max(0, d));
  return median(diffs);
};

/**
 * Cuánto vale cada condición respecto a "usado con caja", medido en los modelos que
 * tienen ventas en ambas. Por tipo de producto; si no hay al menos 2 modelos, usa el
 * valor general y luego el predeterminado.
 */
export const buildConditionFactors = (models, now = Date.now()) => {
  const samples = {}; // tipo -> cond -> ratios
  const all = {};
  for (const m of models) {
    const byCond = {};
    for (const c of CONDITIONS) {
      const stats = salePriceStats(m.ventas.filter((v) => v.condicion === c.key), now);
      if (stats?.value) byCond[c.key] = stats.value;
    }
    if (!byCond.usado_caja) continue;
    for (const c of CONDITIONS) {
      if (c.key === 'usado_caja' || !byCond[c.key]) continue;
      const ratio = byCond[c.key] / byCond.usado_caja;
      const tipo = m.tipo || 'otro';
      samples[tipo] = samples[tipo] || {};
      (samples[tipo][c.key] = samples[tipo][c.key] || []).push(ratio);
      (all[c.key] = all[c.key] || []).push(ratio);
    }
  }
  const resolve = (tipo) => {
    const out = {};
    for (const c of CONDITIONS) {
      if (c.key === 'usado_caja') { out[c.key] = 1; continue; }
      const own = samples[tipo]?.[c.key] || [];
      const general = all[c.key] || [];
      if (own.length >= 2) out[c.key] = median(own);
      else if (general.length >= 2) out[c.key] = median(general);
      else out[c.key] = DEFAULT_CONDITION_FACTORS[c.key];
    }
    return out;
  };
  const cache = {};
  return (tipo) => {
    const k = tipo || 'otro';
    if (!cache[k]) cache[k] = resolve(k);
    return cache[k];
  };
};

const confidenceOf = ({ ownN, estimated, modelN }) => {
  if (ownN >= 5) return 'alta';
  if (ownN >= MIN_SALES_OWN) return 'media';
  if (estimated && modelN >= MIN_SALES_OWN) return 'media';
  if (ownN > 0 || modelN > 0) return 'baja';
  return 'sin_datos';
};

export const CONFIDENCE_LABELS = { alta: 'Confianza alta', media: 'Confianza media', baja: 'Confianza baja', sin_datos: 'Sin ventas' };

/**
 * Analiza un modelo ya unido (mergeGroupsByModel).
 * @param {object} model
 * @param {{ now?: number, tc: number, factorsFor: (tipo: string) => Record<string, number> }} opts
 */
export const analyzeModel = (model, { now = Date.now(), tc, factorsFor }) => {
  const factors = factorsFor ? factorsFor(model.tipo) : DEFAULT_CONDITION_FACTORS;
  const ventasPositivas = model.ventas.filter((v) => positive(v.precioVenta));
  const modelRotation = rotationOf(model.ventas);
  const modelShipping = shippingSolesOf(model.compras, tc);
  const perCond = CONDITIONS.map((c) => {
    const ventas = ventasPositivas.filter((v) => v.condicion === c.key);
    const compras = model.compras.filter((p) => p.condicion === c.key);
    return { ...c, ventas, compras, stats: salePriceStats(ventas, now) };
  });

  // Estimación desde las otras condiciones del mismo modelo, convertidas con los factores.
  const estimateFor = (key) => {
    let sum = 0;
    let weight = 0;
    for (const other of perCond) {
      if (other.key === key || !other.stats?.value) continue;
      sum += other.stats.value * (factors[key] / factors[other.key]) * other.stats.n;
      weight += other.stats.n;
    }
    return weight ? { value: sum / weight, n: weight } : null;
  };

  const conditions = perCond.map((c) => {
    const ownN = c.stats?.n || 0;
    const estimate = ownN < MIN_SALES_OWN ? estimateFor(c.key) : null;
    let sale = null;
    let source = 'sin_datos';
    if (ownN >= MIN_SALES_OWN) {
      sale = c.stats.value;
      source = 'propio';
    } else if (ownN > 0 && estimate) {
      // Pocas ventas propias: se mezclan con lo que dicen las otras condiciones.
      sale = (c.stats.value * ownN + estimate.value * (MIN_SALES_OWN - ownN)) / MIN_SALES_OWN;
      source = 'mixto';
    } else if (ownN > 0) {
      sale = c.stats.value;
      source = 'propio';
    } else if (estimate) {
      sale = estimate.value;
      source = 'estimado';
    }
    const rotationOwn = rotationOf(c.ventas);
    const rotationDays = rotationOwn != null && c.ventas.length >= 2 ? rotationOwn : modelRotation;
    const markup = targetMarkup(rotationDays);
    const shipping = shippingSolesOf(c.compras, tc) ?? modelShipping;
    const avgCost = median(c.compras.map((p) => positive(p.costoTotal)).filter(Boolean));
    if (sale == null && avgCost) {
      sale = avgCost * (1 + markup);
      source = 'costo';
    }
    const saleRounded = roundTo(sale, 10);
    const maxCostSoles = saleRounded ? roundTo(saleRounded / (1 + markup), 10, 'down') : null;
    const idealCostSoles = maxCostSoles ? roundTo(maxCostSoles * OFFER_FACTOR, 10, 'down') : null;
    const usdFrom = (soles) => (soles && tc > 0 ? Math.max(0, roundTo((soles - (shipping || 0)) / tc, 5, 'down')) : null);
    const ganancias = c.ventas.map((v) => num(v.ganancia)).filter((g) => g != null);
    const realMarkups = c.ventas.map((v) => num(v.porcentaje)).filter((p) => p != null);
    return {
      key: c.key,
      label: c.label,
      hint: c.hint,
      nSales: ownN,
      nPurchases: c.compras.length,
      sale: saleRounded,
      saleMin: c.stats?.min ?? null,
      saleMax: c.stats?.max ?? null,
      lastSaleDays: c.stats?.lastSaleDays ?? null,
      outliers: c.stats?.outliers || 0,
      source,
      confidence: source === 'costo' ? 'baja' : confidenceOf({ ownN, estimated: source === 'estimado' || source === 'mixto', modelN: ventasPositivas.length }),
      rotationDays,
      markup,
      shippingSoles: shipping != null ? roundTo(shipping, 10) : null,
      maxCostSoles,
      idealCostSoles,
      maxUsd: usdFrom(maxCostSoles),
      idealUsd: usdFrom(idealCostSoles),
      paidUsdMedian: median(c.compras.map((p) => positive(p.precioUSD)).filter(Boolean)),
      paidSolesMedian: avgCost,
      gainMedian: median(ganancias),
      realMarkupMedian: median(realMarkups),
    };
  });

  return {
    ...model,
    rotationDays: modelRotation,
    nSales: ventasPositivas.length,
    nPurchases: model.compras.length,
    shippingSoles: modelShipping != null ? roundTo(modelShipping, 10) : null,
    conditions,
  };
};

/** Texto corto de dónde sale el precio de venta. */
export const sourceText = (cond) => {
  switch (cond.source) {
    case 'propio': return `según ${cond.nSales} ${cond.nSales === 1 ? 'venta' : 'ventas'} en esta condición`;
    case 'mixto': return `${cond.nSales} ${cond.nSales === 1 ? 'venta propia' : 'ventas propias'} + estimado desde otras condiciones`;
    case 'estimado': return 'estimado desde otras condiciones del mismo modelo';
    case 'costo': return 'sin ventas: calculado desde lo que se pagó';
    default: return 'sin datos';
  }
};

/**
 * Evalúa una oferta concreta.
 * @param {{ price: number, currency: 'PEN'|'USD', condition: object, tc: number }} input
 */
export const evaluateOffer = ({ price, currency, condition, tc }) => {
  const p = positive(price);
  if (!p || !condition?.sale) return null;
  const shipping = currency === 'USD' ? (condition.shippingSoles || 0) : 0;
  const costSoles = currency === 'USD' ? (tc > 0 ? p * tc + shipping : null) : p;
  if (!costSoles) return null;
  const gain = condition.sale - costSoles;
  const markup = gain / costSoles;
  let verdict = 'cara';
  if (condition.idealCostSoles && costSoles <= condition.idealCostSoles) verdict = 'muy_buena';
  else if (condition.maxCostSoles && costSoles <= condition.maxCostSoles) verdict = 'buena';
  else if (markup >= 0.1) verdict = 'justa';
  return { costSoles, shippingSoles: shipping, gain, markup, verdict };
};

export const VERDICT_LABELS = {
  muy_buena: 'Muy buena compra',
  buena: 'Buena compra',
  justa: 'Justa: deja poco margen',
  cara: 'Cara: no conviene',
};
