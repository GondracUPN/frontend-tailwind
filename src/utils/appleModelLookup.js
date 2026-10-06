const compact = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Identificadores de los modelos modernos aceptados por el buscador de productos.
// Los códigos de pedido se guardan sin el sufijo regional (por ejemplo, LL/A).
const MACBOOK_RULES = [
  { models: [], orders: ['mhfa4', 'mhfd4', 'mhff4', 'mhfh4'], gama: 'Neo', procesador: 'A18 Pro', tamano: '13', ram: '8', almacenamiento: '256' },
  { models: [], orders: ['mhfc4', 'mhfe4', 'mhfg4', 'mhfj4'], gama: 'Neo', procesador: 'A18 Pro', tamano: '13', ram: '8', almacenamiento: '512' },
  { models: ['a3404'], orders: [], gama: 'Neo', procesador: 'A18 Pro', tamano: '13', ram: '8' },
  { models: ['a2336'], orders: [], gama: 'Pro', procesador: 'M1', tamano: '13' },
  { models: ['a2337'], orders: ['mgn63', 'mgn73'], gama: 'Air', procesador: 'M1', tamano: '13' },
  { models: ['a2681'], orders: ['mly33', 'mly43'], gama: 'Air', procesador: 'M2', tamano: '13' },
  { models: ['a2941'], orders: ['mqkw3'], gama: 'Air', procesador: 'M2', tamano: '15' },
  { models: ['a3113'], orders: ['mrxv3', 'mrxw3'], gama: 'Air', procesador: 'M3', tamano: '13' },
  { models: ['a3114'], orders: ['mryu3'], gama: 'Air', procesador: 'M3', tamano: '15' },
  { models: ['a3240'], orders: ['mc6t4', 'mw123', 'mw0y3', 'mw0w3', 'mc6u4', 'mc6v4', 'mw133', 'mc6c4', 'mw103', 'mc6a4', 'mw0x3', 'mc654'], gama: 'Air', procesador: 'M4', tamano: '13' },
  { models: ['a3241'], orders: ['mc7a4', 'mc7c4', 'mc7d4', 'mw1l3', 'mw1m3', 'mc6l4', 'mc6k4', 'mw1j3', 'mw1k3', 'mw1g3', 'mw1h3', 'mc6j4'], gama: 'Air', procesador: 'M4', tamano: '15' },
  { models: ['a3448'], orders: ['mdhh4', 'mdhj4'], gama: 'Air', procesador: 'M5', tamano: '13' },
  { models: ['a3449'], orders: ['mdvq4'], gama: 'Air', procesador: 'M5', tamano: '15' },
  { models: ['a2338'], orders: ['myd82', 'myda2'], gama: 'Pro', procesador: 'M1', tamano: '13' },
  { models: ['a2338'], orders: ['mneh3'], gama: 'Pro', procesador: 'M2', tamano: '13' },
  { models: ['a2442'], orders: ['mkgr3', 'mkgt3'], gama: 'Pro', procesador: 'M1 Pro', tamano: '14' },
  { models: ['a2485'], orders: ['mk1e3', 'mk1h3'], gama: 'Pro', procesador: 'M1 Pro', tamano: '16' },
  { models: ['a2779'], orders: ['mphe3', 'mphf3', 'mphg3'], gama: 'Pro', procesador: 'M2 Pro', tamano: '14' },
  { models: ['a2780'], orders: ['mnw83', 'mnwa3'], gama: 'Pro', procesador: 'M2 Pro', tamano: '16' },
  { models: ['a2918'], orders: ['mtl73'], gama: 'Pro', procesador: 'M3', tamano: '14' },
  { models: ['a2992'], orders: ['mrx33', 'mrx43', 'mrx53', 'muw63'], gama: 'Pro', procesador: 'M3 Pro', tamano: '14' },
  { models: ['a2991'], orders: ['mrw13', 'mrw33'], gama: 'Pro', procesador: 'M3 Pro', tamano: '16' },
  { models: ['a3112'], orders: ['mw2w3'], gama: 'Pro', procesador: 'M4', tamano: '14' },
  { models: ['a3401'], orders: ['mx2e3', 'mx2f3'], gama: 'Pro', procesador: 'M4 Pro', tamano: '14' },
  { models: ['a3185'], orders: ['mx2g3', 'mx2k3'], gama: 'Pro', procesador: 'M4 Max', tamano: '14' },
  { models: ['a3403'], orders: ['mx2t3'], gama: 'Pro', procesador: 'M4 Pro', tamano: '16' },
  { models: ['a3186'], orders: ['mx2v3', 'mx2w3'], gama: 'Pro', procesador: 'M4 Max', tamano: '16' },
  { models: ['a3434'], orders: ['mde44'], gama: 'Pro', procesador: 'M5', tamano: '14' },
  { models: ['a3426'], orders: ['mgdn4', 'mgdp4'], gama: 'Pro', procesador: 'M5 Pro', tamano: '14' },
  { models: ['a3427'], orders: ['mgdq4'], gama: 'Pro', procesador: 'M5 Max', tamano: '14' },
  { models: ['a3428'], orders: ['mge44', 'mge74'], gama: 'Pro', procesador: 'M5 Pro', tamano: '16' },
  { models: ['a3429'], orders: ['mge94'], gama: 'Pro', procesador: 'M5 Max', tamano: '16' },
];

const WATCH_RULES = [
  { models: ['a2997', 'a2999', 'a3001'], gama: 'Series', generacion: '10', tamano: '42 mm' },
  { models: ['a2998', 'a3000', 'a3002'], gama: 'Series', generacion: '10', tamano: '46 mm' },
  { models: ['a3331', 'a3335', 'a3450', 'a3452'], gama: 'Series', generacion: '11', tamano: '42 mm' },
  { models: ['a3333', 'a3337', 'a3451', 'a3453'], gama: 'Series', generacion: '11', tamano: '46 mm' },
  { models: ['a2722', 'a2724', 'a2726', 'a2855'], gama: 'SE', generacion: '2', tamano: '40 mm' },
  { models: ['a2723', 'a2725', 'a2727', 'a2856'], gama: 'SE', generacion: '2', tamano: '44 mm' },
  { models: ['a3324', 'a3326', 'a3327', 'a3391'], gama: 'SE', generacion: '3', tamano: '40 mm' },
  { models: ['a3325', 'a3328', 'a3329', 'a3392'], gama: 'SE', generacion: '3', tamano: '44 mm' },
  { models: ['a2986', 'a2987'], gama: 'Ultra', generacion: '2', tamano: '49 mm', conexion: 'GPS + Cel' },
  { models: ['a3281', 'a3282'], gama: 'Ultra', generacion: '3', tamano: '49 mm', conexion: 'GPS + Cel' },
];

const DESKTOP_RULES = [
  { tipo: 'imac', models: ['a2438', 'a2439'], procesador: 'M1', tamano: '24' },
  { tipo: 'imac', models: ['a2873', 'a2874'], procesador: 'M3', tamano: '24' },
  { tipo: 'imac', models: ['a3137'], procesador: 'M4', tamano: '24' },
  { tipo: 'imac', models: ['a3247'], procesador: 'M5', tamano: '24' },
  { tipo: 'macmini', models: ['a2348'], procesador: 'M1' },
  { tipo: 'macmini', models: ['a2686'], procesador: 'M2' },
  { tipo: 'macmini', models: ['a2816'], procesador: 'M2 Pro' },
  { tipo: 'macmini', models: ['a3238'], procesador: 'M4' },
  { tipo: 'macmini', models: ['a3239'], procesador: 'M4 Pro' },
];

const MACBOOK_MINIMUMS = {
  'Neo|A18 Pro': { ram: '8', almacenamiento: '256' },
  'Air|M1': { ram: '8', almacenamiento: '256' },
  'Air|M2': { ram: '8', almacenamiento: '256' },
  'Air|M3': { ram: '8', almacenamiento: '256' },
  'Air|M4': { ram: '16', almacenamiento: '256' },
  'Air|M5': { ram: '16', almacenamiento: '512' },
  'Pro|M1': { ram: '8', almacenamiento: '256' },
  'Pro|M2': { ram: '8', almacenamiento: '256' },
  'Pro|M1 Pro': { ram: '16', almacenamiento: '512' },
  'Pro|M2 Pro': { ram: '16', almacenamiento: '512' },
  'Pro|M3': { ram: '8', almacenamiento: '512' },
  'Pro|M3 Pro': { ram: '18', almacenamiento: '512' },
  'Pro|M4': { ram: '8', almacenamiento: '512' },
  'Pro|M4 Pro': { ram: '24', almacenamiento: '512' },
  'Pro|M4 Max': { ram: '48', almacenamiento: '1TB' },
  'Pro|M5': { ram: '16', almacenamiento: '512' },
  'Pro|M5 Pro': { ram: '24', almacenamiento: '512' },
  'Pro|M5 Max': { ram: '48', almacenamiento: '1TB' },
};

const DESKTOP_MINIMUMS = {
  M1: { ram: '8', almacenamiento: '256' },
  M2: { ram: '8', almacenamiento: '256' },
  'M2 Pro': { ram: '16', almacenamiento: '512' },
  M3: { ram: '8', almacenamiento: '256' },
  M4: { ram: '16', almacenamiento: '256' },
  'M4 Pro': { ram: '24', almacenamiento: '512' },
  M5: { ram: '16', almacenamiento: '256' },
};

const MACBOOK_WEIGHTS_KG = {
  'Neo|A18 Pro|13': 1.23,
  'Air|M1|13': 1.29,
  'Air|M2|13': 1.24,
  'Air|M2|15': 1.51,
  'Air|M3|13': 1.24,
  'Air|M3|15': 1.51,
  'Air|M4|13': 1.24,
  'Air|M4|15': 1.51,
  'Air|M5|13': 1.24,
  'Air|M5|15': 1.51,
  'Pro|M1|13': 1.4,
  'Pro|M2|13': 1.4,
  'Pro|M1 Pro|14': 1.6,
  'Pro|M1 Pro|16': 2.1,
  'Pro|M2 Pro|14': 1.6,
  'Pro|M2 Pro|16': 2.15,
  'Pro|M3|14': 1.55,
  'Pro|M3 Pro|14': 1.61,
  'Pro|M3 Pro|16': 2.14,
  'Pro|M4|14': 1.55,
  'Pro|M4 Pro|14': 1.6,
  'Pro|M4 Max|14': 1.62,
  'Pro|M4 Pro|16': 2.14,
  'Pro|M4 Max|16': 2.15,
  'Pro|M5|14': 1.55,
  'Pro|M5 Pro|14': 1.6,
  'Pro|M5 Max|14': 1.62,
  'Pro|M5 Pro|16': 2.14,
  'Pro|M5 Max|16': 2.15,
};

const DESKTOP_WEIGHTS_KG = {
  'imac|M1': 4.48,
  'imac|M3': 4.43,
  'imac|M4': 4.42,
  'imac|M5': 4.42,
  'macmini|M1': 1.2,
  'macmini|M2': 1.18,
  'macmini|M2 Pro': 1.28,
  'macmini|M4': 0.67,
  'macmini|M4 Pro': 0.73,
};

export const calculateShippingWeight = (productWeightKg) => {
  const weight = Number(productWeightKg);
  return Number.isFinite(weight) && weight > 0 ? Math.ceil(weight) + 1 : null;
};

const withWeight = (match, productWeightKg) => {
  const pesoEnvioKg = calculateShippingWeight(productWeightKg);
  return pesoEnvioKg
    ? { ...match, pesoProductoKg: productWeightKg, pesoEnvioKg }
    : match;
};

const findRule = (source, rules) =>
  rules.find((rule) => (rule.orders || []).some((id) => source.includes(id))) ||
  rules.find((rule) => (rule.models || []).some((id) => source.includes(id)));

const ruleIdentifier = (source, rule) =>
  [...(rule.models || []), ...(rule.orders || [])].find((id) => source.includes(id)) || '';

export const lookupAppleModel = (value) => {
  const source = compact(value);
  if (!source) return null;

  const macbook = findRule(source, MACBOOK_RULES);
  if (macbook) {
    const minimums = MACBOOK_MINIMUMS[`${macbook.gama}|${macbook.procesador}`] || {};
    const match = {
      tipo: 'macbook',
      ...minimums,
      ...macbook,
      identifier: ruleIdentifier(source, macbook).toUpperCase(),
    };
    return withWeight(match, MACBOOK_WEIGHTS_KG[`${match.gama}|${match.procesador}|${match.tamano}`]);
  }

  const watch = findRule(source, WATCH_RULES);
  if (watch) return withWeight(
    { tipo: 'watch', ...watch, identifier: ruleIdentifier(source, watch).toUpperCase() },
    watch.gama === 'Ultra' ? 0.061 : 0.04,
  );

  const desktop = findRule(source, DESKTOP_RULES);
  if (desktop) return withWeight({
    ...(DESKTOP_MINIMUMS[desktop.procesador] || {}),
    ...desktop,
    identifier: ruleIdentifier(source, desktop).toUpperCase(),
  }, DESKTOP_WEIGHTS_KG[`${desktop.tipo}|${desktop.procesador}`]);

  return null;
};

export const describeAppleModelMatch = (match) => {
  if (!match) return '';
  if (match.tipo === 'macbook') return ['MacBook', match.gama, match.procesador, match.tamano && `${match.tamano}″`].filter(Boolean).join(' ');
  if (match.tipo === 'watch') return ['Apple Watch', match.gama, match.generacion, match.tamano].filter(Boolean).join(' ');
  if (match.tipo === 'macmini') return ['Mac mini', match.procesador].filter(Boolean).join(' ');
  if (match.tipo === 'imac') return ['iMac', match.procesador, match.tamano && `${match.tamano}″`].filter(Boolean).join(' ');
  return '';
};
