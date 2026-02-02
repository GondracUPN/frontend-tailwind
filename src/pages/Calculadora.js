// src/pages/Calculadora.jsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import api, { API_URL } from "../api";

/* =========================
   Constantes de negocio
   ========================= */
const TARIFAS = [
  { maxKg: 0.5,  precio: 30.60 }, { maxKg: 1.0,  precio: 55.00 },
  { maxKg: 1.5,  precio: 74.00 }, { maxKg: 2.0,  precio: 90.00 },
  { maxKg: 2.5,  precio: 110.00 },{ maxKg: 3.0,  precio: 120.00 },
  { maxKg: 3.5,  precio: 130.00 },{ maxKg: 4.0,  precio: 140.00 },
  { maxKg: 4.5,  precio: 150.00 },{ maxKg: 5.0,  precio: 160.00 },
  { maxKg: 5.5,  precio: 170.00 },{ maxKg: 6.0,  precio: 180.00 },
  { maxKg: 6.5,  precio: 190.00 },{ maxKg: 7.0,  precio: 200.00 },
  { maxKg: 7.5,  precio: 210.00 },{ maxKg: 8.0,  precio: 220.00 },
  { maxKg: 8.5,  precio: 230.00 },{ maxKg: 9.0,  precio: 240.00 },
  { maxKg: 9.5,  precio: 250.00 },{ maxKg: 10.0, precio: 260.00 },
];
const ADICIONAL_05KG = 10;   // S/ por cada 0.5 kg > 10 kg
const TC_KENNY = 3.64;       // TC fijo Kenny
const TC_JORGE_DEFAULT = 3.8;
const CALC_CACHE_KEY = 'productos:calc-cache:v1';
const CALC_CACHE_TTL_MS = 10 * 60 * 1000;

/* =========================
   Utilidades
   ========================= */
const num = (v) =>
  v == null || v === "" || isNaN(v) ? 0 : parseFloat(String(v).replace(",", "."));
const fmtSoles = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `S/ ${n.toFixed(2)}` : '-';
};
const fmtUSD = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? `$ ${n.toFixed(2)}` : '-';
};
const normalizeText = (v) => String(v || '').toLowerCase();
const inferTipo = (title) => {
  const t = normalizeText(title);
  if (t.includes('macbook')) return 'macbook';
  if (t.includes('iphone')) return 'iphone';
  if (t.includes('ipad')) return 'ipad';
  if (t.includes('watch')) return 'watch';
  if (t.includes('pantalla')) return 'pantalla';
  return '';
};
const inferGama = (title, tipo) => {
  const t = normalizeText(title);
  if (!tipo) return '';
  if (/\bpro max\b/.test(t)) return 'pro max';
  if (/\bpro\b/.test(t)) return 'pro';
  if (/\bair\b/.test(t)) return 'air';
  if (/\bmini\b/.test(t)) return 'mini';
  if (/\bplus\b/.test(t)) return 'plus';
  if (/\bultra\b/.test(t)) return 'ultra';
  return '';
};
const inferProcesador = (title) => {
  const t = normalizeText(title);
  const m = t.match(/\b(m[1-4])\s*(pro|max|ultra)?\b/);
  if (m) return `${m[1]}${m[2] ? ` ${m[2]}` : ''}`.trim();
  const intel = t.match(/\b(i[3579])\b/);
  if (intel) return intel[1];
  const ryzen = t.match(/\b(ryzen\s*\d)\b/);
  if (ryzen) return ryzen[1].replace(/\s+/g, '');
  if (t.includes('intel')) return 'intel';
  return '';
};
const inferNumeroModeloIphone = (title) => {
  const t = normalizeText(title);
  const numero = (t.match(/\biphone\s*(\d{2})\b/) || t.match(/\b(\d{2})\b/))?.[1] || '';
  let modelo = '';
  if (/\bpro\s*max\b/.test(t) || /\bpromax\b/.test(t)) modelo = 'pro max';
  else if (/\bpro\b/.test(t)) modelo = 'pro';
  else if (/\bplus\b/.test(t)) modelo = 'plus';
  else if (/\bmini\b/.test(t)) modelo = 'mini';
  else if (/\bse\b/.test(t)) modelo = 'se';
  else if (t.includes('iphone')) modelo = 'normal';
  return { numero, modelo: formatIphoneModeloDisplay(modelo) };
};
const inferWatchMeta = (title) => {
  const t = normalizeText(title);
  let generacion = '';
  let conexion = '';
  const serie = t.match(/\bseries\s*(\d{1,2})\b/);
  const ultra = t.match(/\bultra\s*(\d{1,2})\b/);
  const se = t.match(/\bse\s*(\d)?\b/);
  if (ultra) generacion = `Ultra ${ultra[1]}`;
  else if (serie) generacion = serie[1];
  else if (se) generacion = `SE${se[1] ? ` ${se[1]}` : ''}`.trim();
  if (t.includes('cellular') || t.includes('gps + cel') || t.includes('gps+cel')) {
    conexion = 'GPS + Cel';
  } else if (t.includes('gps')) {
    conexion = 'GPS';
  }
  const size = t.match(/\b(40|41|42|44|45|46|49)\s*mm\b/);
  const tamano = size ? `${size[1]} mm` : '';
  return { generacion, conexion, tamano };
};
const ensureOptionValue = (options, current) => {
  const val = String(current || '').trim();
  if (!val) return options;
  if (options.some((opt) => opt.value === val)) return options;
  return [{ value: val, label: val }, ...options];
};
const ensureOptionList = (options, current) => {
  const val = String(current || '').trim();
  if (!val) return options;
  if (options.includes(val)) return options;
  return [val, ...options];
};
const IPHONE_NUMEROS = ['11', '12', '13', '14', '15', '16', '17'];
const getIphoneModelos = (num) => {
  const n = parseInt(num, 10);
  const ops = [];
  if (n >= 11 && n <= 16) ops.push('Normal', 'Pro', 'Pro Max');
  if (n === 17) ops.push('Normal', 'Air', 'Pro', 'Pro Max');
  if (n >= 12 && n <= 13) ops.push('Mini');
  if (n >= 14 && n <= 16) ops.push('Plus');
  return Array.from(new Set(ops));
};
const getIphoneAlmacenamientos = (num, modelo) => {
  const n = parseInt(num, 10);
  const modelNorm = normalizeIphoneModelo(modelo);
  if (n >= 11 && n <= 12) return ['64', '128', '256'];
  if (n >= 13 && n <= 16) {
    if (['pro', 'pro max'].includes(modelNorm)) {
      if (n <= 14) return ['128', '256', '512'];
      return ['256', '512', '1TB'];
    }
    return ['128', '256', '512'];
  }
  if (n === 17) {
    return ['256', '512', '1TB'];
  }
  return [];
};
const MACBOOK_PROCESADORES_AIR = ['M1', 'M2', 'M3', 'M4', 'M5'];
const MACBOOK_PROCESADORES_PRO = [
  'M1', 'M2', 'M3', 'M4', 'M5',
  'M1 Pro', 'M2 Pro', 'M3 Pro', 'M4 Pro',
  'M1 Max', 'M2 Max', 'M3 Max', 'M4 Max',
];
const getMacbookConfig = (gama, procesador) => {
  const p = String(procesador || '').trim();
  let sizes = [];
  let rams = [];
  let ssds = [];
  if (gama === 'Air') {
    if (p === 'M1') { sizes = ['13']; rams = ['8', '16']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M2') { sizes = ['13', '15']; rams = ['8', '16', '24']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M3') { sizes = ['13', '15']; rams = ['8', '16', '24']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M4') { sizes = ['13', '15']; rams = ['16', '24', '32']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M5') { sizes = ['13', '15']; rams = ['16', '24', '32']; ssds = ['256', '512', '1TB', '2TB']; }
  } else if (gama === 'Pro') {
    if (p === 'M1') { sizes = ['13']; rams = ['8', '16']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M1 Pro') { sizes = ['14', '16']; rams = ['16', '32']; ssds = ['512', '1TB', '2TB']; }
    else if (p === 'M1 Max') { sizes = ['14', '16']; rams = ['32', '64']; ssds = ['512', '1TB', '2TB', '4TB', '8TB']; }
    else if (p === 'M2') { sizes = ['13']; rams = ['8', '16', '24']; ssds = ['256', '512', '1TB', '2TB']; }
    else if (p === 'M2 Pro') { sizes = ['14', '16']; rams = ['16', '32', '36']; ssds = ['512', '1TB', '2TB']; }
    else if (p === 'M2 Max') { sizes = ['14', '16']; rams = ['32', '64', '96']; ssds = ['512', '1TB', '2TB', '4TB', '8TB']; }
    else if (p === 'M3') { sizes = ['14']; rams = ['8', '16', '24']; ssds = ['512', '1TB', '2TB']; }
    else if (p === 'M3 Pro') { sizes = ['14', '16']; rams = ['18', '36']; ssds = ['512', '1TB', '2TB', '4TB']; }
    else if (p === 'M3 Max') { sizes = ['14', '16']; rams = ['36', '48', '64']; ssds = ['1TB', '2TB', '4TB', '8TB']; }
    else if (p === 'M4') { sizes = ['14']; rams = ['8', '16', '24']; ssds = ['512', '1TB', '2TB']; }
    else if (p === 'M4 Pro') { sizes = ['14', '16']; rams = ['24', '48']; ssds = ['512', '1TB', '2TB', '4TB']; }
    else if (p === 'M4 Max') { sizes = ['14', '16']; rams = ['48', '64', '128']; ssds = ['1TB', '2TB', '4TB', '8TB']; }
    else if (p === 'M5') { sizes = ['14']; rams = ['16', '24']; ssds = ['512', '1TB', '2TB']; }
  }
  return { sizes, rams, ssds };
};
const IPAD_PROCESADORES_AIR = ['M1', 'M2', 'M3'];
const IPAD_PROCESADORES_PRO = ['M1', 'M2', 'M4', 'M5'];
const getIpadProcesadores = (gama) => {
  if (gama === 'Air') return IPAD_PROCESADORES_AIR;
  if (gama === 'Pro') return IPAD_PROCESADORES_PRO;
  return [];
};
const getIpadTamanos = (gama, procesador) => {
  if (gama === 'Air' && ['M2', 'M3'].includes(procesador)) return ['11', '13'];
  if (gama === 'Pro') {
    if (['M1', 'M2'].includes(procesador)) return ['11', '12.9'];
    if (['M4', 'M5'].includes(procesador)) return ['11', '13'];
  }
  return [];
};
const getIpadAlmacenamiento = (gama, generacion, procesador) => {
  if (gama === 'Normal') return [];
  if (gama === 'Mini') {
    if (generacion === '6') return ['64', '256'];
    if (generacion === '7') return ['128', '256', '512'];
    return [];
  }
  if (gama === 'Air') {
    if (procesador === 'M1') return ['64', '128', '256'];
    if (['M2', 'M3'].includes(procesador)) return ['128', '256', '512'];
  }
  if (gama === 'Pro') {
    if (['M1', 'M2'].includes(procesador)) return ['128', '256', '512', '1TB', '2TB'];
    if (['M4', 'M5'].includes(procesador)) return ['256', '512', '1TB', '2TB'];
  }
  return [];
};
const WATCH_GENERACIONES = ['6', '7', '8', '9', '10', '11', 'SE 2', 'SE 3', 'Ultra 1', 'Ultra 2', 'Ultra 3'];
const WATCH_CONEXIONES = ['GPS', 'GPS + Cel'];
const WATCH_TAMANOS_POR_MODELO = {
  '6': ['40 mm', '44 mm'],
  '7': ['41 mm', '45 mm'],
  '8': ['41 mm', '45 mm'],
  '9': ['41 mm', '45 mm'],
  '10': ['42 mm', '46 mm'],
  '11': ['42 mm', '46 mm'],
  'SE 2': ['40 mm', '44 mm'],
  'SE 3': ['40 mm', '44 mm'],
  'Ultra 1': ['49 mm'],
  'Ultra 2': ['49 mm'],
  'Ultra 3': ['49 mm'],
};
const getWatchTamanos = (generacion) => WATCH_TAMANOS_POR_MODELO[generacion] || [];
const normalizeField = (v) => normalizeText(v).replace(/\s+/g, ' ').trim();
const TRACKING_MIN_ESTADOS = new Set(['comprado_en_camino', 'en_eshopex', 'recogido']);
const isTrackingMinEnCamino = (estado) => TRACKING_MIN_ESTADOS.has(normalizeText(estado || ''));
const getLastTrackingEstado = (p) => {
  const arr = Array.isArray(p?.tracking) ? p.tracking : [];
  if (!arr.length) return '';
  const last = [...arr].sort((a, b) => (a?.id || 0) - (b?.id || 0)).pop();
  return last?.estado || '';
};
const normalizeIphoneNumero = (raw) => {
  const t = normalizeText(raw);
  return (t.match(/\b\d{2}\b/) || [])[0] || '';
};
const normalizeIphoneModelo = (raw) => {
  const t = normalizeText(raw).replace(/\d+/g, '').replace(/[^a-z0-9]+/g, '');
  if (!t) return '';
  if (t === 'promax') return 'pro max';
  if (t === 'pro') return 'pro';
  if (t === 'plus') return 'plus';
  if (t === 'mini') return 'mini';
  if (t === 'se') return 'se';
  if (t === 'air') return 'air';
  if (t === 'normal') return 'normal';
  return raw ? normalizeField(raw) : '';
};
const formatIphoneModeloDisplay = (raw) => {
  const n = normalizeIphoneModelo(raw);
  if (!n) return '';
  if (n === 'pro max') return 'Pro Max';
  if (n === 'pro') return 'Pro';
  if (n === 'plus') return 'Plus';
  if (n === 'mini') return 'Mini';
  if (n === 'se') return 'SE';
  if (n === 'air') return 'Air';
  if (n === 'normal') return 'Normal';
  return raw ? String(raw).trim() : '';
};
const normalizeStorageValue = (val) => {
  const raw = normalizeField(val).toLowerCase();
  if (!raw) return '';
  const m = raw.match(/(\d+(?:\.\d+)?)(?:\s*(tb|gb))?/);
  if (!m) return raw;
  const num = m[1];
  const unit = m[2] || 'gb';
  if (unit === 'tb') return `${num}TB`;
  return num;
};
const formatStorageLabel = (val) => {
  const raw = String(val || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase().replace(/\s+/g, '');
  if (upper.includes('TB')) return upper;
  if (upper.includes('GB')) {
    const num = upper.replace('GB', '');
    return `${num} GB`.trim();
  }
  return `${raw} GB`;
};
const mapEbayCondition = (condition) => {
  const c = normalizeText(condition || '');
  if (!c) return '';
  if (c === 'new') return 'nuevo';
  if (c === 'used') return 'usado';
  if (c.includes('for parts')) return 'para piezas';
  return 'usado';
};
const normalizeEstadoCondicion = (condicion) => {
  const c = normalizeText(condicion || '');
  if (!c) return '';
  return c === 'nuevo' ? 'nuevo' : 'usado';
};
const labelFromCondition = (condicion) => {
  const c = normalizeText(condicion || '');
  if (c === 'nuevo') return 'Nuevo';
  if (c === 'usado') return 'Usado';
  if (c === 'para piezas') return 'Para piezas';
  return condicion ? String(condicion) : '-';
};
const getTamano = (d) => d?.tamano || d?.tamanio;
const buildProductoLabel = (p) => {
  const d = p?.detalle || {};
  const tipo = normalizeText(p?.tipo);
  const tam = d?.tamano || d?.tamanio;
  const ram = d?.ram;
  const alm = d?.almacenamiento || d?.ssd;

  if (tipo === 'iphone') {
    const numero = d?.numero;
    const modelo = d?.modelo;
    const base = ['iphone', numero, modelo].filter(Boolean).join(' ').trim();
    return [base || 'iphone', alm].filter(Boolean).join(' ').trim();
  }

  if (tipo === 'ipad') {
    const base = ['ipad', d?.gama, d?.procesador, tam].filter(Boolean).join(' ').trim();
    return [base || 'ipad', alm].filter(Boolean).join(' ').trim();
  }

  if (tipo === 'macbook') {
    const base = ['macbook', d?.gama, d?.procesador, tam].filter(Boolean).join(' ').trim();
    return [base || 'macbook', ram, alm].filter(Boolean).join(' ').trim();
  }

  if (tipo === 'watch') {
    const base = ['apple watch', d?.generacion, tam, d?.conexion].filter(Boolean).join(' ').trim();
    return base || 'apple watch';
  }

  const parts = [p?.tipo, d?.gama, d?.procesador, d?.modelo, tam].filter(Boolean);
  return parts.join(' ').trim() || p?.tipo || 'Producto';
};
const readCalcCache = () => {
  try {
    const raw = localStorage.getItem(CALC_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || !Array.isArray(parsed.productos)) return null;
    if (Date.now() - parsed.ts > CALC_CACHE_TTL_MS) return null;
    return parsed.productos;
  } catch {
    return null;
  }
};
const quantile = (arr, p) => {
  const clean = (arr || []).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!clean.length) return null;
  if (clean.length === 1) return clean[0];
  const pos = (clean.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = clean[base + 1] !== undefined ? clean[base + 1] : clean[base];
  return clean[base] + rest * (next - clean[base]);
};
const writeCalcCache = (productos) => {
  try {
    localStorage.setItem(
      CALC_CACHE_KEY,
      JSON.stringify({ productos, ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
};

const extractApiError = (err, fallback) => {
  const raw = String(err?.message || '').trim();
  if (!raw) return fallback;
  const parts = raw.split(' - ');
  if (parts.length >= 2) {
    const msg = parts.slice(1).join(' - ').trim();
    return msg || fallback;
  }
  return raw || fallback;
};

// Redondeos
const ceil10 = (v) => Math.ceil((Number(v) || 0) / 10) * 10;
const round10HalfUp = (v) => {
  const n = Number(v) || 0, down = Math.floor(n / 10) * 10, up = down + 10;
  return (n - down) >= 5 ? up : down;
};
const round5HalfUp = (v) => {
  const n = Number(v) || 0, down = Math.floor(n / 5) * 5, up = down + 5;
  return (n - down) >= 2.5 ? up : down;
};
// Peso: redondea al dcimo (0.1 kg): centsimas .05 hacia abajo; .06.09 hacia arriba (a la dcima)
const roundTenth05Down = (kg) => {
  const v = Number(String(kg).replace(",", ".")) || 0;
  if (v <= 0) return 0;
  const centi = Math.round(v * 100);
  const tens = Math.floor(centi / 10);
  const rem  = centi - tens * 10;
  return (rem <= 5 ? tens : tens + 1) / 10;
};

// Envio eShopex (interpolacion lineal)
const tarifaEshopexInterpolada = (pesoKg) => {
  if (!pesoKg || pesoKg <= 0) return 0;
  const P = TARIFAS;
  if (pesoKg <= P[0].maxKg) return (P[0].precio * pesoKg) / P[0].maxKg;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i];
    if (pesoKg <= b.maxKg) {
      const t = (pesoKg - a.maxKg) / (b.maxKg - a.maxKg);
      return a.precio + t * (b.precio - a.precio);
    }
  }
  const extraKg = pesoKg - 10;
  return P[P.length - 1].precio + (extraKg / 0.5) * ADICIONAL_05KG;
};
const tarifaHasta3Kg = (pesoKg) =>
  tarifaEshopexInterpolada(Math.min(Math.max(pesoKg || 0, 0), 3));

// Honorarios / Seguro segn DEC (USD)
const honorariosPorDEC = (dec) => (dec <= 100 ? 16.30 : dec <= 200 ? 25.28 : dec <= 1000 ? 39.76 : 60.16);
const seguroPorDEC     = (dec) => (dec <= 100 ? 8.86  : dec <= 200 ? 15.98 : 21.10);

/* =========================
   Componentes base (memo)
   ========================= */
const Input = React.memo(function Input({ label, value, onChange, type = "text", placeholder }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-700">{label}</label>
      <input
        type={type}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={onChange}
        className="w-full rounded-lg p-2.5 border border-gray-300 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
      />
    </div>
  );
});

const Card = React.memo(function Card({ title, children }) {
  return (
    <div className="bg-white/90 backdrop-blur rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition p-5">
      <h3 className="text-lg font-semibold mb-3 text-gray-900">{title}</h3>
      {children}
    </div>
  );
});

/* =========================
   Pgina principal
   ========================= */
export default function Calculadora({ setVista }) {
  // Compras: TC editable (ahora se muestra dentro del formulario)
  const [tipoCambio, _setTipoCambio] = useState("3.75");
  const setTipoCambio = useCallback((e) => _setTipoCambio(e.target.value), []);

  // Jorge: TC y Extra editables
  const [tcJorge, _setTcJorge] = useState(String(TC_JORGE_DEFAULT));
  const setTcJorge = useCallback((e) => _setTcJorge(e.target.value), []);
  const [extraJInput, setExtraJInput] = useState("100");
  const [extraJ, setExtraJ] = useState(100); // aplicado (a 10, halfup)

  const [tab, setTab] = useState("compras"); // 'compras' | 'kenny' | 'jorge'
  const [pvCompras, setPvCompras] = useState("");
  const [pvKenny, setPvKenny] = useState("");
  const [pvJorge, setPvJorge] = useState("");

  // Form (UI) y su versin debounced para clculos
  const [form, setForm] = useState({ precioUsd: "", envioUsaUsd: "", decUsd: "", pesoKg: "" });
  const setField = useCallback((field) => (e) => {
    const v = e.target?.value ?? e;
    setForm((f) => ({ ...f, [field]: v }));
  }, []);
  const [debounced, setDebounced] = useState(form);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(form), 300);
    return () => clearTimeout(h);
  }, [form]);

  const [ebayUrl, setEbayUrl] = useState("");
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState("");
  const [ebayImages, setEbayImages] = useState([]);
  const [ebayTitle, setEbayTitle] = useState("");
  const [ebayPrice, setEbayPrice] = useState(null);
  const [ebayShipping, setEbayShipping] = useState(null);
  const [ebayConditionRaw, setEbayConditionRaw] = useState("");
  const [ebayZipLoading, setEbayZipLoading] = useState(false);
  const [ebayOverrides, setEbayOverrides] = useState({
    tipo: "",
    gama: "",
    procesador: "",
    pantalla: "",
    ram: "",
    almacenamiento: "",
    numero: "",
    modelo: "",
    generacion: "",
    conexion: "",
    condicion: "",
  });
  const [ebayTouched, setEbayTouched] = useState({
    tipo: false,
    gama: false,
    procesador: false,
    pantalla: false,
    ram: false,
    almacenamiento: false,
    numero: false,
    modelo: false,
    generacion: false,
    conexion: false,
    condicion: false,
  });
  const [historialProductos, setHistorialProductos] = useState([]);
  const [historialLoading, setHistorialLoading] = useState(false);
  const [analyticsSummary, setAnalyticsSummary] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchEbay = useCallback(async () => {
    const url = String(ebayUrl || '').trim();
    if (!url) {
      setEbayError("Ingresa un URL de eBay.");
      return;
    }
    setEbayLoading(true);
    setEbayError("");
    try {
      const data = await api.get(`/utils/ebay?url=${encodeURIComponent(url)}`);
      const price = Number.isFinite(data?.priceUSD) ? data.priceUSD : null;
      const ship = Number.isFinite(data?.shippingUSD) ? data.shippingUSD : null;
      setEbayPrice(price);
      setEbayShipping(ship);
      setEbayImages(Array.isArray(data?.images) ? data.images : []);
      setEbayTitle(String(data?.title || ''));
      const conditionRaw = String(data?.condition || '');
      setEbayConditionRaw(conditionRaw);
      const mappedCondition = mapEbayCondition(conditionRaw);
      const parsed = data?.titleParsed || {};
      const inferredTipo = parsed?.tipo || inferTipo(String(data?.title || ''));
      const inferredGama = parsed?.gama || inferGama(String(data?.title || ''), inferredTipo);
      const inferredProc = parsed?.proc || inferProcesador(String(data?.title || ''));
      const inferredPantalla = parsed?.pantalla || '';
      const inferredRam = parsed?.ram || '';
      const inferredAlm = parsed?.ssd || '';
      const iphoneMeta = inferNumeroModeloIphone(String(data?.title || ''));
      const watchMeta = inferWatchMeta(String(data?.title || ''));
      const iphoneAllowedAlm = getIphoneAlmacenamientos(iphoneMeta.numero, iphoneMeta.modelo).map(normalizeStorageValue);
      const inferredAlmNorm = normalizeStorageValue(inferredAlm || '');
      setEbayOverrides({
        tipo: inferredTipo || "",
        gama: inferredTipo === 'iphone' || inferredTipo === 'watch' ? "" : (inferredGama || ""),
        procesador: inferredProc || "",
        pantalla: inferredTipo === 'watch' ? (watchMeta.tamano || "") : (inferredPantalla || ""),
        ram: inferredRam || "",
        almacenamiento: iphoneMeta.numero ? (iphoneAllowedAlm.includes(inferredAlmNorm) ? inferredAlmNorm : "") : normalizeStorageValue(inferredAlm || ""),
        numero: iphoneMeta.numero || "",
        modelo: iphoneMeta.modelo || "",
        generacion: inferredTipo === 'watch' ? (watchMeta.generacion || "") : "",
        conexion: inferredTipo === 'watch' ? (watchMeta.conexion || "") : "",
        condicion: mappedCondition || "",
      });
      setEbayTouched({
        tipo: false,
        gama: false,
        procesador: false,
        pantalla: false,
        ram: false,
        almacenamiento: false,
        numero: false,
        modelo: false,
        generacion: false,
        conexion: false,
        condicion: false,
      });
      if (price != null) {
        setForm((f) => ({ ...f, precioUsd: String(price) }));
      }
      if (ship != null) {
        setForm((f) => ({ ...f, envioUsaUsd: String(ship) }));
      }
    } catch (err) {
      setEbayError(extractApiError(err, "No se pudo leer el URL. Verifica que sea un enlace de eBay."));
    } finally {
      setEbayLoading(false);
    }
  }, [ebayUrl]);

  const descargarFotos = useCallback(async () => {
    if (!ebayImages.length) return;
    if (ebayZipLoading) return;
    setEbayZipLoading(true);
    setEbayError("");
    const baseTitle = (ebayTitle || 'ebay-foto')
      .replace(/[^a-z0-9]+/gi, ' ')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 120);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/utils/ebay/images-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ urls: ebayImages }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const filename = `${baseTitle || 'ebay-fotos'}.zip`;
      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      setEbayError("No se pudieron descargar las fotos en ZIP.");
    } finally {
      setEbayZipLoading(false);
    }
  }, [ebayImages, ebayTitle, ebayZipLoading]);

  useEffect(() => {
    let alive = true;
    const cached = readCalcCache();
    if (cached?.length) {
      setHistorialProductos(cached);
    }
    setHistorialLoading(true);
    api.get('/productos')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.productos || []);
        if (!alive) return;
        setHistorialProductos(list);
        if (list?.length) writeCalcCache(list);
      })
      .catch(() => {
        if (!alive) return;
        setHistorialProductos([]);
      })
      .finally(() => {
        if (!alive) return;
        setHistorialLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setAnalyticsLoading(true);
    api.get('/analytics/summary')
      .then((data) => {
        if (!alive) return;
        setAnalyticsSummary(data || null);
      })
      .catch(() => {
        if (!alive) return;
        setAnalyticsSummary(null);
      })
      .finally(() => {
        if (!alive) return;
        setAnalyticsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const goHome = () => (typeof setVista === "function" ? setVista("home") : window.history.back());

  /* --------- COMPRAS --------- */
  const compras = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);

    const baseUsd = precioUsd + envioUsaUsd;
    const precioSoles = baseUsd * (num(tipoCambio) || 0);

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    const costoTotal     = precioSoles + costoEnvio;
    const precioVentaMin = ceil10(costoTotal * 1.2);
    const ganancia       = precioVentaMin - costoTotal;

    return { precioSoles, pesoFacturable, transporteBruto, promoDescuento, transporteConPromo, honorarios, seguro, costoEnvio, costoTotal, precioVentaMin, ganancia };
  }, [debounced, tipoCambio]);

const historialCompras = useMemo(() => {
    const hasEbay = Boolean(ebayTitle);
    const hasManualEbayFilters = Object.values(ebayTouched || {}).some(Boolean);
    const allowRelaxNumero = !hasManualEbayFilters || !ebayTouched.numero;
    const allowRelaxModelo = !hasManualEbayFilters || !ebayTouched.modelo;
    const allowRelaxAlm = !hasManualEbayFilters || !ebayTouched.almacenamiento;
    const tipoSel = ebayOverrides.tipo || inferTipo(ebayTitle);
    const gamaSel = hasManualEbayFilters
      ? (ebayTouched.gama ? ebayOverrides.gama : '')
      : (ebayOverrides.gama || inferGama(ebayTitle, tipoSel));
    const procSel = hasManualEbayFilters
      ? (ebayTouched.procesador ? ebayOverrides.procesador : '')
      : (ebayOverrides.procesador || inferProcesador(ebayTitle));
    const pantallaSel = hasManualEbayFilters
      ? (ebayTouched.pantalla ? ebayOverrides.pantalla : '')
      : (ebayOverrides.pantalla || '');
    const ramSel = hasManualEbayFilters
      ? (ebayTouched.ram ? ebayOverrides.ram : '')
      : (ebayOverrides.ram || '');
    const almSel = normalizeStorageValue(
      hasManualEbayFilters
        ? (ebayTouched.almacenamiento ? ebayOverrides.almacenamiento : '')
        : ebayOverrides.almacenamiento
    );
    const numeroSel = hasManualEbayFilters
      ? (ebayTouched.numero ? ebayOverrides.numero : '')
      : ebayOverrides.numero;
    const modeloSel = hasManualEbayFilters
      ? (ebayTouched.modelo ? ebayOverrides.modelo : '')
      : ebayOverrides.modelo;
    const generacionSel = hasManualEbayFilters
      ? (ebayTouched.generacion ? ebayOverrides.generacion : '')
      : ebayOverrides.generacion;
    const conexionSel = hasManualEbayFilters
      ? (ebayTouched.conexion ? ebayOverrides.conexion : '')
      : ebayOverrides.conexion;
    const condicionSel = hasManualEbayFilters
      ? (ebayTouched.condicion ? ebayOverrides.condicion : '')
      : ebayOverrides.condicion;
    const estadoFiltro = normalizeEstadoCondicion(condicionSel);
    const matchEstado = (estado) => {
      if (!estadoFiltro) return true;
      const e = normalizeText(estado || '');
      if (estadoFiltro === 'nuevo') return e !== 'usado';
      return e === 'usado';
    };
    const tipoNorm = normalizeText(tipoSel);
    const gamaKey = normalizeText(gamaSel);
    const hasFilters = Boolean(
      tipoNorm ||
      gamaKey ||
      procSel ||
      pantallaSel ||
      ramSel ||
      almSel ||
      numeroSel ||
      modeloSel ||
      generacionSel ||
      conexionSel ||
      estadoFiltro
    );
    const groups = Array.isArray(analyticsSummary?.productGroups) ? analyticsSummary.productGroups : null;

    const trackingById = new Map();
    (Array.isArray(historialProductos) ? historialProductos : []).forEach((p) => {
      trackingById.set(p?.id, getLastTrackingEstado(p));
    });
    const trackingOk = (productoId) => isTrackingMinEnCamino(trackingById.get(productoId));

    if (groups) {
      const iphoneNumeroSel = normalizeIphoneNumero(numeroSel || '');
      const iphoneModeloSel = normalizeIphoneModelo(modeloSel || '');
      const candidates = tipoNorm ? groups.filter((g) => normalizeText(g?.tipo) === tipoNorm) : groups;
      const ramMatch = (g) => {
        const ramSet = (Array.isArray(g?.ramDistinct) ? g.ramDistinct : []).map((r) => normalizeField(r));
        return ramSet.includes(normalizeField(ramSel));
      };
      const ssdMatch = (g) => {
        const ssdSet = (Array.isArray(g?.ssdDistinct) ? g.ssdDistinct : []).map((r) => normalizeStorageValue(r));
        return ssdSet.includes(normalizeStorageValue(almSel));
      };
      const procMatch = (g) => normalizeField(g?.proc || '').includes(normalizeField(procSel));
      const pantallaMatch = (g) => normalizeField(String(g?.pantalla || '')).includes(normalizeField(pantallaSel));
      const gamaMatch = (g) => normalizeText(g?.gama || '') === gamaKey;

      const filterGroups = ({ useIphoneNumero = true, useIphoneModelo = true, useAlm = true } = {}) => candidates.filter((g) => {
        if (tipoNorm && normalizeText(g?.tipo || '') !== tipoNorm) return false;
        if (tipoNorm === 'iphone') {
          if (useIphoneNumero && iphoneNumeroSel && normalizeIphoneNumero(g?.gama || '') !== iphoneNumeroSel) return false;
          if (useIphoneModelo && iphoneModeloSel && normalizeIphoneModelo(g?.gama || '') !== iphoneModeloSel) return false;
        }
        if (gamaKey && tipoNorm !== 'iphone' && !gamaMatch(g)) return false;
        if (procSel && !procMatch(g)) return false;
        if (pantallaSel && !pantallaMatch(g)) return false;
        if (ramSel && !ramMatch(g)) return false;
        if (useAlm && almSel && !ssdMatch(g)) return false;
        return true;
      });
      let baseGroupsFiltered = filterGroups();
      if (tipoNorm === 'iphone' && baseGroupsFiltered.length === 0 && iphoneModeloSel && allowRelaxModelo) {
        baseGroupsFiltered = filterGroups({ useIphoneNumero: true, useIphoneModelo: false });
      }
      if (tipoNorm === 'iphone' && baseGroupsFiltered.length === 0 && iphoneNumeroSel && allowRelaxNumero) {
        baseGroupsFiltered = filterGroups({ useIphoneNumero: true, useIphoneModelo: false, useAlm: false });
      }
      if (baseGroupsFiltered.length === 0 && almSel && allowRelaxAlm) {
        baseGroupsFiltered = filterGroups({ useAlm: false });
      }
      const baseGroups = (hasEbay || hasFilters)
        ? baseGroupsFiltered
        : (baseGroupsFiltered.length ? baseGroupsFiltered : groups);

      const ventaByProductoId = new Map();
      groups.forEach((g) => {
        const ventas = Array.isArray(g?.ventasDetalle) ? g.ventasDetalle : [];
        ventas.forEach((v) => {
          if (!v?.productoId) return;
          const prev = ventaByProductoId.get(v.productoId);
          if (!prev || (v.fechaVenta && prev.fechaVenta < v.fechaVenta)) {
            ventaByProductoId.set(v.productoId, {
              fechaVenta: v.fechaVenta || '',
              precioVenta: Number(v.precioVenta ?? 0),
              dias: Number(v.dias ?? null),
            });
          }
        });
      });
      const rows = [];
      for (const g of baseGroups || []) {
        const detalles = Array.isArray(g?.comprasDetalle) ? g.comprasDetalle : [];
        detalles.forEach((d) => {
          if (!matchEstado(d?.estado)) return;
          if (!trackingOk(d?.productoId)) return;
          if (ramSel) {
            const ramVal = normalizeField(d?.ram || '');
            if (!ramVal || ramVal !== normalizeField(ramSel)) return;
          }
          if (almSel) {
            const ssdVal = normalizeStorageValue(d?.ssd || '');
            if (!ssdVal || ssdVal !== normalizeStorageValue(almSel)) return;
          }
          const venta = d?.productoId ? ventaByProductoId.get(d.productoId) : null;
          rows.push({
            id: `${g?.label || g?.tipo}-${d?.productoId || d?.fechaCompra || Math.random()}`,
            label: g?.label || g?.tipo || 'Producto',
            valorUSD: Number(d?.precioUSD ?? 0),
            costoTotal: Number(d?.costoTotal ?? 0),
            fecha: d?.fechaCompra || '',
            ventaPrecio: venta?.precioVenta ?? null,
            diasVenta: Number.isFinite(venta?.dias) ? venta.dias : null,
          });
        });
      }
      const limit = hasEbay ? 5 : 10;
      return rows
        .sort((a, b) => {
          const ta = a.fecha ? Date.parse(a.fecha) : 0;
          const tb = b.fecha ? Date.parse(b.fecha) : 0;
          return tb - ta;
        })
        .slice(0, limit);
    }

    const items = Array.isArray(historialProductos) ? historialProductos : [];
    const filterItems = ({ useIphoneNumero = true, useIphoneModelo = true, useAlm = true } = {}) => items.filter((p) => {
      if (!matchEstado(p?.estado)) return false;
      if (!isTrackingMinEnCamino(getLastTrackingEstado(p))) return false;
      if (tipoNorm && normalizeText(p?.tipo) !== tipoNorm) return false;
      if (gamaSel && tipoNorm !== 'iphone' && tipoNorm !== 'watch') {
        const g =
          tipoSel === 'iphone'
            ? normalizeText(p?.detalle?.modelo || '')
            : normalizeText(p?.detalle?.gama || p?.gama || '');
        if (g !== gamaKey) return false;
      }
      if (procSel && (tipoNorm === 'macbook' || tipoNorm === 'ipad')) {
        const proc = normalizeField(p?.detalle?.procesador || '');
        if (!proc.includes(normalizeField(procSel))) return false;
      }
      if (pantallaSel && (tipoNorm === 'macbook' || tipoNorm === 'ipad')) {
        const tam = normalizeField(getTamano(p?.detalle || {}));
        if (!tam.includes(normalizeField(pantallaSel))) return false;
      }
      if (pantallaSel && tipoNorm === 'watch') {
        const tam = normalizeField(getTamano(p?.detalle || {}));
        if (!tam.includes(normalizeField(pantallaSel))) return false;
      }
      if (ramSel && tipoNorm === 'macbook') {
        const ram = normalizeField(p?.detalle?.ram || '');
        if (!ram.includes(normalizeField(ramSel))) return false;
      }
      if (useAlm && almSel && (tipoNorm === 'macbook' || tipoNorm === 'ipad' || tipoNorm === 'iphone')) {
        const alm = normalizeStorageValue(p?.detalle?.almacenamiento || p?.detalle?.ssd || '');
        if (!alm.includes(normalizeStorageValue(almSel))) return false;
      }
      if (numeroSel && tipoNorm === 'iphone') {
        const num = normalizeIphoneNumero(p?.detalle?.numero || '');
        if (useIphoneNumero && (!num || num !== normalizeIphoneNumero(numeroSel))) return false;
      }
      if (modeloSel && tipoNorm === 'iphone') {
        const mod = normalizeIphoneModelo(p?.detalle?.modelo || '');
        if (useIphoneModelo && (!mod || mod !== normalizeIphoneModelo(modeloSel))) return false;
      }
      if (generacionSel && tipoNorm === 'watch') {
        const gen = normalizeField(p?.detalle?.generacion || '');
        if (!gen.includes(normalizeField(generacionSel))) return false;
      }
      if (conexionSel && tipoNorm === 'watch') {
        const conn = normalizeField(p?.detalle?.conexion || '');
        if (!conn.includes(normalizeField(conexionSel))) return false;
      }
      return true;
    });
    let filtered = filterItems();
    if (tipoNorm === 'iphone' && filtered.length === 0 && modeloSel && allowRelaxModelo) {
      filtered = filterItems({ useIphoneNumero: true, useIphoneModelo: false });
    }
    if (tipoNorm === 'iphone' && filtered.length === 0 && numeroSel && allowRelaxNumero) {
      filtered = filterItems({ useIphoneNumero: true, useIphoneModelo: false, useAlm: false });
    }
    if (filtered.length === 0 && almSel && allowRelaxAlm) {
      filtered = filterItems({ useAlm: false });
    }
    const base = hasFilters ? filtered : items;
    const limit = hasEbay ? 5 : 10;
    return base
      .map((p) => ({
        id: p?.id,
        label: buildProductoLabel(p),
        valorUSD: Number(p?.valor?.valorProducto ?? 0),
        costoTotal: Number(p?.valor?.costoTotal ?? 0),
        fecha: p?.valor?.fechaCompra || p?.createdAt || '',
      }))
      .sort((a, b) => {
        const ta = a.fecha ? Date.parse(a.fecha) : 0;
        const tb = b.fecha ? Date.parse(b.fecha) : 0;
        return tb - ta;
      })
      .slice(0, limit);
  }, [ebayTitle, historialProductos, ebayOverrides, ebayTouched, analyticsSummary]);

  const sugeridosResumen = useMemo(() => {
    const rows = Array.isArray(historialCompras) ? historialCompras : [];
    const compraVals = rows.map((r) => r.valorUSD).filter((v) => Number.isFinite(v) && v > 0);
    const ventaVals = rows.map((r) => r.ventaPrecio).filter((v) => Number.isFinite(v) && v > 0);
    const compraMin = quantile(compraVals, 0.25);
    const compraMax = quantile(compraVals, 0.75);
    const ventaMin = quantile(ventaVals, 0.25);
    const ventaMax = quantile(ventaVals, 0.75);
    const precioForm = num(debounced.precioUsd);
    const envioUsaForm = num(debounced.envioUsaUsd);
    const precioActual =
      (Number.isFinite(precioForm) && precioForm > 0)
        ? precioForm + (Number.isFinite(envioUsaForm) && envioUsaForm > 0 ? envioUsaForm : 0)
        : null;
    let nivel = null;
    if (Number.isFinite(precioActual) && compraMin != null && compraMax != null) {
      if (precioActual < compraMin) {
        nivel = 'oferton';
      } else if (precioActual > compraMax) {
        nivel = 'no recomendable';
      } else {
        const span = compraMax - compraMin;
        if (span <= 0) {
          nivel = 'bueno';
        } else {
          const rel = (precioActual - compraMin) / span;
          if (rel <= 1 / 3) nivel = 'muy bueno';
          else if (rel <= 2 / 3) nivel = 'bueno';
          else nivel = 'regular';
        }
      }
    }
    return {
      compraRango: compraMin != null && compraMax != null ? { min: compraMin, max: compraMax } : null,
      ventaRango: ventaMin != null && ventaMax != null ? { min: ventaMin, max: ventaMax } : null,
      nivel,
    };
  }, [historialCompras, debounced.precioUsd, debounced.envioUsaUsd]);

  const recomendacionMeta = useMemo(() => {
    const nivel = sugeridosResumen.nivel;
    if (!nivel) return null;
    const key = normalizeText(nivel);
    const map = {
      oferton: { label: 'Oferton', bg: 'bg-emerald-100', text: 'text-emerald-900', ring: 'ring-emerald-200' },
      'muy bueno': { label: 'Muy Bueno', bg: 'bg-emerald-50', text: 'text-emerald-800', ring: 'ring-emerald-200' },
      bueno: { label: 'Bueno', bg: 'bg-blue-50', text: 'text-blue-800', ring: 'ring-blue-200' },
      regular: { label: 'Regular', bg: 'bg-amber-50', text: 'text-amber-900', ring: 'ring-amber-200' },
      'no recomendable': { label: 'No Recomendable', bg: 'bg-rose-50', text: 'text-rose-800', ring: 'ring-rose-200' },
    };
    return map[key] || { label: nivel, bg: 'bg-gray-50', text: 'text-gray-800', ring: 'ring-gray-200' };
  }, [sugeridosResumen.nivel]);
  const hasSuggestions = Boolean(
    sugeridosResumen.compraRango ||
    sugeridosResumen.ventaRango ||
    recomendacionMeta
  );

  /* --------- KENNY --------- */
  const kenny = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);

    const precioSoles = (precioUsd + envioUsaUsd) * TC_KENNY;

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    const extra = round10HalfUp(precioSoles * 0.13);
    const costoTotal = precioSoles + costoEnvio + extra;

    const pv10 = ceil10(costoTotal * 1.10);
    const pv20 = ceil10(costoTotal * 1.20);
    return {
      precioSoles, pesoFacturable, transporteBruto, promoDescuento, transporteConPromo,
      honorarios, seguro, costoEnvio, extra, costoTotal,
      pv10, pv20, ganancia10: pv10 - costoTotal, ganancia20: pv20 - costoTotal
    };
  }, [debounced]);

  /* --------- JORGE --------- */
  const jorge = useMemo(() => {
    const precioUsd   = num(debounced.precioUsd);
    const envioUsaUsd = num(debounced.envioUsaUsd);
    const decUsd      = num(debounced.decUsd);
    const pesoIn      = num(debounced.pesoKg);
    const pesoFacturable = roundTenth05Down(pesoIn);
    const tc = num(tcJorge);

    // Base en soles
    const baseSoles = (precioUsd + envioUsaUsd) * tc;

    const transporteBruto    = tarifaEshopexInterpolada(pesoFacturable);
    const promoDescuento     = tarifaHasta3Kg(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);

    const honorarios = honorariosPorDEC(decUsd);
    const seguro     = seguroPorDEC(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;

    // PB = baseSoles con 7% de ganancia + costoEnvio (la ganancia NO aplica sobre Envio)
    const pb  = baseSoles * 1.07 + costoEnvio;
    const pbR = round5HalfUp(pb);

    const costoTotal = pbR + (Number(extraJ) || 0);

    const pv10 = ceil10(costoTotal * 1.10);
    const pv20 = ceil10(costoTotal * 1.20);

    return {
      pesoFacturable, baseSoles, transporteBruto, promoDescuento, transporteConPromo,
      honorarios, seguro, costoEnvio, pb, pbR, costoTotal,
      pv10, pv20, ganancia10: pv10 - costoTotal, ganancia20: pv20 - costoTotal
    };
  }, [debounced, tcJorge, extraJ]);

  /* =========================
     Render
     ========================= */
  return (
    <div className="min-h-screen p-6 md:p-10 bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calculadora</h1>
          <p className="text-gray-600">Simula costos y precio de venta minimo.</p>
        </div>
        <button onClick={goHome} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">&larr; Volver</button>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("compras")} className={`px-4 py-2 rounded-full transition border ${tab === "compras" ? "bg-blue-600 text-white shadow" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Calculadora Compras</button>
        <button onClick={() => setTab("kenny")}   className={`px-4 py-2 rounded-full transition border ${tab === "kenny"   ? "bg-blue-600 text-white shadow" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Calculadora Kenny</button>
        <button onClick={() => setTab("jorge")}   className={`px-4 py-2 rounded-full transition border ${tab === "jorge"   ? "bg-blue-600 text-white shadow" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Calculadora Jorge</button>
      </div>

      {/* -------- COMPRAS -------- */}
      {tab === "compras" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Producto Ebay">
            <div className="space-y-4">
              <div className="border rounded-lg p-3 bg-gray-50">
                <label className="block text-sm font-medium mb-2">URL de eBay</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2"
                    placeholder="https://www.ebay.com/itm/..."
                    value={ebayUrl}
                    onChange={(e) => setEbayUrl(e.target.value)}
                  />
                  <button
                    onClick={fetchEbay}
                    disabled={ebayLoading}
                    className={`${ebayLoading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'} px-4 py-2 rounded-lg`}
                  >
                    {ebayLoading ? 'Cargando...' : 'Buscar'}
                  </button>
                </div>
                {ebayError && <div className="text-sm text-red-600 mt-2">{ebayError}</div>}
                <div className="text-xs text-gray-600 mt-2">
                  Precio: <strong>{fmtUSD(ebayPrice)}</strong> | Envio: <strong>{fmtUSD(ebayShipping)}</strong>
                  {' '}| Condition: <strong>{labelFromCondition(ebayOverrides.condicion || mapEbayCondition(ebayConditionRaw))}</strong>
                </div>
              </div>

              <div className="border rounded-lg p-3">
                <div className="text-sm font-medium mb-2">Titulo del producto</div>
                {ebayTitle ? (
                  <div className="text-sm text-gray-800 bg-white border rounded p-2">{ebayTitle}</div>
                ) : (
                  <div className="text-sm text-gray-500">Aun no se ha cargado el titulo.</div>
                )}
              </div>

              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Fotos del producto</span>
                  <button
                    onClick={descargarFotos}
                    disabled={!ebayImages.length || ebayZipLoading}
                    className={`${ebayImages.length && !ebayZipLoading ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-gray-300 text-gray-600'} px-3 py-1.5 rounded`}
                  >
                    {ebayZipLoading ? 'Descargando...' : 'Descargar fotos'}
                  </button>
                </div>
              </div>
              <div className="border rounded-lg p-3">
                <div className="text-sm font-medium mb-3">Ajustes para comparar costos</div>
                {(() => {
                  const t = normalizeText(ebayOverrides.tipo);
                  const isIphone = t === 'iphone';
                  const showGama = t === 'macbook' || t === 'ipad';
                  const showProc = t === 'macbook' || t === 'ipad';
                  const showTam = t === 'macbook' || t === 'ipad' || t === 'watch';
                  const showRam = t === 'macbook';
                  const showAlm = t === 'macbook' || t === 'ipad';
                  const showGeneracion = t === 'watch';
                  const showConexion = t === 'watch';
                  const macConfig = t === 'macbook' ? getMacbookConfig(ebayOverrides.gama, ebayOverrides.procesador) : { sizes: [], rams: [], ssds: [] };
                  const macSizes = ensureOptionList(macConfig.sizes, ebayOverrides.pantalla);
                  const macRams = ensureOptionList(macConfig.rams, ebayOverrides.ram);
                  const macSsds = ensureOptionList(
                    macConfig.ssds.map(normalizeStorageValue),
                    normalizeStorageValue(ebayOverrides.almacenamiento),
                  );
                  const ipadProcesadores = ensureOptionList(getIpadProcesadores(ebayOverrides.gama), ebayOverrides.procesador);
                  const ipadTamanos = ensureOptionList(getIpadTamanos(ebayOverrides.gama, ebayOverrides.procesador), ebayOverrides.pantalla);
                  const ipadAlm = ensureOptionList(
                    getIpadAlmacenamiento(ebayOverrides.gama, ebayOverrides.generacion, ebayOverrides.procesador).map(normalizeStorageValue),
                    normalizeStorageValue(ebayOverrides.almacenamiento),
                  );
                  const iphoneModelos = ensureOptionList(getIphoneModelos(ebayOverrides.numero), ebayOverrides.modelo);
                  const iphoneAlm = getIphoneAlmacenamientos(ebayOverrides.numero, ebayOverrides.modelo).map(normalizeStorageValue);
                  const watchTamanos = ensureOptionList(getWatchTamanos(ebayOverrides.generacion), ebayOverrides.pantalla);
                  const tipoOptions = ensureOptionValue([
                    { value: '', label: 'Selecciona' },
                    { value: 'macbook', label: 'Macbook' },
                    { value: 'ipad', label: 'iPad' },
                    { value: 'iphone', label: 'iPhone' },
                    { value: 'watch', label: 'Apple Watch' },
                    { value: 'otro', label: 'Otro' },
                  ], ebayOverrides.tipo);
                  return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tipo</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.tipo}
                      onChange={(e) => {
                        const next = e.target.value;
                        setEbayOverrides((s) => ({
                          ...s,
                          tipo: next,
                          gama: '',
                          procesador: '',
                          pantalla: '',
                          ram: '',
                          almacenamiento: '',
                          numero: '',
                          modelo: '',
                          generacion: '',
                          conexion: '',
                        }));
                        setEbayTouched({
                          tipo: true,
                          gama: false,
                          procesador: false,
                          pantalla: false,
                          ram: false,
                          almacenamiento: false,
                          numero: false,
                          modelo: false,
                          generacion: false,
                          conexion: false,
                          condicion: false,
                        });
                      }}
                    >
                      {tipoOptions.map((opt) => (
                        <option key={opt.value || 'tipo'} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {isIphone && (
                    <>
                      <div>
                        <label className="block text-xs font-medium mb-1">Numero</label>
                        <select
                          className="w-full border rounded-lg p-2 bg-white"
                          value={ebayOverrides.numero}
                          onChange={(e) => {
                            const next = e.target.value;
                            setEbayOverrides((s) => ({
                              ...s,
                              numero: next,
                              modelo: '',
                              almacenamiento: '',
                            }));
                            setEbayTouched((t) => ({
                              ...t,
                              numero: true,
                              modelo: false,
                              almacenamiento: false,
                            }));
                          }}
                        >
                          <option value="">Selecciona</option>
                          {ensureOptionList(IPHONE_NUMEROS, ebayOverrides.numero).map((n) => (
                            <option key={`num-${n}`} value={n}>{n}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Modelo</label>
                        <select
                          className="w-full border rounded-lg p-2 bg-white"
                          value={ebayOverrides.modelo}
                          onChange={(e) => {
                            const next = e.target.value;
                            setEbayOverrides((s) => ({
                              ...s,
                              modelo: next,
                              almacenamiento: '',
                            }));
                            setEbayTouched((t) => ({
                              ...t,
                              modelo: true,
                              almacenamiento: false,
                            }));
                          }}
                        >
                          <option value="">Selecciona</option>
                          {iphoneModelos.map((m) => (
                            <option key={`modelo-${m}`} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Almacenamiento</label>
                        <select
                          className="w-full border rounded-lg p-2 bg-white"
                          value={normalizeStorageValue(ebayOverrides.almacenamiento)}
                          onChange={(e) => {
                            setEbayOverrides((s) => ({ ...s, almacenamiento: normalizeStorageValue(e.target.value) }));
                            setEbayTouched((t) => ({ ...t, almacenamiento: true }));
                          }}
                        >
                          <option value="">Selecciona</option>
                          {iphoneAlm.map((a) => (
                            <option key={`alm-${a}`} value={normalizeStorageValue(a)}>{formatStorageLabel(a)}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  {showGama && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Gama</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.gama}
                      onChange={(e) => {
                        const next = e.target.value;
                        setEbayOverrides((s) => ({
                          ...s,
                          gama: next,
                          procesador: '',
                          pantalla: '',
                          ram: '',
                          almacenamiento: '',
                        }));
                        setEbayTouched((t) => ({
                          ...t,
                          gama: true,
                          procesador: false,
                          pantalla: false,
                          ram: false,
                          almacenamiento: false,
                        }));
                      }}
                    >
                        {ensureOptionValue(
                          [
                            { value: '', label: 'Selecciona' },
                            ...(t === 'macbook' ? [
                              { value: 'Air', label: 'Air' },
                              { value: 'Pro', label: 'Pro' },
                            ] : [
                              { value: 'Normal', label: 'Normal' },
                              { value: 'Mini', label: 'Mini' },
                              { value: 'Air', label: 'Air' },
                              { value: 'Pro', label: 'Pro' },
                            ]),
                          ],
                          ebayOverrides.gama,
                        ).map((opt) => (
                          <option key={`${opt.value}-gama`} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {showProc && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Procesador</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.procesador}
                      onChange={(e) => {
                        const next = e.target.value;
                        setEbayOverrides((s) => ({
                          ...s,
                          procesador: next,
                          pantalla: '',
                          ram: '',
                          almacenamiento: '',
                        }));
                        setEbayTouched((t) => ({
                          ...t,
                          procesador: true,
                          pantalla: false,
                          ram: false,
                          almacenamiento: false,
                        }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {(t === 'macbook'
                        ? ensureOptionList(
                          ebayOverrides.gama === 'Air' ? MACBOOK_PROCESADORES_AIR : MACBOOK_PROCESADORES_PRO,
                          ebayOverrides.procesador,
                        )
                        : ensureOptionList(ipadProcesadores, ebayOverrides.procesador)
                      ).map((p) => (
                        <option key={`proc-${p}`} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  {showTam && (
                  <div>
                    <label className="block text-xs font-medium mb-1">{t === 'watch' ? 'Tamaño (mm)' : 'Tamaño'}</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.pantalla}
                      onChange={(e) => {
                        setEbayOverrides((s) => ({ ...s, pantalla: e.target.value }));
                        setEbayTouched((t) => ({ ...t, pantalla: true }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {(t === 'macbook' ? macSizes : (t === 'ipad' ? ipadTamanos : watchTamanos)).map((size) => (
                        <option key={`tam-${size}`} value={size}>{size}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  {showRam && (
                    <div>
                      <label className="block text-xs font-medium mb-1">RAM</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.ram}
                      onChange={(e) => {
                        setEbayOverrides((s) => ({ ...s, ram: e.target.value }));
                        setEbayTouched((t) => ({ ...t, ram: true }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {macRams.map((ram) => (
                        <option key={`ram-${ram}`} value={ram}>{ram}</option>
                      ))}
                    </select>
                    </div>
                  )}
                  {showAlm && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Almacenamiento</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={normalizeStorageValue(ebayOverrides.almacenamiento)}
                      onChange={(e) => {
                        setEbayOverrides((s) => ({ ...s, almacenamiento: normalizeStorageValue(e.target.value) }));
                        setEbayTouched((t) => ({ ...t, almacenamiento: true }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {(t === 'macbook' ? macSsds : (t === 'ipad' ? ipadAlm : iphoneAlm)).map((a) => (
                        <option key={`alm-${a}`} value={normalizeStorageValue(a)}>{formatStorageLabel(a)}</option>
                      ))}
                    </select>
                  </div>
                  )}
                  {showGeneracion && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Generacion</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.generacion}
                      onChange={(e) => {
                          const next = e.target.value;
                          setEbayOverrides((s) => ({
                            ...s,
                            generacion: next,
                            pantalla: '',
                            conexion: '',
                        }));
                        setEbayTouched((t) => ({
                          ...t,
                          generacion: true,
                          pantalla: false,
                          conexion: false,
                        }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {ensureOptionList(WATCH_GENERACIONES, ebayOverrides.generacion).map((g) => (
                        <option key={`gen-${g}`} value={g}>{g}</option>
                      ))}
                    </select>
                    </div>
                  )}
                  {showConexion && (
                    <div>
                      <label className="block text-xs font-medium mb-1">Conexion</label>
                    <select
                      className="w-full border rounded-lg p-2 bg-white"
                      value={ebayOverrides.conexion}
                      onChange={(e) => {
                        setEbayOverrides((s) => ({ ...s, conexion: e.target.value }));
                        setEbayTouched((t) => ({ ...t, conexion: true }));
                      }}
                    >
                      <option value="">Selecciona</option>
                      {ensureOptionList(WATCH_CONEXIONES, ebayOverrides.conexion).map((c) => (
                        <option key={`conn-${c}`} value={c}>{c}</option>
                      ))}
                    </select>
                    </div>
                  )}
                </div>
                  );
                })()}
                <div className="mt-3">
                  <label className="block text-xs font-medium mb-1">Condition</label>
                <select
                  className="w-full border rounded-lg p-2 bg-white"
                  value={ebayOverrides.condicion}
                  onChange={(e) => {
                    setEbayOverrides((s) => ({ ...s, condicion: e.target.value }));
                    setEbayTouched((t) => ({ ...t, condicion: true }));
                  }}
                >
                    <option value="">Selecciona</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="para piezas">Para piezas</option>
                  </select>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Si el titulo no trae estos datos, completa aqui para comparar costos.
                </div>
              </div>
            </div>
          </Card>


          <Card title="Resultados">
            <div className="space-y-4 pb-3 border-b border-gray-200 mb-3">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 180" />
              <Input label="Envio USA (USD) - opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 180" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 9.55" />
              <Input label="TC Compras (S/ por USD)"    value={tipoCambio}       onChange={setTipoCambio}            placeholder="3.75" />
              <div className="text-sm text-gray-500">
                * Promo -35% solo hasta 3 Kg (transporte eShopex).<br />
                * &gt;10 Kg: S/ {ADICIONAL_05KG} por cada 0.5 Kg adicional.
              </div>
            </div>
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Precio en soles ((Prod + Envio USA) x {num(tipoCambio).toFixed(2)}):</span><strong>{fmtSoles(compras.precioSoles)}</strong></li>
              <li className="flex justify-between"><span>Costo de envio:</span><strong>{fmtSoles(compras.costoEnvio)}</strong></li>
              <li className="flex justify-between"><span>Costo total (S/):</span><strong>{fmtSoles(compras.costoTotal)}</strong></li>
              <li className="flex justify-between text-xl"><span>Precio de venta minimo (+20%):</span><strong>{fmtSoles(compras.precioVentaMin)}</strong></li>
              <li className="mt-2 pt-2 border-t flex items-center gap-2 text-xs">
                <label className="text-xs text-gray-600">Precio de venta</label>
                <input className="w-32 sm:w-40 border rounded px-2 py-1 text-sm" inputMode="decimal" placeholder="S/ 0.00" value={pvCompras} onChange={(e)=>setPvCompras(e.target.value)} />
                <strong className="text-xs">Ganancia: {fmtSoles(Math.max(0, num(pvCompras) - compras.costoTotal))}</strong>
              </li>
              <li className="flex justify-between"><span>Ganancia estimada:</span><strong>{fmtSoles(compras.ganancia)}</strong></li>
            </ul>
          </Card>

          <Card title="Precios sugeridos">
            <div className="text-xs text-gray-500 mb-2">
              Precio (USD): <strong>{fmtUSD((num(debounced.precioUsd) || 0) + (num(debounced.envioUsaUsd) || 0))}</strong>
            </div>
            {analyticsLoading || historialLoading ? (
              <div className="text-sm text-gray-500">Cargando productos...</div>
            ) : historialCompras.length === 0 ? (
              <div className="text-sm text-gray-500">Nunca se compro. No hay registros.</div>
            ) : (
              <div className="flex flex-col h-[420px]">
                <div className="space-y-2 text-sm text-gray-700 overflow-auto pr-1">
                  {historialCompras.map((h) => (
                    <div key={h.id} className="rounded-lg border border-gray-100 bg-white/70 px-3 py-2 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-medium text-gray-900" title={h.label}>{h.label}</div>
                        {hasSuggestions && (
                          <div className="mt-1 text-xs text-gray-500">
                            {Number.isFinite(h.ventaPrecio)
                              ? `Venta: ${fmtSoles(h.ventaPrecio)}${Number.isFinite(h.diasVenta) ? ` | Dias: ${Math.round(h.diasVenta)}` : ''}`
                              : 'Venta: Aun no se han vendido'}
                          </div>
                        )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Compra</div>
                          <div className="font-semibold text-gray-900">{fmtUSD(h.valorUSD)}</div>
                          <div className="text-xs text-gray-500 mt-0.5">{fmtSoles(h.costoTotal)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {hasSuggestions && (
                  <div className="mt-auto pt-3 border-t">
                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                      Recomendaciones
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs text-gray-700">
                      {sugeridosResumen.ventaRango && (
                        <div className="flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1">
                          <span>Rango venta sugerido</span>
                          <span className="font-semibold text-emerald-700">
                            {fmtSoles(sugeridosResumen.ventaRango.min)} - {fmtSoles(sugeridosResumen.ventaRango.max)}
                          </span>
                        </div>
                      )}
                      {sugeridosResumen.compraRango && (
                        <div className="flex items-center justify-between rounded-md bg-blue-50 px-2 py-1">
                          <span>Rango compra sugerido (USD)</span>
                          <span className="font-semibold text-blue-700">
                            {fmtUSD(sugeridosResumen.compraRango.min)} - {fmtUSD(sugeridosResumen.compraRango.max)}
                          </span>
                        </div>
                      )}
                      {recomendacionMeta && (
                        <div className={`rounded-xl px-4 py-3 ring-1 ${recomendacionMeta.bg} ${recomendacionMeta.ring}`}>
                          <div className="text-[11px] uppercase tracking-wider text-gray-500">Recomendable ?</div>
                          <div className={`text-2xl font-extrabold ${recomendacionMeta.text}`}>{recomendacionMeta.label}</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* -------- KENNY -------- */}
      {tab === "kenny" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Datos de entrada (Kenny)">
            <div className="space-y-4">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 180" />
              <Input label="Envio USA (USD) - opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 180" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 1.8" />
              <div className="text-sm text-gray-500">
                * TC fijo {TC_KENNY.toFixed(2)}.  * Promo -35% hasta 3 Kg.  * &gt;10 Kg: S/ {ADICIONAL_05KG} por cada 0.5 Kg adicional.
              </div>
            </div>
          </Card>

          <Card title="Costo de Envio (desglose)">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Peso facturable (kg):</span><strong>{kenny.pesoFacturable.toFixed(1)}</strong></li>
              <li className="flex justify-between"><span>Transporte (tabla eShopex):</span><strong>{fmtSoles(kenny.transporteBruto)}</strong></li>
              <li className="flex justify-between"><span>Promo -35% (hasta 3 Kg):</span><strong>- {fmtSoles(kenny.promoDescuento)}</strong></li>
              <li className="flex justify-between"><span>Transporte con promo:</span><strong>{fmtSoles(kenny.transporteConPromo)}</strong></li>
              <li className="flex justify-between"><span>Honorarios:</span><strong>{fmtSoles(kenny.honorarios)}</strong></li>
              <li className="flex justify-between"><span>Seguro:</span><strong>{fmtSoles(kenny.seguro)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between text-lg"><span>Total Envio:</span><strong>{fmtSoles(kenny.costoEnvio)}</strong></li>
              <li className="flex justify-between"><span>Extra (13% de Precio en soles, redondeado a 10):</span><strong>{fmtSoles(kenny.extra)}</strong></li>
              <li className="flex justify-between"><span>Total Envio:</span><strong>{fmtSoles(kenny.costoEnvio + kenny.extra)}</strong></li>
            </ul>
          </Card>

          <Card title="Resultados Kenny">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Precio en soles ((Prod + Envio USA)  {TC_KENNY.toFixed(2)}):</span><strong>{fmtSoles(kenny.precioSoles)}</strong></li>
              <li className="flex justify-between"><span>Costo Total Kenny:</span><strong>{fmtSoles(kenny.costoTotal)}</strong></li>
              <hr className="my-2" />
              <li className="mt-2 pt-2 border-t flex items-center gap-2 text-xs">
                <label className="text-xs text-gray-600">Precio de venta</label>
                <input className="w-32 sm:w-40 border rounded px-2 py-1 text-sm" inputMode="decimal" placeholder="S/ 0.00" value={pvKenny} onChange={(e)=>setPvKenny(e.target.value)} />
                <strong className="text-xs">Ganancia: {fmtSoles(Math.max(0, num(pvKenny) - kenny.costoTotal))}</strong>
              </li>
              <li className="flex justify-between"><span>Precio de Venta +10% (redondeado a 10):</span><strong>{fmtSoles(kenny.pv10)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +10%:</span><strong>{fmtSoles(kenny.ganancia10)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>Precio de Venta +20% (redondeado a 10):</span><strong>{fmtSoles(kenny.pv20)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +20%:</span><strong>{fmtSoles(kenny.ganancia20)}</strong></li>
            </ul>
          </Card>
        </div>
      )}

      {/* -------- JORGE -------- */}
      {tab === "jorge" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Datos de entrada (Jorge)">
            <div className="space-y-4">
              <Input label="Precio del Producto (USD)" value={form.precioUsd}   onChange={setField("precioUsd")}   placeholder="p.ej. 470" />
              <Input label="Envio USA (USD) - opcional" value={form.envioUsaUsd} onChange={setField("envioUsaUsd")} placeholder="p.ej. 12" />
              <Input label="Precio DEC (USD)"           value={form.decUsd}      onChange={setField("decUsd")}      placeholder="p.ej. 115" />
              <Input label="Peso estimado (Kg)"         value={form.pesoKg}      onChange={setField("pesoKg")}      placeholder="p.ej. 3" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">TC Jorge (S/ por USD)</label>
                  <input
                    type="text" inputMode="decimal"
                    className="w-full border rounded-lg p-2"
                    value={tcJorge} onChange={setTcJorge} placeholder={String(TC_JORGE_DEFAULT)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Extra (S/)  redondeado a 10</label>
                  <div className="flex gap-2">
                    <input
                      type="text" inputMode="decimal"
                      className="w-full border rounded-lg p-2"
                      value={extraJInput} onChange={(e) => setExtraJInput(e.target.value)} placeholder="100"
                    />
                    <button
                      onClick={() => setExtraJ(round10HalfUp(num(extraJInput)))}
                      className="px-3 rounded-lg bg-gray-800 text-white" title="Aplicar y redondear a 10 (.5 hacia arriba)"
                    >
                      OK
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Actual: {fmtSoles(extraJ)} (aplicado)</p>
                </div>
              </div>

              <div className="text-sm text-gray-500">
                * PB = (Base en soles + Envio normal)  <strong>1.07</strong>.<br />
                * PB redondeado a mltiplos de 5 (nearest).<br />
                * Costo Total Jorge = PB redondeado + Extra.
              </div>
            </div>
          </Card>

          <Card title="Costo de Envio (desglose)">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Peso facturable (kg):</span><strong>{jorge.pesoFacturable.toFixed(1)}</strong></li>
              <li className="flex justify-between"><span>Transporte (tabla eShopex):</span><strong>{fmtSoles(jorge.transporteBruto)}</strong></li>
              <li className="flex justify-between"><span>Promo -35% (hasta 3 Kg):</span><strong>- {fmtSoles(jorge.promoDescuento)}</strong></li>
              <li className="flex justify-between"><span>Transporte con promo:</span><strong>{fmtSoles(jorge.transporteConPromo)}</strong></li>
              <li className="flex justify-between"><span>Honorarios:</span><strong>{fmtSoles(jorge.honorarios)}</strong></li>
              <li className="flex justify-between"><span>Seguro:</span><strong>{fmtSoles(jorge.seguro)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between text-lg"><span>Total Envio:</span><strong>{fmtSoles(jorge.costoEnvio)}</strong></li>
              <li className="flex justify-between"><span>Mi ganancia (7% de base + extra):</span><strong>{fmtSoles((jorge.baseSoles * 0.07) + (Number(extraJ)||0))}</strong></li>
            </ul>
          </Card>

          <Card title="Resultados Jorge">
            <ul className="space-y-2">
              <li className="flex justify-between"><span>Base en soles ((Prod + Envio USA)  {num(tcJorge).toFixed(2)}):</span><strong>{fmtSoles(jorge.baseSoles)}</strong></li>
              <li className="flex justify-between"><span>Envio normal:</span><strong>{fmtSoles(jorge.costoEnvio)}</strong></li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>PB = (Base + Envio)  1.07:</span><strong>{fmtSoles(jorge.pb)}</strong></li>
              <li className="flex justify-between"><span>PB redondeado (a 5):</span><strong>{fmtSoles(jorge.pbR)}</strong></li>
              <li className="flex justify-between"><span>Extra (aplicado, redondeado a 10):</span><strong>{fmtSoles(extraJ)}</strong></li>
              <li className="flex justify-between text-lg"><span>Costo Total Jorge (PB redondeado + Extra):</span><strong>{fmtSoles(jorge.costoTotal)}</strong></li>
              <li className="mt-2 pt-2 border-t flex items-center gap-2 text-xs">
                <label className="text-xs text-gray-600">Precio de venta</label>
                <input className="w-32 sm:w-40 border rounded px-2 py-1 text-sm" inputMode="decimal" placeholder="S/ 0.00" value={pvJorge} onChange={(e)=>setPvJorge(e.target.value)} />
                <strong className="text-xs">Ganancia: {fmtSoles(Math.max(0, num(pvJorge) - (jorge.baseSoles + jorge.costoEnvio)))}</strong>
              </li>
              <hr className="my-2" />
              <li className="flex justify-between"><span>Precio de Venta +10% (redondeado a 10):</span><strong>{fmtSoles(jorge.pv10)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +10%:</span><strong>{fmtSoles(jorge.ganancia10)}</strong></li>
              <li className="flex justify-between"><span>Precio de Venta +20% (redondeado a 10):</span><strong>{fmtSoles(jorge.pv20)}</strong></li>
              <li className="flex justify-between"><span>Ganancia con +20%:</span><strong>{fmtSoles(jorge.ganancia20)}</strong></li>
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}








