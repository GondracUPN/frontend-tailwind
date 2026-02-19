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
import api from './api';

const ESHOPEX_BG_TRIGGER_KEY = 'eshopex-carga-trigger-ts';
const ESHOPEX_BG_REQUESTED_KEY = 'eshopex-carga-requested';
const ESHOPEX_BG_LOADING_KEY = 'eshopex-carga-bg-loading';
const ESHOPEX_BG_ERROR_KEY = 'eshopex-carga-bg-error';
const ESHOPEX_CARGA_CACHE_KEY = 'eshopex-carga-cache';
const ESHOPEX_BG_OPEN_MODAL_KEY = 'eshopex-carga-open-modal';
const ESHOPEX_BG_COUNT_KEY = 'eshopex-carga-pendientes-count';
const ESHOPEX_BG_CONSUMED_KEY = 'eshopex-carga-trigger-consumed-ts';

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
  const [eshopexModalOpen, setEshopexModalOpen] = useState(false);
  const [eshopexModalRows, setEshopexModalRows] = useState([]);

  // Guardar la vista cada vez que cambie
  useEffect(() => {
    localStorage.setItem('vista', vista);
  }, [vista]);

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

  const eshopexModalPendientes = useMemo(
    () => pendingFromRows(eshopexModalRows),
    [eshopexModalRows],
  );

  return (
    <>
      {vista === 'home'        && <Home setVista={setVista} setAnalisisBack={setAnalisisBack} />}
      {vista === 'productos'   && <Productos setVista={setVista} setAnalisisBack={setAnalisisBack} />} 
      {vista === 'servicios'   && <Servicios setVista={setVista} />}
      {vista === 'calculadora' && <Calculadora setVista={setVista} />}
      {vista === 'ganancias'   && <Ganancias setVista={setVista} />}
      {vista === 'gastos'      && <GastosIndex setVista={setVista} />}
      {vista === 'analisis'    && <Analisis setVista={setVista} analisisBack={analisisBack} />}
      {vista === 'analisisGastos' && <AnalisisGastos setVista={setVista} />}
      {vista === 'presupuestoGastos' && <PresupuestoGastos setVista={setVista} />}
      {!eshopexWidgetHidden && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-white border border-gray-200 shadow-lg rounded-xl px-4 py-3 flex items-start gap-3">
            <div className="mt-1">
              {!eshopexUi.requested ? (
                <div className="h-2 w-2 rounded-full mt-1.5 bg-gray-300" />
              ) : eshopexUi.loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
              ) : (
                <div className={`h-2 w-2 rounded-full mt-1.5 ${eshopexUi.error ? 'bg-red-500' : 'bg-emerald-500'}`} />
              )}
            </div>
            <div className="text-sm">
              <div className="font-semibold text-gray-900">Pendientes Eshopex</div>
              <div className="text-gray-600">
                {!eshopexUi.requested
                  ? 'Aun no se ha buscado.'
                  : eshopexUi.loading
                    ? 'Buscando en segundo plano...'
                    : (eshopexUi.error || `Listo: ${eshopexUi.count} pendientes`)}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {!eshopexUi.requested && (
                <button
                  type="button"
                  className="px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={triggerEshopexBg}
                >
                  Buscar
                </button>
              )}
              {eshopexUi.requested && (
                <>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    onClick={triggerEshopexBg}
                    disabled={eshopexUi.loading}
                  >
                    {eshopexUi.loading ? 'Buscando...' : 'Actualizar'}
                  </button>
                  <button
                    type="button"
                    className="px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                    onClick={openEshopexInProductos}
                    disabled={eshopexUi.loading && eshopexUi.count === 0}
                  >
                    Ver
                  </button>
                </>
              )}
              <button
                type="button"
                className="w-7 h-7 flex items-center justify-center text-sm font-bold rounded-full hover:bg-gray-100"
                onClick={() => setEshopexWidgetHidden(true)}
                aria-label="Ocultar"
              >
                x
              </button>
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
                {eshopexUi.loading ? 'Buscando pendientes...' : 'No hay cargas pendientes.'}
              </div>
            ) : (
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
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default App;
