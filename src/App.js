import React, { useState, useEffect, useMemo } from 'react';
import Home from './pages/Home';
import Productos from './pages/Productos';
import Servicios from './pages/Servicios';
import Calculadora from './pages/Calculadora';
import Ganancias from './pages/Ganancias';
import Analisis from './pages/Analisis';
import GastosIndex from './pages/GastosIndex';
import AnalisisGastos from './pages/AnalisisGastos';
import PresupuestoGastos from './pages/PresupuestoGastos';
import Ebay from './pages/Ebay';
import api from './api';
import {
  FiActivity,
  FiBarChart2,
  FiBox,
  FiBriefcase,
  FiDollarSign,
  FiGrid,
  FiHash,
  FiHome,
  FiMenu,
  FiPieChart,
  FiSettings,
  FiX,
} from 'react-icons/fi';

const ESHOPEX_BG_TRIGGER_KEY = 'eshopex-carga-trigger-ts';
const ESHOPEX_BG_REQUESTED_KEY = 'eshopex-carga-requested';
const ESHOPEX_BG_LOADING_KEY = 'eshopex-carga-bg-loading';
const ESHOPEX_BG_ERROR_KEY = 'eshopex-carga-bg-error';
const ESHOPEX_CARGA_CACHE_KEY = 'eshopex-carga-cache';
const ESHOPEX_BG_OPEN_MODAL_KEY = 'eshopex-carga-open-modal';
const ESHOPEX_BG_COUNT_KEY = 'eshopex-carga-pendientes-count';
const ESHOPEX_BG_CONSUMED_KEY = 'eshopex-carga-trigger-consumed-ts';
const SIDEBAR_HIDDEN_KEY = 'app-sidebar-hidden';
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

const isPendingCargaRow = (row) => {
  const estado = String(row?.estado || '').trim().toUpperCase();
  const guiaRaw = String(row?.guia || '').trim();
  const guiaDigits = guiaRaw.replace(/\D+/g, '');
  if (guiaDigits.length < 6) return false;
  if (estado.includes('PAGADO')) return false;
  if (estado.includes('ENTREGADO')) return false;
  return true;
};

const pendingFromRows = (rows) => (Array.isArray(rows) ? rows.filter(isPendingCargaRow) : []);

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
  const [vista, setVista] = useState(() => localStorage.getItem('vista') || 'home');
  const [analisisBack, setAnalisisBack] = useState('home');
  const [eshopexWidgetHidden, setEshopexWidgetHidden] = useState(false);
  const [eshopexUi, setEshopexUi] = useState(() => ({
    requested: false,
    loading: false,
    error: '',
    count: 0,
  }));
  const [eshopexProgress, setEshopexProgress] = useState(() => ({ ...EMPTY_ESH_PROGRESS }));
  const [eshopexModalOpen, setEshopexModalOpen] = useState(false);
  const [eshopexModalRows, setEshopexModalRows] = useState([]);
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

  // Guardar la vista cada vez que cambie
  useEffect(() => {
    localStorage.setItem('vista', vista);
  }, [vista]);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_HIDDEN_KEY, sidebarHidden ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [sidebarHidden]);

  // Si hay token en localStorage, deja el header Authorization por defecto (axios)
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token && api?.defaults) {
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
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

  const readCachedCargaRows = () => {
    try {
      const raw = localStorage.getItem(ESHOPEX_CARGA_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return Array.isArray(parsed?.rows) ? parsed.rows : [];
    } catch {
      return [];
    }
  };

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
        count = pendingFromRows(cachedRows).length;
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
  }, []);

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
    setEshopexWidgetHidden(false);
  };

  const openEshopexInProductos = () => {
    if (vista === 'productos') {
      try {
        localStorage.setItem(ESHOPEX_BG_OPEN_MODAL_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setEshopexWidgetHidden(false);
      return;
    }
    setEshopexModalRows(readCachedCargaRows());
    setEshopexWidgetHidden(false);
    setEshopexModalOpen(true);
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
          const pendingCount = pendingFromRows(rows).length;
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
    if (!eshopexModalOpen) return;
    const syncRows = () => {
      setEshopexModalRows(readCachedCargaRows());
    };
    const timer = window.setInterval(syncRows, 1000);
    syncRows();
    return () => window.clearInterval(timer);
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
    () => pendingFromRows(eshopexModalRows),
    [eshopexModalRows],
  );

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

  const renderVista = () => (
    <>
      {vista === 'home'        && <Home setVista={setVista} setAnalisisBack={setAnalisisBack} />}
      {vista === 'productos'   && <Productos setVista={setVista} setAnalisisBack={setAnalisisBack} />}
      {vista === 'servicios'   && <Servicios setVista={setVista} />}
      {vista === 'calculadora' && <Calculadora setVista={setVista} />}
      {vista === 'ebay'        && <Ebay setVista={setVista} />}
      {vista === 'ganancias'   && <Ganancias setVista={setVista} />}
      {vista === 'gastos'      && <GastosIndex setVista={setVista} />}
      {vista === 'analisis'    && <Analisis setVista={setVista} analisisBack={analisisBack} />}
      {vista === 'analisisGastos' && <AnalisisGastos setVista={setVista} />}
      {vista === 'presupuestoGastos' && <PresupuestoGastos setVista={setVista} />}
    </>
  );

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
          className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur transition-transform duration-200 lg:w-64 ${
            sidebarHidden ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          <div className="mb-5 flex h-12 items-center justify-between gap-3 rounded-lg px-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white">
                MS
              </div>
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

          <nav className="flex flex-1 flex-col gap-1">
            {SIDEBAR_NAV.map(renderNavItem)}

            <div className="my-3 h-px bg-slate-200" />
            <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Herramientas
            </div>
            {SIDEBAR_SECONDARY_NAV.map(renderNavItem)}
          </nav>
        </aside>

        <main className={`min-h-screen transition-[padding] duration-200 ${sidebarHidden ? 'pl-0' : 'lg:pl-64'}`}>
          {renderVista()}
        </main>
      </div>
      {!eshopexWidgetHidden && (
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-[22rem]">
          <div className="rounded-xl border border-slate-200/80 bg-white/95 p-3 shadow-[0_14px_35px_-18px_rgba(15,23,42,0.45)] backdrop-blur transition-colors hover:border-slate-300 dark:border-slate-700/70 dark:bg-slate-900/90 dark:hover:border-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="mt-1 shrink-0">
                {!eshopexUi.requested ? (
                  <div className="mt-1.5 h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                ) : eshopexUi.loading ? (
                  <div className="h-4 w-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
                ) : (
                  <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${eshopexUi.error ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                      Pendientes Eshopex
                    </div>
                    <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                      {!eshopexUi.requested
                        ? 'Aun no se ha buscado.'
                        : eshopexUi.loading
                          ? (eshopexProgressText || 'Buscando en segundo plano...')
                          : (eshopexUi.error || `Listo: ${eshopexUi.count} pendientes`)}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/70 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    onClick={() => setEshopexWidgetHidden(true)}
                    aria-label="Ocultar"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-700/80">
                  <div
                    className={`h-full transition-all ${
                      eshopexUi.loading
                        ? 'w-full animate-pulse bg-gradient-to-r from-sky-500/15 via-sky-500/55 to-sky-500/15'
                        : eshopexUi.error
                          ? 'w-full bg-rose-500/70'
                          : eshopexUi.requested
                            ? 'w-full bg-emerald-500/70'
                            : 'w-1/6 bg-slate-400/60 dark:bg-slate-500/70'
                    }`}
                  />
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {!eshopexUi.requested && (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-700 shadow-sm transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-sky-700 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-900"
                      onClick={triggerEshopexBg}
                    >
                      Buscar
                    </button>
                  )}

                  {eshopexUi.requested && (
                    <>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-900"
                        onClick={triggerEshopexBg}
                        disabled={eshopexUi.loading}
                      >
                        {eshopexUi.loading && <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />}
                        {eshopexUi.loading ? 'Buscando...' : 'Actualizar'}
                      </button>

                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-sky-500 dark:hover:bg-sky-400 dark:focus-visible:ring-sky-400 dark:focus-visible:ring-offset-slate-900"
                        onClick={openEshopexInProductos}
                        disabled={eshopexUi.loading && eshopexUi.count === 0}
                      >
                        Ver
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {eshopexModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-6 relative max-h-[92vh] overflow-auto">
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
            {eshopexUi.error && (
              <div className="text-sm text-red-600 mb-2">{eshopexUi.error}</div>
            )}
            {!eshopexUi.requested ? (
              <div className="text-sm text-gray-600">
                Aun no se ha buscado. Usa <b>Buscar</b> o <b>Actualizar</b>.
              </div>
            ) : eshopexModalPendientes.length === 0 ? (
              <div className="text-sm text-gray-500">
                {eshopexUi.loading ? (eshopexProgressText || 'Buscando pendientes...') : 'No hay cargas pendientes.'}
              </div>
            ) : (
              <>
                {eshopexUi.loading && (
                  <div className="text-xs text-gray-600 mb-2">
                    {eshopexProgressText || 'Buscando pendientes...'}
                  </div>
                )}
                <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm max-h-[65vh] overflow-y-auto">
                  <table className="min-w-[920px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Tracking Eshopex</th>
                        <th className="p-2 text-left">Descripcion</th>
                        <th className="p-2 text-left">Peso</th>
                        <th className="p-2 text-left">Valor DEC</th>
                        <th className="p-2 text-left">Estado</th>
                        <th className="p-2 text-left">Fecha recepcion MIAMI</th>
                        <th className="p-2 text-left">Cuenta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eshopexModalPendientes.map((row) => {
                        const code = String(row?.guia || '').trim();
                        const estado = String(row?.estado || '').trim() || '-';
                        return (
                          <tr key={`${code}-${String(row?.account || '')}`} className="border-t">
                            <td className="p-2">
                              {code ? (
                                <a
                                  href={`https://usamybox.com/internacional/tracking_box.php?nrotrack=${encodeURIComponent(code)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 underline"
                                >
                                  {code}
                                </a>
                              ) : '-'}
                            </td>
                            <td className="p-2">{row?.descripcion || '-'}</td>
                            <td className="p-2">{row?.peso || '-'}</td>
                            <td className="p-2">{row?.valor || '-'}</td>
                            <td className="p-2">{estado}</td>
                            <td className="p-2">{row?.fechaRecepcion || '-'}</td>
                            <td className="p-2">{row?.account || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
