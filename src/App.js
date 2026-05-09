import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import Home from './pages/Home';
import api from './api';
import {
  FiActivity,
  FiBarChart2,
  FiBox,
  FiBriefcase,
  FiDollarSign,
  FiEye,
  FiGrid,
  FiHash,
  FiHome,
  FiMenu,
  FiPieChart,
  FiRefreshCw,
  FiSearch,
  FiSettings,
  FiTruck,
  FiX,
} from 'react-icons/fi';

const Productos = lazy(() => import('./pages/Productos'));
const Servicios = lazy(() => import('./pages/Servicios'));
const Calculadora = lazy(() => import('./pages/Calculadora'));
const Ganancias = lazy(() => import('./pages/Ganancias'));
const Analisis = lazy(() => import('./pages/Analisis'));
const GastosIndex = lazy(() => import('./pages/GastosIndex'));
const AnalisisGastos = lazy(() => import('./pages/AnalisisGastos'));
const PresupuestoGastos = lazy(() => import('./pages/PresupuestoGastos'));
const Ebay = lazy(() => import('./pages/Ebay'));
const ModalFotosManual = lazy(() => import('./components/ModalFotosManual'));

const ESHOPEX_BG_TRIGGER_KEY = 'eshopex-carga-trigger-ts';
const ESHOPEX_BG_REQUESTED_KEY = 'eshopex-carga-requested';
const ESHOPEX_BG_LOADING_KEY = 'eshopex-carga-bg-loading';
const ESHOPEX_BG_ERROR_KEY = 'eshopex-carga-bg-error';
const ESHOPEX_CARGA_CACHE_KEY = 'eshopex-carga-cache';
const ESHOPEX_BG_OPEN_MODAL_KEY = 'eshopex-carga-open-modal';
const ESHOPEX_BG_COUNT_KEY = 'eshopex-carga-pendientes-count';
const ESHOPEX_BG_CONSUMED_KEY = 'eshopex-carga-trigger-consumed-ts';
const SIDEBAR_HIDDEN_KEY = 'app-sidebar-hidden';
const PRODUCTOS_CACHE_KEY = 'productos:cache:v2';
const PRODUCTOS_CACHE_TTL_MS = 2 * 60 * 1000;
const CALCU_RAPIDA_DEC_USD = 90;
const CALCU_RAPIDA_TC_DEFAULT = '3.75';
const PAGE_KEEP_ALIVE_TTL_MS = 10 * 60 * 1000;
const APP_LOGO_URL = `${process.env.PUBLIC_URL || ''}/logo.png`;
const CALCU_RAPIDA_TARIFAS = [
  { maxKg: 0.5, precio: 30.60 }, { maxKg: 1.0, precio: 55.00 },
  { maxKg: 1.5, precio: 74.00 }, { maxKg: 2.0, precio: 90.00 },
  { maxKg: 2.5, precio: 110.00 }, { maxKg: 3.0, precio: 120.00 },
  { maxKg: 3.5, precio: 130.00 }, { maxKg: 4.0, precio: 140.00 },
  { maxKg: 4.5, precio: 150.00 }, { maxKg: 5.0, precio: 160.00 },
  { maxKg: 5.5, precio: 170.00 }, { maxKg: 6.0, precio: 180.00 },
  { maxKg: 6.5, precio: 190.00 }, { maxKg: 7.0, precio: 200.00 },
  { maxKg: 7.5, precio: 210.00 }, { maxKg: 8.0, precio: 220.00 },
  { maxKg: 8.5, precio: 230.00 }, { maxKg: 9.0, precio: 240.00 },
  { maxKg: 9.5, precio: 250.00 }, { maxKg: 10.0, precio: 260.00 },
];
const CALCU_RAPIDA_ADICIONAL_05KG = 10;
const EMPTY_ESH_PROGRESS = {
  status: 'idle',
  total: 0,
  completed: 0,
  remaining: 0,
  currentAccount: '',
  currentCasillero: '',
  message: '',
  error: null,
};

const CASILLERO_BY_ACCOUNT = {
  'gongarc2001@gmail.com': 'Walter',
  'renato1carbajal@gmail.com': 'Renato',
  'limonimofelip@gmail.com': 'Christian',
  'dracgonic12@gmail.com': 'Alex',
  'renato1carbajal@outlook.com': 'MamaRen',
  'goneba2526@gmail.com': 'Jorge',
  'gondrac10@gmail.com': 'Kenny',
  'macsominus@gmail.com': 'Sebastian',
};

const getKeepAliveEnabled = () => {
  try {
    return window.matchMedia('(min-width: 1024px)').matches;
  } catch {
    return true;
  }
};

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center p-6 text-sm text-slate-500">
    Cargando...
  </div>
);

const normalizeEshopexProgress = (raw) => {
  const total = Number(raw?.total || 0);
  const completed = Number(raw?.completed || 0);
  const remainingRaw = Number(raw?.remaining);
  const remaining = Number.isFinite(remainingRaw)
    ? Math.max(0, remainingRaw)
    : Math.max(0, total - completed);
  return {
    status: String(raw?.status || 'idle').toLowerCase(),
    total: Number.isFinite(total) ? Math.max(0, total) : 0,
    completed: Number.isFinite(completed) ? Math.max(0, completed) : 0,
    remaining,
    currentAccount: String(raw?.currentAccount || '').trim(),
    currentCasillero: String(raw?.currentCasillero || '').trim(),
    message: String(raw?.message || '').trim(),
    error: raw?.error ? String(raw.error) : null,
  };
};

const getLastTrackingGlobal = (p) => {
  const trk = Array.isArray(p?.tracking) ? [...p.tracking] : [];
  if (!trk.length) return null;
  trk.sort((a, b) => {
    if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return (b.id || 0) - (a.id || 0);
  });
  return trk[0] || null;
};

const buildNombreProductoGlobal = (p) => {
  if (!p) return '';
  const keyTamano = 'tama\u00f1o';
  if (p.tipo === 'otro') return (p.detalle?.descripcionOtro || '').trim() || 'Otros';
  if (String(p.tipo || '').toLowerCase() === 'iphone') {
    const numero = String(p.detalle?.numero || '').trim();
    const modelo = String(p.detalle?.modelo || '').trim();
    return ['iPhone', numero, modelo].filter(Boolean).join(' ');
  }
  if (String(p.tipo || '').toLowerCase() === 'watch') {
    return [
      'Apple Watch',
      p.detalle?.gama,
      p.detalle?.generacion,
      (p.detalle || {})['tamano'] || (p.detalle || {})[keyTamano] || (p.detalle || {})['tamanio'],
      p.detalle?.conexion,
    ].filter(Boolean).join(' ');
  }
  const parts = [
    p.tipo,
    p.detalle?.gama,
    p.detalle?.procesador,
    (p.detalle || {})['tamano'] || (p.detalle || {})[keyTamano] || (p.detalle || {})['tamanio'],
  ].filter(Boolean);
  return parts.join(' ');
};

const readProductosCache = () => {
  try {
    const raw = localStorage.getItem(PRODUCTOS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts) return null;
    if (Date.now() - parsed.ts > PRODUCTOS_CACHE_TTL_MS) return null;
    return Array.isArray(parsed.productos) ? parsed.productos : [];
  } catch {
    return null;
  }
};

const writeProductosCache = (productos) => {
  try {
    const raw = localStorage.getItem(PRODUCTOS_CACHE_KEY);
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem(
      PRODUCTOS_CACHE_KEY,
      JSON.stringify({
        ...prev,
        productos,
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
};

const getFilteredEshopexPendientes = (rows, productos) => {
  if (!Array.isArray(productos) || productos.length === 0) return [];

  const productosByEshopex = {};
  const trackingUsaEnEshopex = new Set();
  const casillerosEnCamino = new Set();

  for (const p of productos || []) {
    const t = getLastTrackingGlobal(p);
    const estadoProducto = String(t?.estado || '').toLowerCase();
    const trackingEshop = String(t?.trackingEshop || '').trim();
    if (trackingEshop) productosByEshopex[trackingEshop] = p;
    if (estadoProducto === 'en_eshopex') {
      const digits = String(t?.trackingUsa || '').replace(/\D+/g, '');
      if (digits) trackingUsaEnEshopex.add(digits);
    }
    if (estadoProducto === 'comprado_en_camino') {
      const cas = String(t?.casillero || '').trim().toLowerCase();
      if (cas) casillerosEnCamino.add(cas);
    }
  }

  return (Array.isArray(rows) ? rows : [])
    .filter((row) => {
      const estado = String(row?.estado || '').trim().toUpperCase();
      const guiaRaw = String(row?.guia || '').trim();
      const guiaDigits = guiaRaw.replace(/\D+/g, '');
      if (guiaDigits.length < 6) return false;
      if (productosByEshopex[guiaRaw]) return false;
      if (guiaDigits && trackingUsaEnEshopex.has(guiaDigits)) return false;
      if (estado.includes('PAGADO')) return false;
      return estado !== 'ENTREGADO';
    })
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const accountA = String(a.row?.account || '').trim().toLowerCase();
      const accountB = String(b.row?.account || '').trim().toLowerCase();
      const casA = String(CASILLERO_BY_ACCOUNT[accountA] || '').trim().toLowerCase();
      const casB = String(CASILLERO_BY_ACCOUNT[accountB] || '').trim().toLowerCase();
      const priA = casA && casillerosEnCamino.has(casA) ? 0 : 1;
      const priB = casB && casillerosEnCamino.has(casB) ? 0 : 1;
      if (priA !== priB) return priA - priB;
      return a.idx - b.idx;
    })
    .map((item) => item.row);
};

const isPendingCargaRow = (row) => {
  const estado = String(row?.estado || '').trim().toUpperCase();
  const guiaRaw = String(row?.guia || '').trim();
  const guiaDigits = guiaRaw.replace(/\D+/g, '');
  if (guiaDigits.length < 6) return false;
  if (estado.includes('PAGADO')) return false;
  if (estado.includes('ENTREGADO')) return false;
  return true;
};

const pendingFromRows = (rows, productos = readProductosCache() || []) => {
  if (Array.isArray(productos) && productos.length) return getFilteredEshopexPendientes(rows, productos);
  return Array.isArray(rows) ? rows.filter(isPendingCargaRow) : [];
};

const readCachedCargaRows = () => {
  try {
    const raw = localStorage.getItem(ESHOPEX_CARGA_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed?.rows) ? parsed.rows : [];
  } catch {
    return [];
  }
};

const calcNum = (value) => {
  if (value == null || value === '') return 0;
  const parsed = Number.parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const fmtSolesCalc = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `S/ ${parsed.toFixed(2)}` : '-';
};

const fmtUsdCalc = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `$ ${parsed.toFixed(2)}` : '-';
};

const ceil10Calc = (value) => Math.ceil((Number(value) || 0) / 10) * 10;

const roundTenth05DownCalc = (kg) => {
  const value = Number(String(kg).replace(',', '.')) || 0;
  if (value <= 0) return 0;
  const centi = Math.round(value * 100);
  const tens = Math.floor(centi / 10);
  const rem = centi - tens * 10;
  return (rem <= 5 ? tens : tens + 1) / 10;
};

const tarifaEshopexCalc = (pesoKg) => {
  if (!pesoKg || pesoKg <= 0) return 0;
  const points = CALCU_RAPIDA_TARIFAS;
  if (pesoKg <= points[0].maxKg) return (points[0].precio * pesoKg) / points[0].maxKg;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    if (pesoKg <= next.maxKg) {
      const t = (pesoKg - prev.maxKg) / (next.maxKg - prev.maxKg);
      return prev.precio + t * (next.precio - prev.precio);
    }
  }
  const extraKg = pesoKg - 10;
  return points[points.length - 1].precio + (extraKg / 0.5) * CALCU_RAPIDA_ADICIONAL_05KG;
};

const tarifaHasta3KgCalc = (pesoKg) => tarifaEshopexCalc(Math.min(Math.max(pesoKg || 0, 0), 3));
const honorariosPorDecCalc = (dec) => (dec <= 100 ? 16.30 : dec <= 200 ? 25.28 : dec <= 1000 ? 39.76 : 60.16);
const seguroPorDecCalc = (dec) => (dec <= 100 ? 8.86 : dec <= 200 ? 15.98 : 21.10);

const SIDEBAR_NAV = [
  { id: 'home', label: 'Inicio', icon: FiHome },
  { id: 'productos', label: 'Productos', icon: FiBox },
  { id: 'analisis', label: 'Analisis', icon: FiActivity },
  { id: 'calculadora', label: 'Calculadora', icon: FiHash },
  { id: 'ganancias', label: 'Ganancias', icon: FiDollarSign },
  { id: 'gastos', label: 'Gastos', icon: FiPieChart },
  { id: 'ebay', label: 'Ebay', icon: FiBriefcase },
  { id: 'servicios', label: 'Servicios', icon: FiSettings },
];

const SIDEBAR_SECONDARY_NAV = [
  { id: 'analisisGastos', label: 'Analisis gastos', icon: FiBarChart2 },
  { id: 'presupuestoGastos', label: 'Presupuesto', icon: FiGrid },
];

function App() {
  // Leer la última vista guardada; si no hay, usa 'home'
  const [vista, setVista] = useState('home');
  const [analisisBack, setAnalisisBack] = useState('home');
  const [keptVistas, setKeptVistas] = useState(() => ({ home: Date.now() }));
  const [eshopexUi, setEshopexUi] = useState(() => ({
    requested: false,
    loading: false,
    error: '',
    count: 0,
  }));
  const [eshopexProgress, setEshopexProgress] = useState(() => ({ ...EMPTY_ESH_PROGRESS }));
  const [eshopexModalOpen, setEshopexModalOpen] = useState(false);
  const [eshopexModalRows, setEshopexModalRows] = useState([]);
  const [productosGlobal, setProductosGlobal] = useState([]);
  const [fotosManualSeed, setFotosManualSeed] = useState({ trackingEshop: '', fechaRecepcion: '' });
  const [fotosManualOpen, setFotosManualOpen] = useState(false);
  const [eshopexPagoLoading, setEshopexPagoLoading] = useState(() => new Set());
  const [eshopexVincularOpen, setEshopexVincularOpen] = useState(false);
  const [eshopexVincularRow, setEshopexVincularRow] = useState(null);
  const [eshopexVincularLoading, setEshopexVincularLoading] = useState(() => new Set());
  const [calcuRapidaOpen, setCalcuRapidaOpen] = useState(false);
  const [calcuRapida, setCalcuRapida] = useState(() => ({
    precioUsd: '',
    envioUsaUsd: '',
    pesoKg: '',
    tipoCambio: CALCU_RAPIDA_TC_DEFAULT,
    precioVenta: '',
  }));
  const [calcuRapidaEbay, setCalcuRapidaEbay] = useState(() => ({
    url: '',
    loading: false,
    error: '',
    title: '',
    priceUSD: null,
    shippingUSD: null,
  }));
  const [sidebarHidden, setSidebarHidden] = useState(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_HIDDEN_KEY);
      if (saved === '1') return true;
      if (saved === '0') return false;
      return window.matchMedia('(max-width: 1023px)').matches;
    } catch {
      return false;
    }
  });
  const [keepAliveEnabled, setKeepAliveEnabled] = useState(getKeepAliveEnabled);

  useEffect(() => {
    try {
      localStorage.removeItem('vista');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const now = Date.now();
    setKeptVistas((prev) => {
      const next = { ...prev, [vista]: now };
      Object.keys(next).forEach((key) => {
        if (key !== vista && now - Number(next[key] || 0) > PAGE_KEEP_ALIVE_TTL_MS) {
          delete next[key];
        }
      });
      return next;
    });
  }, [vista]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      setKeptVistas((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (key !== vista && now - Number(next[key] || 0) > PAGE_KEEP_ALIVE_TTL_MS) {
            delete next[key];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 60 * 1000);
    return () => window.clearInterval(timer);
  }, [vista]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, sidebarHidden ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarHidden]);

  useEffect(() => {
    const onChange = () => setKeepAliveEnabled(getKeepAliveEnabled());
    onChange();
    try {
      const media = window.matchMedia('(min-width: 1024px)');
      if (media.addEventListener) {
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
      }
      media.addListener(onChange);
      return () => media.removeListener(onChange);
    } catch {
      return () => {};
    }
  }, []);

  // Al iniciar la app, no auto-disparar busquedas pendientes de sesiones anteriores.
  useEffect(() => {
    try {
      localStorage.removeItem(ESHOPEX_BG_REQUESTED_KEY);
      localStorage.removeItem(ESHOPEX_BG_TRIGGER_KEY);
      localStorage.removeItem(ESHOPEX_BG_LOADING_KEY);
      localStorage.removeItem(ESHOPEX_BG_ERROR_KEY);
      localStorage.removeItem(ESHOPEX_BG_COUNT_KEY);
      localStorage.removeItem(ESHOPEX_BG_CONSUMED_KEY);
      localStorage.removeItem(ESHOPEX_BG_OPEN_MODAL_KEY);
    } catch {
      /* ignore */
    }
    setEshopexUi({ requested: false, loading: false, error: '', count: 0 });
  }, []);

  useEffect(() => {
    const readUi = () => {
      const requested = localStorage.getItem(ESHOPEX_BG_REQUESTED_KEY) === '1';
      const trigger = Number(localStorage.getItem(ESHOPEX_BG_TRIGGER_KEY) || 0);
      const consumed = Number(localStorage.getItem(ESHOPEX_BG_CONSUMED_KEY) || 0);
      const hasPendingTrigger = requested && Number.isFinite(trigger) && trigger > 0 && trigger > consumed;
      const loadingRaw = localStorage.getItem(ESHOPEX_BG_LOADING_KEY) === '1';
      const loading = requested && (loadingRaw || hasPendingTrigger);
      const error = localStorage.getItem(ESHOPEX_BG_ERROR_KEY) || '';
      const countRaw = localStorage.getItem(ESHOPEX_BG_COUNT_KEY);
      let count = countRaw == null ? NaN : Number(countRaw);
      if (!Number.isFinite(count)) {
        const cachedRows = readCachedCargaRows();
        count = pendingFromRows(cachedRows, productosGlobal).length;
      }
      if (!hasPendingTrigger && loadingRaw) {
        try {
          localStorage.setItem(ESHOPEX_BG_LOADING_KEY, '0');
        } catch {
          /* ignore */
        }
      }
      setEshopexUi({ requested, loading, error, count: Math.max(0, count) });
    };

    const timer = window.setInterval(readUi, 1000);
    readUi();
    return () => window.clearInterval(timer);
  }, [productosGlobal]);

  const triggerEshopexBg = () => {
    const nowTs = Date.now();
    try {
      localStorage.setItem(ESHOPEX_BG_REQUESTED_KEY, '1');
      localStorage.setItem(ESHOPEX_BG_TRIGGER_KEY, String(nowTs));
      localStorage.setItem(ESHOPEX_BG_LOADING_KEY, '1');
      localStorage.removeItem(ESHOPEX_BG_ERROR_KEY);
    } catch {
      /* ignore */
    }
    setEshopexUi((prev) => ({ ...prev, requested: true, loading: true, error: '' }));
    setEshopexProgress((prev) => ({
      ...prev,
      status: 'running',
      message: 'Iniciando busqueda...',
      error: null,
    }));
  };

  const openEshopexInProductos = () => {
    const cachedProductos = readProductosCache();
    if (cachedProductos) setProductosGlobal(cachedProductos);
    setEshopexModalRows(readCachedCargaRows());
    setEshopexModalOpen(true);
    if (!cachedProductos?.length) {
      refreshProductosGlobal();
    }
    try {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setSidebarHidden(true);
      }
    } catch {
      /* ignore */
    }
  };

  // Worker global: mantiene la busqueda de pendientes Eshopex aunque cambies de vista.
  useEffect(() => {
    let alive = true;
    let inFlight = false;

    const run = async () => {
      const requested = localStorage.getItem(ESHOPEX_BG_REQUESTED_KEY) === '1';
      const trigger = Number(localStorage.getItem(ESHOPEX_BG_TRIGGER_KEY) || 0);
      const consumed = Number(localStorage.getItem(ESHOPEX_BG_CONSUMED_KEY) || 0);
      if (!requested) return;
      if (!Number.isFinite(trigger) || trigger <= 0) return;
      if (Number.isFinite(consumed) && trigger <= consumed) return;
      if (inFlight) return;

      inFlight = true;
      try {
        localStorage.setItem(ESHOPEX_BG_LOADING_KEY, '1');
        localStorage.removeItem(ESHOPEX_BG_ERROR_KEY);
      } catch {
        /* ignore */
      }

      try {
        const data = await api.get('/tracking/eshopex-carga');
        if (!alive) return;
        const rows = Array.isArray(data) ? data : (data?.data || []);
        try {
          const pendingCount = pendingFromRows(rows, readProductosCache() || []).length;
          localStorage.setItem(
            ESHOPEX_CARGA_CACHE_KEY,
            JSON.stringify({ ts: Date.now(), rows: Array.isArray(rows) ? rows : [] }),
          );
          localStorage.setItem(ESHOPEX_BG_COUNT_KEY, String(pendingCount));
        } catch {
          /* ignore */
        }
      } catch (e) {
        if (!alive) return;
        try {
          localStorage.setItem(ESHOPEX_BG_ERROR_KEY, 'No se pudo cargar la informacion de Eshopex.');
        } catch {
          /* ignore */
        }
      } finally {
        inFlight = false;
        if (!alive) return;
        try {
          localStorage.setItem(ESHOPEX_BG_CONSUMED_KEY, String(trigger));
          localStorage.setItem(ESHOPEX_BG_LOADING_KEY, '0');
        } catch {
          /* ignore */
        }
      }
    };

    const timer = window.setInterval(run, 1500);
    run();

    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!eshopexModalOpen) return () => {};
    let alive = true;
    const sync = () => {
      setEshopexModalRows(readCachedCargaRows());
      const cachedProductos = readProductosCache();
      if (cachedProductos) setProductosGlobal(cachedProductos);
    };
    sync();
    (async () => {
      try {
        const data = await api.get('/productos');
        if (!alive) return;
        const lista = Array.isArray(data)
          ? data
          : (Array.isArray(data?.items) ? data.items : []);
        setProductosGlobal(lista);
        writeProductosCache(lista);
      } catch {
        /* ignore */
      }
    })();
    const timer = window.setInterval(sync, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [eshopexModalOpen]);

  useEffect(() => {
    if (!eshopexUi.loading) return () => {};
    let alive = true;
    const pullProgress = async () => {
      try {
        const data = await api.get('/tracking/eshopex-carga-progress');
        if (!alive) return;
        setEshopexProgress(normalizeEshopexProgress(data));
      } catch {
        /* ignore */
      }
    };
    const timer = window.setInterval(pullProgress, 700);
    pullProgress();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [eshopexUi.loading]);

  const eshopexModalPendientes = useMemo(
    () => getFilteredEshopexPendientes(eshopexModalRows, productosGlobal),
    [eshopexModalRows, productosGlobal],
  );

  const productosByEshopexGlobal = useMemo(() => {
    const map = {};
    for (const p of productosGlobal || []) {
      const code = String(getLastTrackingGlobal(p)?.trackingEshop || '').trim();
      if (code) map[code] = p;
    }
    return map;
  }, [productosGlobal]);

  useEffect(() => {
    const count = eshopexModalPendientes.length;
    try {
      localStorage.setItem(ESHOPEX_BG_COUNT_KEY, String(count));
    } catch {
      /* ignore */
    }
    setEshopexUi((prev) => ({ ...prev, count }));
  }, [eshopexModalPendientes.length]);

  const openFotosManualGlobal = (row) => {
    setFotosManualSeed({
      trackingEshop: String(row?.guia || '').trim(),
      fechaRecepcion: String(row?.fechaRecepcion || '').trim(),
    });
    setFotosManualOpen(true);
  };

  const markPagoLoading = (key, active) => {
    setEshopexPagoLoading((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const markVincularLoading = (key, active) => {
    setEshopexVincularLoading((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const parseEshopexFecha = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const monthMap = {
      jan: '01', ene: '01',
      feb: '02',
      mar: '03',
      apr: '04', abr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08', ago: '08',
      sep: '09', set: '09',
      oct: '10',
      nov: '11',
      dec: '12', dic: '12',
    };
    const match = raw.match(/^([A-Za-z]{3,})\s*[-/ ]?\s*(\d{1,2})\s*[-/ ]?\s*(\d{4})$/);
    if (match) {
      const mm = monthMap[match[1].slice(0, 3).toLowerCase()];
      if (mm) return `${match[3]}-${mm}-${String(match[2]).padStart(2, '0')}`;
    }
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = parsed.getFullYear();
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return '';
  };

  const parseEshopexPeso = (value) => {
    const raw = String(value || '').trim();
    if (!raw || /^null$/i.test(raw)) return null;
    const normalized = raw.replace(/,/g, '.').replace(/[^0-9.]+/g, ' ').trim();
    const token = normalized.split(/\s+/).find(Boolean) || '';
    const parsed = Number(token);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return Number(parsed.toFixed(2));
  };

  const openEshopexVincularModalGlobal = (row) => {
    setEshopexVincularRow(row || null);
    setEshopexVincularOpen(true);
  };

  const refreshProductosGlobal = async () => {
    try {
      const data = await api.get('/productos');
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : []);
      setProductosGlobal(lista);
      writeProductosCache(lista);
      return lista;
    } catch {
      return null;
    }
  };

  const handleEshopexVincularGlobal = async (row, producto) => {
    const code = String(row?.guia || '').trim();
    const productoId = producto?.id;
    const key = `${code}-vincular-${productoId || 'na'}`;
    if (!code || !productoId || eshopexVincularLoading.has(key)) return;
    markVincularLoading(key, true);
    try {
      const fecha = parseEshopexFecha(row?.fechaRecepcion || '');
      const peso = parseEshopexPeso(row?.peso || '');
      const currentValor = producto?.valor || {};
      const payload = {
        trackingEshop: code,
        estatusEsho: String(row?.estado || '').trim(),
      };
      if (fecha) payload.fechaRecepcion = fecha;
      await api.put(`/tracking/producto/${productoId}`, payload);
      if (peso != null) {
        await api.patch(`/productos/${productoId}`, {
          valor: {
            valorProducto: currentValor?.valorProducto,
            valorDec: currentValor?.valorDec,
            peso,
            fechaCompra: currentValor?.fechaCompra,
          },
        });
      }
      await refreshProductosGlobal();
      setEshopexVincularOpen(false);
    } catch (err) {
      console.error(err);
      alert('No se pudo vincular el tracking Eshopex.');
    } finally {
      markVincularLoading(key, false);
    }
  };

  const handleEshopexPrepagoGlobal = async (row) => {
    const accountKey = String(row?.account || '').trim().toLowerCase();
    const code = String(row?.guia || '').trim();
    const key = `${code}-${accountKey}`;
    if (!accountKey) {
      alert('No se encontro la cuenta de Eshopex para este registro.');
      return;
    }
    if (eshopexPagoLoading.has(key)) return;
    markPagoLoading(key, true);
    try {
      const res = await api.post('/tracking/eshopex-prepago', { account: accountKey });
      const url = res?.url || res?.confirmUrl || '';
      if (!url) throw new Error('Sin URL de confirmacion');
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      console.error(err);
      alert('No se pudo iniciar el pago en Eshopex.');
    } finally {
      markPagoLoading(key, false);
    }
  };

  const calcuRapidaResultados = useMemo(() => {
    const precioUsd = calcNum(calcuRapida.precioUsd);
    const envioUsaUsd = calcNum(calcuRapida.envioUsaUsd);
    const decUsd = CALCU_RAPIDA_DEC_USD;
    const pesoFacturable = roundTenth05DownCalc(calcNum(calcuRapida.pesoKg));
    const tc = calcNum(calcuRapida.tipoCambio);
    const baseUsd = precioUsd + envioUsaUsd;
    const precioSoles = baseUsd * tc;
    const transporteBruto = tarifaEshopexCalc(pesoFacturable);
    const promoDescuento = tarifaHasta3KgCalc(pesoFacturable) * 0.35;
    const transporteConPromo = Math.max(0, transporteBruto - promoDescuento);
    const honorarios = honorariosPorDecCalc(decUsd);
    const seguro = seguroPorDecCalc(decUsd);
    const costoEnvio = transporteConPromo + honorarios + seguro;
    const costoTotal = precioSoles + costoEnvio;
    const precioVentaMin = ceil10Calc(costoTotal * 1.2);
    const ganancia = precioVentaMin - costoTotal;
    const precioVentaManual = calcNum(calcuRapida.precioVenta);
    const gananciaManual = Math.max(0, precioVentaManual - costoTotal);
    const margenManual = costoTotal > 0 && precioVentaManual > 0
      ? (gananciaManual / costoTotal) * 100
      : 0;

    return {
      precioUsd,
      envioUsaUsd,
      decUsd,
      pesoFacturable,
      tc,
      baseUsd,
      precioSoles,
      transporteBruto,
      promoDescuento,
      transporteConPromo,
      honorarios,
      seguro,
      costoEnvio,
      costoTotal,
      precioVentaMin,
      ganancia,
      precioVentaManual,
      gananciaManual,
      margenManual,
    };
  }, [calcuRapida]);

  const setCalcuRapidaField = (field) => (event) => {
    const value = event?.target?.value ?? '';
    setCalcuRapida((prev) => ({ ...prev, [field]: value }));
  };

  const setCalcuRapidaEbayUrl = (event) => {
    const value = event?.target?.value ?? '';
    setCalcuRapidaEbay((prev) => ({ ...prev, url: value, error: '' }));
  };

  const buscarCalcuRapidaEbay = async () => {
    const url = String(calcuRapidaEbay.url || '').trim();
    if (!url) {
      setCalcuRapidaEbay((prev) => ({ ...prev, error: 'Ingresa un URL de eBay.' }));
      return;
    }
    setCalcuRapidaEbay((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const data = await api.get(`/utils/ebay?url=${encodeURIComponent(url)}`);
      const price = Number.isFinite(Number(data?.priceUSD)) ? Number(data.priceUSD) : null;
      const shipping = Number.isFinite(Number(data?.shippingUSD)) ? Number(data.shippingUSD) : null;
      setCalcuRapidaEbay((prev) => ({
        ...prev,
        loading: false,
        title: String(data?.title || ''),
        priceUSD: price,
        shippingUSD: shipping,
      }));
      setCalcuRapida((prev) => ({
        ...prev,
        ...(price != null ? { precioUsd: String(price) } : {}),
        ...(shipping != null ? { envioUsaUsd: String(shipping) } : {}),
      }));
    } catch (err) {
      setCalcuRapidaEbay((prev) => ({
        ...prev,
        loading: false,
        error: String(err?.response?.data?.message || err?.message || 'No se pudo leer el URL de eBay.'),
      }));
    }
  };

  const openCalcuRapida = () => {
    setCalcuRapidaOpen(true);
    try {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setSidebarHidden(true);
      }
    } catch {
      /* ignore */
    }
  };

  const eshopexProgressText = useMemo(() => {
    if (!eshopexUi.loading) return '';
    const target = eshopexProgress.currentCasillero || eshopexProgress.currentAccount;
    const remaining = Number(eshopexProgress.remaining || 0);
    const completed = Number(eshopexProgress.completed || 0);
    const total = Number(eshopexProgress.total || 0);
    if (total > 0) {
      return `${target ? `${target} ` : ''}${Math.min(completed, total)}/${total} · faltan ${remaining}`;
    }
    return target ? `${target} · faltan ${remaining}` : 'Buscando...';
  }, [eshopexUi.loading, eshopexProgress]);

  const navigateTo = (nextVista) => {
    if (nextVista === 'analisis') {
      setAnalisisBack(vista === 'analisis' ? analisisBack : vista);
    }
    setVista(nextVista);
    try {
      if (window.matchMedia('(max-width: 1023px)').matches) {
        setSidebarHidden(true);
      }
    } catch {
      /* ignore */
    }
  };

  const renderVistaContent = (id) => {
    switch (id) {
      case 'home':
        return <Home setVista={navigateTo} setAnalisisBack={setAnalisisBack} />;
      case 'productos':
        return <Productos setVista={navigateTo} setAnalisisBack={setAnalisisBack} />;
      case 'servicios':
        return <Servicios setVista={navigateTo} />;
      case 'calculadora':
        return <Calculadora setVista={navigateTo} />;
      case 'ebay':
        return <Ebay setVista={navigateTo} />;
      case 'ganancias':
        return <Ganancias setVista={navigateTo} />;
      case 'gastos':
        return <GastosIndex setVista={navigateTo} />;
      case 'analisis':
        return <Analisis setVista={navigateTo} analisisBack={analisisBack} />;
      case 'analisisGastos':
        return <AnalisisGastos setVista={navigateTo} />;
      case 'presupuestoGastos':
        return <PresupuestoGastos setVista={navigateTo} />;
      default:
        return <Home setVista={navigateTo} setAnalisisBack={setAnalisisBack} />;
    }
  };

  const renderVista = () => {
    const renderedVistas = keepAliveEnabled
      ? Array.from(new Set([...Object.keys(keptVistas), vista]))
      : [vista];
    return (
      <>
        {renderedVistas.map((id) => {
          const active = vista === id;
          return (
            <section key={id} className={active ? 'block' : 'hidden'} aria-hidden={!active}>
              <Suspense fallback={<PageFallback />}>
                {renderVistaContent(id)}
              </Suspense>
            </section>
          );
        })}
      </>
    );
  };

  const renderNavItem = ({ id, label, icon: Icon }) => {
    const active = vista === id;
    return (
      <button
        key={id}
        type="button"
        title={label}
        aria-current={active ? 'page' : undefined}
        onClick={() => navigateTo(id)}
        className={`group flex h-11 w-full items-center justify-start gap-3 rounded-lg px-3 text-sm font-medium transition ${
          active
            ? 'bg-slate-900 text-white shadow-sm'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
        }`}
      >
        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-slate-800'}`} />
        <span className="truncate">{label}</span>
      </button>
    );
  };

  const renderEshopexSidebarPanel = () => (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
          {eshopexUi.loading ? (
            <FiRefreshCw className="h-4 w-4 animate-spin text-sky-600" />
          ) : (
            <FiTruck className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-sm font-semibold text-slate-950">Pendientes Eshopex</h2>
            {eshopexUi.requested && !eshopexUi.loading && !eshopexUi.error && (
              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-slate-900 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                {eshopexUi.count}
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {!eshopexUi.requested
              ? 'Sin buscar'
              : eshopexUi.loading
                ? (eshopexProgressText || 'Buscando...')
                : (eshopexUi.error || `${eshopexUi.count} pendientes`)}
          </p>
        </div>
      </div>

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all ${
            eshopexUi.loading
              ? 'w-full animate-pulse bg-gradient-to-r from-sky-500/15 via-sky-500/60 to-sky-500/15'
              : eshopexUi.error
                ? 'w-full bg-rose-500'
                : eshopexUi.requested
                  ? 'w-full bg-emerald-500'
                  : 'w-1/5 bg-slate-400'
          }`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={triggerEshopexBg}
          disabled={eshopexUi.loading}
          title={eshopexUi.requested ? 'Actualizar pendientes' : 'Buscar pendientes'}
        >
          {eshopexUi.loading ? (
            <FiRefreshCw className="h-4 w-4 animate-spin" />
          ) : eshopexUi.requested ? (
            <FiRefreshCw className="h-4 w-4" />
          ) : (
            <FiSearch className="h-4 w-4" />
          )}
          <span className="truncate">{eshopexUi.requested ? 'Actualizar' : 'Buscar'}</span>
        </button>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-slate-900 px-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          onClick={openEshopexInProductos}
          title="Ver pendientes"
        >
          <FiEye className="h-4 w-4" />
          <span className="truncate">Ver</span>
        </button>
      </div>
    </section>
  );

  const renderCalcuRapidaPanel = () => (
    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
          <FiHash className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-950">Calcu Rapida</h2>
          <p className="mt-1 truncate text-xs text-slate-500">Compras con DEC 90</p>
        </div>
      </div>
      <button
        type="button"
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        onClick={openCalcuRapida}
        title="Abrir calculadora rapida"
      >
        <FiHash className="h-4 w-4" />
        <span>Calcular compra</span>
      </button>
    </section>
  );

  return (
    <>
      <div className="min-h-screen bg-macGray">
        {sidebarHidden && (
          <button
            type="button"
            className="fixed left-3 top-3 z-50 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={() => setSidebarHidden(false)}
            aria-label="Mostrar menu"
            title="Mostrar menu"
          >
            <FiMenu className="h-5 w-5" />
          </button>
        )}

        {!sidebarHidden && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-900/35 lg:hidden"
            onClick={() => setSidebarHidden(true)}
            aria-label="Cerrar menu"
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[calc(100vw-1rem)] flex-col border-r border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur transition-transform duration-200 lg:w-64 ${
            sidebarHidden ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          <div className="mb-5 flex h-12 items-center justify-between gap-3 rounded-lg px-2">
            <div className="flex min-w-0 items-center gap-3">
              <img
                src={APP_LOGO_URL}
                alt="MacServicios"
                className="h-10 w-10 shrink-0 rounded-lg object-contain"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-950">MacSomenos</div>
                <div className="truncate text-xs text-slate-500">Panel rapido</div>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              onClick={() => setSidebarHidden(true)}
              aria-label="Ocultar menu"
              title="Ocultar menu"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
            <div className="flex flex-col gap-1 pb-4">
              {SIDEBAR_NAV.map(renderNavItem)}

              <div className="my-3 h-px shrink-0 bg-slate-200" />
              {renderEshopexSidebarPanel()}
              <div className="mt-3" />
              {renderCalcuRapidaPanel()}

              <div className="my-3 h-px shrink-0 bg-slate-200" />
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                Herramientas
              </div>
              {SIDEBAR_SECONDARY_NAV.map(renderNavItem)}
            </div>
          </nav>
        </aside>

        <main className={`min-h-screen transition-[padding] duration-200 ${sidebarHidden ? 'pl-0' : 'lg:pl-64'}`}>
          {renderVista()}
        </main>
      </div>
      {calcuRapidaOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-6 relative max-h-[92vh] overflow-auto">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Calcu Rapida</h2>
                <p className="text-sm text-gray-500">Compras con DEC fijo en {fmtUsdCalc(CALCU_RAPIDA_DEC_USD)}.</p>
              </div>
              <button
                className="w-9 h-9 flex items-center justify-center text-xl font-bold rounded-full hover:bg-gray-100"
                onClick={() => setCalcuRapidaOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>

            <div className="bg-white/90 rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-lg font-semibold mb-3 text-gray-900">Resultados</h3>
              <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Busqueda de eBay</label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://www.ebay.com/itm/..."
                    value={calcuRapidaEbay.url}
                    onChange={setCalcuRapidaEbayUrl}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') buscarCalcuRapidaEbay();
                    }}
                  />
                  <button
                    type="button"
                    onClick={buscarCalcuRapidaEbay}
                    disabled={calcuRapidaEbay.loading}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      calcuRapidaEbay.loading
                        ? 'bg-slate-300 text-slate-600'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {calcuRapidaEbay.loading ? 'Buscando...' : 'Buscar'}
                  </button>
                </div>
                {calcuRapidaEbay.error && (
                  <div className="mt-2 text-sm text-red-600">{calcuRapidaEbay.error}</div>
                )}
                {(calcuRapidaEbay.title || calcuRapidaEbay.priceUSD != null || calcuRapidaEbay.shippingUSD != null) && (
                  <div className="mt-2 space-y-1 text-xs text-slate-600">
                    {calcuRapidaEbay.title && (
                      <div className="line-clamp-2 rounded-lg bg-white px-2 py-1 text-slate-800">{calcuRapidaEbay.title}</div>
                    )}
                    <div>
                      Precio: <strong>{fmtUsdCalc(calcuRapidaEbay.priceUSD)}</strong>
                      {' '}| Envio: <strong>{fmtUsdCalc(calcuRapidaEbay.shippingUSD)}</strong>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Precio del Producto (USD)</span>
                  <input
                    className="w-full rounded-lg p-2.5 border border-gray-300 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    inputMode="decimal"
                    autoComplete="off"
                    value={calcuRapida.precioUsd}
                    onChange={setCalcuRapidaField('precioUsd')}
                    placeholder="p.ej. 180"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Envio USA (USD)</span>
                  <input
                    className="w-full rounded-lg p-2.5 border border-gray-300 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    inputMode="decimal"
                    autoComplete="off"
                    value={calcuRapida.envioUsaUsd}
                    onChange={setCalcuRapidaField('envioUsaUsd')}
                    placeholder="p.ej. 12"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Precio DEC (USD)</span>
                  <input
                    className="w-full rounded-lg p-2.5 border border-gray-200 bg-gray-50 text-gray-600 shadow-sm"
                    value={String(CALCU_RAPIDA_DEC_USD)}
                    disabled
                    readOnly
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Peso estimado (Kg)</span>
                  <input
                    className="w-full rounded-lg p-2.5 border border-gray-300 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    inputMode="decimal"
                    autoComplete="off"
                    value={calcuRapida.pesoKg}
                    onChange={setCalcuRapidaField('pesoKg')}
                    placeholder="p.ej. 1.8"
                  />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="block text-gray-600 mb-1">TC compras</span>
                  <input
                    className="w-full rounded-lg p-2.5 border border-gray-300 bg-white shadow-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    inputMode="decimal"
                    autoComplete="off"
                    value={calcuRapida.tipoCambio}
                    onChange={setCalcuRapidaField('tipoCambio')}
                    placeholder={CALCU_RAPIDA_TC_DEFAULT}
                  />
                </label>
              </div>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Precio en soles + envio USA</span>
                    <strong className="text-slate-950">{fmtSolesCalc(calcuRapidaResultados.precioSoles)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4">
                    <span className="text-slate-600">Costo de envio</span>
                    <strong className="text-slate-950">{fmtSolesCalc(calcuRapidaResultados.costoEnvio)}</strong>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
                    <span className="font-medium text-slate-800">Costo total</span>
                    <strong className="text-base text-slate-950">{fmtSolesCalc(calcuRapidaResultados.costoTotal)}</strong>
                  </div>
                </div>

                <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-emerald-950">Precio minimo venta +20%</span>
                    <strong className="text-lg text-emerald-950">{fmtSolesCalc(calcuRapidaResultados.precioVentaMin)}</strong>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-4 text-emerald-700">
                    <span>Ganancia</span>
                    <strong>{fmtSolesCalc(calcuRapidaResultados.ganancia)}</strong>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                  <label className="block text-sm">
                    <span className="block text-slate-600 mb-1">Precio</span>
                    <input
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      inputMode="decimal"
                      autoComplete="off"
                      value={calcuRapida.precioVenta}
                      onChange={setCalcuRapidaField('precioVenta')}
                      placeholder="S/ 0.00"
                    />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-slate-500">Ganancia estimada</div>
                      <div className="mt-1 font-semibold text-slate-950">{fmtSolesCalc(calcuRapidaResultados.gananciaManual)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">% ganancia</div>
                      <div className="mt-1 font-semibold text-slate-950">{calcuRapidaResultados.margenManual.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {eshopexModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-6xl rounded-xl shadow-lg p-6 relative max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Pendientes Eshopex</h2>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                  onClick={triggerEshopexBg}
                  disabled={eshopexUi.loading}
                  title="Actualizar pendientes"
                >
                  {eshopexUi.loading ? 'Buscando...' : 'Actualizar'}
                </button>
                <button
                  className="w-9 h-9 flex items-center justify-center text-xl font-bold rounded-full hover:bg-gray-100"
                  onClick={() => setEshopexModalOpen(false)}
                  aria-label="Cerrar"
                >
                  x
                </button>
              </div>
            </div>
            {eshopexUi.loading && (
              <div className="text-sm text-gray-700 mb-2">
                {eshopexProgressText || 'Buscando pendientes...'}
              </div>
            )}
            {eshopexUi.error && (
              <div className="text-sm text-red-600 mb-2">{eshopexUi.error}</div>
            )}
            {!eshopexUi.requested ? (
              <div className="text-sm text-gray-600">
                Aun no se ha buscado. Usa <b>Buscar</b> o <b>Actualizar</b>.
              </div>
            ) : productosGlobal.length === 0 ? (
              <div className="text-sm text-gray-500">Cargando productos para filtrar pendientes...</div>
            ) : !eshopexUi.loading && eshopexModalPendientes.length === 0 ? (
              <div className="text-sm text-gray-500">No hay cargas pendientes.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm max-h-[65vh] overflow-y-auto">
                <table className="min-w-[1100px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-left">Tracking Eshopex</th>
                      <th className="p-2 text-left">Descripcion</th>
                      <th className="p-2 text-left">Peso</th>
                      <th className="p-2 text-left">Valor DEC</th>
                      <th className="p-2 text-left">EstatusEsho</th>
                      <th className="p-2 text-left">Fecha recepcion MIAMI</th>
                      <th className="p-2 text-left">Ver foto</th>
                      <th className="p-2 text-left">Casillero</th>
                      <th className="p-2 text-left">Vincular</th>
                      <th className="p-2 text-left">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eshopexModalPendientes.map((row) => {
                      const code = String(row?.guia || '').trim();
                      const producto = productosByEshopexGlobal[code];
                      const accountKey = String(row?.account || '').trim().toLowerCase();
                      const pagoKey = `${code}-${accountKey}`;
                      const pagoLoading = eshopexPagoLoading.has(pagoKey);
                      const cas = accountKey ? (CASILLERO_BY_ACCOUNT[accountKey] || '-') : '-';
                      return (
                        <tr key={`${code}-${row?.account || ''}`} className="border-t">
                          <td className="p-2">{producto ? (buildNombreProductoGlobal(producto) || producto.tipo) : '-'}</td>
                          <td className="p-2">{code || '-'}</td>
                          <td className="p-2">{row?.descripcion || '-'}</td>
                          <td className="p-2">{row?.peso || '-'}</td>
                          <td className="p-2">{row?.valor || '-'}</td>
                          <td className="p-2">{String(row?.estado || '').trim() || '-'}</td>
                          <td className="p-2">{row?.fechaRecepcion || '-'}</td>
                          <td className="p-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openFotosManualGlobal(row);
                              }}
                              className="bg-indigo-600 text-white hover:bg-indigo-700 px-2 py-1 rounded"
                              title="Ver fotos Eshopex"
                            >
                              Ver foto
                            </button>
                          </td>
                          <td className="p-2">{cas}</td>
                          <td className="p-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openEshopexVincularModalGlobal(row);
                              }}
                              className="bg-blue-600 text-white hover:bg-blue-700 px-2 py-1 rounded"
                            >
                              Vincular
                            </button>
                          </td>
                          <td className="p-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEshopexPrepagoGlobal(row);
                              }}
                              disabled={!accountKey || pagoLoading}
                              className={`${!accountKey || pagoLoading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-2 py-1 rounded`}
                            >
                              {pagoLoading ? 'Procesando...' : 'Pagar'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
      {eshopexVincularOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-6 relative max-h-[92vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Vincular con producto</h2>
              <button
                className="w-9 h-9 flex items-center justify-center text-xl font-bold rounded-full hover:bg-gray-100"
                onClick={() => setEshopexVincularOpen(false)}
                aria-label="Cerrar"
              >
                x
              </button>
            </div>
            {(() => {
              const row = eshopexVincularRow || {};
              const accountKey = String(row?.account || '').trim().toLowerCase();
              const cas = String(CASILLERO_BY_ACCOUNT[accountKey] || '').trim().toLowerCase();
              const candidates = (productosGlobal || []).filter((p) => {
                const t = getLastTrackingGlobal(p);
                if (String(t?.estado || '').toLowerCase() !== 'comprado_en_camino') return false;
                if (!cas) return false;
                return String(t?.casillero || '').trim().toLowerCase() === cas;
              });
              if (!candidates.length) {
                return (
                  <div className="text-sm text-gray-500">
                    No hay productos en camino para ese casillero.
                  </div>
                );
              }
              return (
                <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm max-h-[60vh] overflow-y-auto">
                  <table className="min-w-[700px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2 text-left">Tracking USA</th>
                        <th className="p-2 text-left">Casillero</th>
                        <th className="p-2 text-left">Accion</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.map((p) => {
                        const t = getLastTrackingGlobal(p);
                        const code = String(row?.guia || '').trim();
                        const key = `${code}-vincular-${p.id || 'na'}`;
                        const loading = eshopexVincularLoading.has(key);
                        return (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">{buildNombreProductoGlobal(p) || p.tipo || '-'}</td>
                            <td className="p-2">{t?.trackingUsa || '-'}</td>
                            <td className="p-2">{t?.casillero || '-'}</td>
                            <td className="p-2">
                              <button
                                onClick={() => handleEshopexVincularGlobal(row, p)}
                                disabled={loading}
                                className={`${loading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'} px-2 py-1 rounded`}
                              >
                                {loading ? 'Vinculando...' : 'Vincular'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}
      {fotosManualOpen && (
        <Suspense fallback={null}>
          <ModalFotosManual
            onClose={() => setFotosManualOpen(false)}
            initialTrackingEshop={fotosManualSeed.trackingEshop}
            initialFechaRecepcion={fotosManualSeed.fechaRecepcion}
          />
        </Suspense>
      )}
    </>
  );
}

export default App;
