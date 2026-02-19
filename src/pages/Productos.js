// src/pages/Productos.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import ModalProducto from '../components/ModalProducto';
import DetallesProductoModal from '../components/DetallesProductoModal';
import ModalCostos from '../components/ModalCostos';
import ModalTracking from '../components/ModalTracking';
import api from '../api';  // cliente fetch centralizado
import ResumenCasilleros from '../components/ResumenCasilleros';
import ModalCasillero from '../components/ModalCasillero';
import ModalVenta from '../components/ModalVenta';
import ModalFotos from '../components/ModalFotos';
import ModalFotosManual from '../components/ModalFotosManual';
import ModalMarcaAgua from '../components/ModalMarcaAgua';
import ModalCalculadora from '../components/ModalCalculadora';
import ModalDec from '../components/ModalDec';
import ModalAdelantarTipo from '../components/ModalAdelantarTipo';
import ModalAdelantoCreate from '../components/ModalAdelantoCreate';
import ModalAdelantoDetalle from '../components/ModalAdelantoDetalle';
import ModalAdelantoCompletar from '../components/ModalAdelantoCompletar';
import ModalVentaMensaje from '../components/ModalVentaMensaje';
import { FiFileText } from 'react-icons/fi';


const CACHE_KEY = 'productos:cache:v2';
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos para revalidar
const ESHOPEX_BG_TRIGGER_KEY = 'eshopex-carga-trigger-ts';
const ESHOPEX_BG_REQUESTED_KEY = 'eshopex-carga-requested';
const ESHOPEX_BG_OPEN_MODAL_KEY = 'eshopex-carga-open-modal';
const ESHOPEX_BG_COUNT_KEY = 'eshopex-carga-pendientes-count';

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed?.ts) return null;
  if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
  return {
    productos: Array.isArray(parsed.productos) ? parsed.productos : [],
    ventasMap: parsed.ventasMap && typeof parsed.ventasMap === 'object' ? parsed.ventasMap : {},
    adelantosMap: parsed.adelantosMap && typeof parsed.adelantosMap === 'object' ? parsed.adelantosMap : {},
    resumen: parsed.resumen || null,
    ts: parsed.ts,
  };
  } catch {
    return null;
  }
};

const writeCache = (productos, ventasMap, resumen, adelantosMap) => {
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        productos,
        ventasMap,
        adelantosMap,
        resumen,
        ts: Date.now(),
      }),
    );
  } catch {
    /* ignore cache errors */
  }
};

export default function Productos({ setVista, setAnalisisBack }) {
  const cached = readCache();
  const [productos, setProductos] = useState(() => cached?.productos || []);
  const [resumen, setResumen] = useState(() => cached?.resumen || null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [modalModo, setModalModo] = useState(null); // 'crear'|'detalle'|'costos'|'track'|'fotosManual'|'marca'
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  // Mapa: productoId -> fltima venta (o null)
  const [ventasMap, setVentasMap] = useState(() => cached?.ventasMap || {});
  const [adelantosMap, setAdelantosMap] = useState(() => cached?.adelantosMap || {});
  const ventasRef = useRef(ventasMap);
  useEffect(() => { ventasRef.current = ventasMap; }, [ventasMap]);
  const adelantosRef = useRef(adelantosMap);
  useEffect(() => { adelantosRef.current = adelantosMap; }, [adelantosMap]);
  const productosRef = useRef(productos);
  useEffect(() => { productosRef.current = productos; }, [productos]);
  const resumenRef = useRef(resumen);
  useEffect(() => { resumenRef.current = resumen; }, [resumen]);
  const didInitRef = useRef(false);

  useEffect(() => {
    writeCache(productos, ventasMap, resumen, adelantosMap);
  }, [productos, ventasMap, resumen, adelantosMap]);

  // Abre modal de venta (creacifn o lectura)
  const abrirVenta = (p) => { setProductoSeleccionado(p); setModalModo('venta'); };
  const abrirCalculadora = (p) => { setProductoSeleccionado(p); setModalModo('calc'); };

  const abrirFotos = (p) => {
    // Log de depuracifn al abrir el modal de fotos
    const fecha = p?.valor?.fechaCompra || '';
    const trackingEshop = (p?.tracking || []).map(t => t?.trackingEshop).find(v => v && String(v).trim()) || '';
    console.log('[Productos] Ver foto ->', { id: p?.id, fechaCompra: fecha, trackingEshop });
    setProductoSeleccionado(p);
    setModalModo('fotos');
  };
  const abrirMarcaAgua = () => { setModalModo('marca'); };
  // Cuando se guarda una venta, refrescamos sflo ese producto en el mapa
  const handleVentaSaved = (ventaGuardada) => {
    setVentasMap(prev => {
      const next = { ...prev, [ventaGuardada.productoId]: ventaGuardada };
      writeCache(productos, next, resumenRef.current, adelantosRef.current);
      return next;
    });
    setAdelantosMap(prev => {
      if (!ventaGuardada?.productoId) return prev;
      const next = { ...prev, [ventaGuardada.productoId]: null };
      writeCache(productosRef.current, ventasRef.current, resumenRef.current, next);
      return next;
    });
    fetchResumen({ refresh: true });
    cerrarModal();
  };

  const handleAdelantoSaved = (adelanto) => {
    if (!adelanto?.productoId) return;
    setAdelantosMap(prev => {
      const next = { ...prev, [adelanto.productoId]: adelanto };
      writeCache(productosRef.current, ventasRef.current, resumenRef.current, next);
      return next;
    });
    cerrarAdelanto();
  };

  const handleAdelantoCompleto = (ventaGuardada, productoId) => {
    if (ventaGuardada?.productoId == null && productoId == null) return;
    const pid = ventaGuardada?.productoId ?? productoId;
    setVentasMap(prev => {
      const next = { ...prev, [pid]: ventaGuardada || prev[pid] || null };
      writeCache(productosRef.current, next, resumenRef.current, adelantosRef.current);
      return next;
    });
    setAdelantosMap(prev => {
      const next = { ...prev, [pid]: null };
      writeCache(productosRef.current, ventasRef.current, resumenRef.current, next);
      return next;
    });
    fetchResumen({ refresh: true });
    cerrarAdelanto();
  };

  const fmtSoles = (v) => (v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '-');

  // === Seleccifn (Importar recojo / Recojo masivo) ===
  const [selectMode, setSelectMode] = useState(false);
  const [selectAction, setSelectAction] = useState(null); // 'whatsapp' | 'pickup' | 'adelantar'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pickupDate, setPickupDate] = useState(''); // YYYY-MM-DD
  const [recojoOpen, setRecojoOpen] = useState(false);
  const [recojoSelected, setRecojoSelected] = useState(new Set());
  const [recojoDate, setRecojoDate] = useState('');
  const [recojoStatusMap, setRecojoStatusMap] = useState({});
  const recojoStatusRef = useRef({});
  useEffect(() => {
    recojoStatusRef.current = recojoStatusMap;
  }, [recojoStatusMap]);
  const [eshopexCargaOpen, setEshopexCargaOpen] = useState(false);
  const [eshopexCargaRequested, setEshopexCargaRequested] = useState(() => {
    try {
      const requested = localStorage.getItem(ESHOPEX_BG_REQUESTED_KEY) === '1';
      const hasCache = !!localStorage.getItem('eshopex-carga-cache');
      return requested || hasCache;
    } catch {
      return false;
    }
  });
  const [eshopexCargaRows, setEshopexCargaRows] = useState([]);
  const [eshopexCargaLoading, setEshopexCargaLoading] = useState(false);
  const [eshopexCargaError, setEshopexCargaError] = useState(null);
  const [eshopexCargaRefreshKey, setEshopexCargaRefreshKey] = useState(0);
  const [eshopexPagoLoading, setEshopexPagoLoading] = useState(() => new Set());
  const [eshopexVincularLoading, setEshopexVincularLoading] = useState(() => new Set());
  const [eshopexVincularOpen, setEshopexVincularOpen] = useState(false);
  const [eshopexVincularRow, setEshopexVincularRow] = useState(null);
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  const [soloVendidos, setSoloVendidos] = useState(false);
  const [soloAdelanto, setSoloAdelanto] = useState(false);
  const [ventaMsgOpen, setVentaMsgOpen] = useState(false);
  const [selectedCasillero, setSelectedCasillero] = useState(null);
  const [productoEnCasillero, setProductoEnCasillero] = useState(null);
  const [fotosManualSeed, setFotosManualSeed] = useState({ trackingEshop: '', fechaRecepcion: '' });
  const [savingProductos, setSavingProductos] = useState(() => new Set());
  const [adelantoModo, setAdelantoModo] = useState(null); // 'select' | 'create' | 'detail' | 'complete'
  const [adelantoProducto, setAdelantoProducto] = useState(null);
  const [adelantoActivo, setAdelantoActivo] = useState(null);
  // Filtros adicionales
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'macbook' | 'ipad' | 'iphone' | 'pantalla' | 'otro'
  const [filtroProc, setFiltroProc] = useState('todos'); // procesador o pantalla (texto libre)
  const [filtroTam, setFiltroTam] = useState('todos');   // tamano adicional para macbook/ipad
  const [trackingQuery, setTrackingQuery] = useState('');
  const [filtroGama, setFiltroGama] = useState('todos'); // gama (Pro, Air, etc)

  const keyTamano = 'tama\u00f1o';
  // Helper: lee tamano desde detalle (normaliza a 'tamano' ASCII) y ajusta a enteros para macbooks
  const getTam = (d) => {
    if (!d) return '';
    const raw = (d.tamano ?? d.tamanio ?? d[keyTamano] ?? d['tamao'] ?? '').toString().trim();
    if (!raw) return '';
    // Normaliza tamanos decimales de MacBook (13.6 -> 13, 15.3 -> 15)
    const n = Number(raw.replace(',', '.'));
    if (!Number.isNaN(n)) {
      if (n >= 15 && n < 15.6) return '15';
      if (n >= 13 && n < 13.7) return '13';
    }
    return raw;
  };

  // Tipos disponibles calculados desde la data
  const tiposDisponibles = React.useMemo(() => {
    const set = new Set();
    for (const p of productos || []) {
      const t = String(p.tipo || '').toLowerCase();
      if (t) set.add(t);
    }
    return Array.from(set);
  }, [productos]);

  // Opciones disponibles de procesador (macbook/ipad) o tamano (pantalla)
  const opcionesProc = React.useMemo(() => {
    const tipo = String(filtroTipo || '').toLowerCase();
    const gamaSel = String(filtroGama || '').toLowerCase();
    const tamSel = String(filtroTam || '').toLowerCase();
    const set = new Set();
    if (tipo === 'macbook' || tipo === 'ipad') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
        const gama = String(p.detalle?.gama || p.gama || '').toLowerCase();
        if (gamaSel !== 'todos' && gama !== gamaSel) continue;
        const tam = String(getTam(p.detalle || {})).toLowerCase();
        if (tamSel !== 'todos' && tam !== tamSel) continue;
        const val = String(p.detalle?.procesador || '').trim();
        if (val) set.add(val);
      }
    } else if (tipo === 'pantalla') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
        const val = getTam(p.detalle || {});
        if (val) set.add(val);
      }
    }
    return Array.from(set);
  }, [productos, filtroTipo, filtroGama, filtroTam]);

  // Opciones de tamano para macbook/ipad
  const opcionesTam = React.useMemo(() => {
    const tipo = String(filtroTipo || '').toLowerCase();
    const proc = String(filtroProc || '').toLowerCase();
    const gamaSel = String(filtroGama || '').toLowerCase();
    const set = new Set();
    if (tipo === 'macbook' || tipo === 'ipad') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
        const procP = String(p.detalle?.procesador || '').toLowerCase();
        if (proc !== 'todos' && procP !== proc) continue;
        const gama = String(p.detalle?.gama || p.gama || '').toLowerCase();
        if (gamaSel !== 'todos' && gama !== gamaSel) continue;
        const val = getTam(p.detalle || {});
        if (val) set.add(val);
      }
    }
    return Array.from(set);
  }, [productos, filtroTipo, filtroProc, filtroGama]);

  // Opciones de gama (por tipo)
  const opcionesGama = React.useMemo(() => {
    const tipo = String(filtroTipo || '').toLowerCase();
    const set = new Set();
    if (tipo !== 'todos') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
        const val = tipo === 'iphone'
          ? String(p.detalle?.modelo || '').trim()
          : String(p.detalle?.gama || p.gama || '').trim();
        if (val) set.add(val);
      }
    }
    return Array.from(set);
  }, [productos, filtroTipo]);

  // Si el tipo seleccionado ya no existe, resetea a 'todos'
  React.useEffect(() => {
    if (filtroTipo !== 'todos' && !tiposDisponibles.includes(filtroTipo)) {
      setFiltroTipo('todos');
      setFiltroProc('todos');
      setFiltroGama('todos');
      setFiltroTam('todos');
    }
  }, [tiposDisponibles, filtroTipo]);

  // Reemplaza ambos startImport() / startMassPickup() por:
  const startRecojo = () => {
    setRecojoOpen(true);
    setRecojoSelected(new Set());
    setRecojoDate('');
  };
  const triggerEshopexCarga = () => {
    setEshopexCargaRequested(true);
    setEshopexCargaLoading(true);
    setEshopexCargaError(null);
    setEshopexCargaRefreshKey((v) => v + 1);
    try {
      localStorage.setItem(ESHOPEX_BG_REQUESTED_KEY, '1');
      localStorage.setItem(ESHOPEX_BG_TRIGGER_KEY, String(Date.now()));
      localStorage.setItem('eshopex-carga-bg-loading', '1');
    } catch {
      /* ignore */
    }
  };


  const startAdelantarVenta = () => {
    setSelectMode(true);
    setSelectAction('adelantar');
    setSelectedIds(new Set());
    setPickupDate('');
  };

  const cancelSelect = () => {
    setSelectMode(false);
    setSelectAction(null);
    setSelectedIds(new Set());
    setPickupDate('');
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const fetchResumen = useCallback(async ({ refresh = false } = {}) => {
    try {
      const data = await api.get(`/productos/resumen${refresh ? '?refresh=true' : ''}`);
      if (data) {
        setResumen(data);
        writeCache(productosRef.current, ventasRef.current, data, adelantosRef.current);
      }
    } catch (e) {
      console.error('No se pudo cargar resumen de productos', e);
    }
  }, []);

  // Nombre del producto para el texto (iPad, Air, M2, 11) o "Otros" con descripcion
  const buildNombreProducto = (p) => {
    if (!p) return '';
    if (p.tipo === 'otro') return (p.detalle?.descripcionOtro || '').trim() || 'Otros';
    if (String(p.tipo || '').toLowerCase() === 'iphone') {
      const numero = String(p.detalle?.numero || '').trim();
      const modelo = String(p.detalle?.modelo || '').trim();
      return ['iPhone', numero, modelo].filter(Boolean).join(' ');
    }
    const parts = [
      p.tipo,
      p.detalle?.gama,
      p.detalle?.procesador,
        (p.detalle || {})['tamano'] || (p.detalle || {})[keyTamano] || (p.detalle || {})['tamanio']
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Accion ACEPTAR (flujo unico: marcar recogidos + WhatsApp)
  const normalizeEstado = (estado) => String(estado || '').toLowerCase().trim();
  const labelFromEstado = (estado) => {
    switch (normalizeEstado(estado)) {
      case 'comprado_sin_tracking': return 'Sin Tracking';
      case 'comprado_en_camino': return 'En Camino';
      case 'en_eshopex': return 'Eshopex';
      case 'recogido': return 'Recogido';
      default: return '-';
    }
  };

const confirmAction = async () => {
    const items = productos.filter(p => selectedIds.has(p.id));
    if (items.length === 0) { alert('Selecciona al menos un producto.'); return; }

    if (selectAction === 'adelantar') {
      const itemsSel = productos.filter(p => selectedIds.has(p.id));
      if (itemsSel.length !== 1) { alert('Selecciona exactamente un producto.'); return; }
      const p = itemsSel[0];
      setProductoSeleccionado(p);
      abrirAdelantoSelect(p);
      cancelSelect();
      return;
    }
  };

  const getLastTracking = useCallback((p) => {
    const trk = Array.isArray(p?.tracking) ? [...p.tracking] : [];
    if (!trk.length) return null;
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.id || 0) - (a.id || 0);
    });
    return trk[0] || null;
  }, []);

  const productosVentaMensaje = React.useMemo(() => {
    return (productos || [])
      .filter((p) => {
        const t = getLastTracking(p);
        const venta = ventasMap[p?.id] || null;
        const adelanto = adelantosMap[p?.id] || null;
        return String(t?.estado || '').toLowerCase() === 'recogido' && !venta && !adelanto;
      })
      .map((p) => ({
        id: p.id,
        label: buildNombreProducto(p) || String(p.tipo || 'Producto'),
      }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [productos, ventasMap, adelantosMap, getLastTracking]);

  const recojoList = React.useMemo(() => {
    return (productos || []).filter((p) => {
      const t = getLastTracking(p);
      const estado = String(t?.estado || '').toLowerCase();
      return estado === 'en_eshopex';
    }).sort((a, b) => {
      const fa = getLastTracking(a)?.fechaRecepcion || '';
      const fb = getLastTracking(b)?.fechaRecepcion || '';
      const ta = fa ? Date.parse(fa) : 0;
      const tb = fb ? Date.parse(fb) : 0;
      if (ta && tb) return ta - tb;
      return ta - tb;
    });
  }, [productos, getLastTracking]);

  const getEshopexCode = useCallback((p) => (getLastTracking(p)?.trackingEshop || '').trim(), [getLastTracking]);
  const getUsaCode = useCallback((p) => (getLastTracking(p)?.trackingUsa || '').trim(), [getLastTracking]);
  const productosByEshopex = React.useMemo(() => {
    const map = {};
    for (const p of productos || []) {
      const code = getEshopexCode(p);
      if (code) map[code] = p;
    }
    return map;
  }, [productos, getEshopexCode]);
  const trackingUsaEnEshopex = React.useMemo(() => {
    const set = new Set();
    for (const p of productos || []) {
      const t = getLastTracking(p);
      if (String(t?.estado || '').toLowerCase() !== 'en_eshopex') continue;
      const code = getUsaCode(p);
      const digits = code.replace(/\D+/g, '');
      if (digits) set.add(digits);
    }
    return set;
  }, [productos, getLastTracking, getUsaCode]);
  const casillerosEnCamino = React.useMemo(() => {
    const set = new Set();
    for (const p of productos || []) {
      const t = getLastTracking(p);
      if (String(t?.estado || '').toLowerCase() !== 'comprado_en_camino') continue;
      const cas = String(t?.casillero || '').trim().toLowerCase();
      if (cas) set.add(cas);
    }
    return set;
  }, [productos, getLastTracking]);
  const normalizeEshopexStatus = (status) => {
    const s = String(status || '').toUpperCase();
    if (s.includes('CONFIRMACION DE EMBARQUE CONSOLIDADO')) return { key: 'confirmacion', label: 'Confirmacion consolidado' };
    if (s.includes('EN RUTA')) return { key: 'en_ruta', label: 'En ruta' };
    if (s.includes('ENTREGADO A CLIENTE FINAL')) return { key: 'entregado', label: 'Entregado' };
    if (!s) return { key: 'none', label: 'No hay informacion' };
    return { key: 'otro', label: s };
  };
  const readEshopexCache = useCallback(() => {
    try {
      const raw = localStorage.getItem('eshopex-status-cache');
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }, []);
  const writeEshopexCache = useCallback((next) => {
    try {
      localStorage.setItem('eshopex-status-cache', JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);
  const eshopexCargaByGuia = React.useMemo(() => {
    const map = {};
    for (const row of eshopexCargaRows || []) {
      const guia = String(row?.guia || '').trim();
      if (guia) map[guia] = row;
    }
    return map;
  }, [eshopexCargaRows]);
  const normalizeCargaStatus = (status) => String(status || '').trim();
  const isEnSucursal = (status) => /EN\s*SUCURSAL/i.test(String(status || ''));
  const isEntregado = (status) => /ENTREGADO/i.test(String(status || ''));
  const isPagado = (status) => /PAGADO/i.test(String(status || ''));
  const isRecojoReady = (p) => {
    const code = getEshopexCode(p);
    if (!code) return false;
    const row = eshopexCargaByGuia[code];
    const status = row?.estado || getLastTracking(p)?.estatusEsho || '';
    return isEnSucursal(status) || isPagado(status) || isEntregado(status);
  };

  const ESHOPEX_CARGA_CACHE_KEY = 'eshopex-carga-cache';
  const ESHOPEX_CARGA_CACHE_TTL_MS = 5 * 60 * 1000;
  const readEshopexCargaCache = useCallback(() => {
    try {
      const raw = localStorage.getItem(ESHOPEX_CARGA_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts || !Array.isArray(parsed.rows)) return null;
      if (Date.now() - parsed.ts > ESHOPEX_CARGA_CACHE_TTL_MS) return null;
      return parsed.rows;
    } catch {
      return null;
    }
  }, [ESHOPEX_CARGA_CACHE_KEY, ESHOPEX_CARGA_CACHE_TTL_MS]);
  const writeEshopexCargaCache = useCallback((rows) => {
    try {
      localStorage.setItem(
        ESHOPEX_CARGA_CACHE_KEY,
        JSON.stringify({ ts: Date.now(), rows }),
      );
    } catch {
      /* ignore */
    }
  }, [ESHOPEX_CARGA_CACHE_KEY]);

  // Reutiliza eshopex-carga para estatus/pagos y evita consultas externas.

  useEffect(() => {
    if (!eshopexCargaRequested && !recojoOpen) return;
    const cachedRows = readEshopexCargaCache();
    if (cachedRows && cachedRows.length) {
      setEshopexCargaRows(cachedRows);
      setEshopexCargaLoading(false);
      setEshopexCargaError(null);
    }
    if (cachedRows && cachedRows.length && eshopexCargaRefreshKey === 0) {
      return () => {};
    }
    let alive = true;
    setEshopexCargaLoading(true);
    setEshopexCargaError(null);
    (async () => {
      try {
        const data = await api.get('/tracking/eshopex-carga');
        if (!alive) return;
        const rows = Array.isArray(data) ? data : (data?.data || []);
        setEshopexCargaRows(rows);
        writeEshopexCargaCache(rows);
      } catch (e) {
        if (!alive) return;
        setEshopexCargaError('No se pudo cargar la informacion de Eshopex.');
      } finally {
        if (alive) setEshopexCargaLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [eshopexCargaRequested, recojoOpen, eshopexCargaRefreshKey, readEshopexCargaCache, writeEshopexCargaCache]);

  const casilleroByAccount = React.useMemo(() => ({
    'gongarc2001@gmail.com': 'Walter',
    'renato1carbajal@gmail.com': 'Renato',
    'limonimofelip@gmail.com': 'Christian',
    'dracgonic12@gmail.com': 'Alex',
    'renato1carbajal@outlook.com': 'MamaRen',
    'goneba2526@gmail.com': 'Jorge',
    'gondrac10@gmail.com': 'Kenny',
  }), []);
  const accountByCasillero = React.useMemo(() => {
    const map = {};
    Object.entries(casilleroByAccount).forEach(([account, cas]) => {
      const key = String(cas || '').trim().toLowerCase();
      if (key) map[key] = account;
    });
    return map;
  }, [casilleroByAccount]);

  useEffect(() => {
    if (!recojoOpen) return;
    const cached = readEshopexCache();
    if (cached && typeof cached === 'object') {
      setRecojoStatusMap((prev) => {
        const merged = { ...cached, ...prev };
        recojoStatusRef.current = merged;
        return merged;
      });
    }
    const codes = recojoList
      .map((p) => (getLastTracking(p)?.trackingEshop || '').trim())
      .filter(Boolean);
    if (!codes.length) return;
    const currentMap = recojoStatusRef.current || {};
    const missing = codes.filter((c) => {
      const entry = currentMap[c];
      return !entry || entry.loading;
    });
    if (!missing.length) return;
    let alive = true;
    (async () => {
      setRecojoStatusMap((prev) => {
        const next = { ...prev };
        missing.forEach((code) => { next[code] = { loading: true }; });
        recojoStatusRef.current = next;
        return next;
      });
      const entries = await Promise.all(
        missing.map(async (code) => {
          try {
            const data = await api.get(`/tracking/eshopex-status/${encodeURIComponent(code)}`);
            return [code, { ...data, loading: false }];
          } catch {
            return [code, { status: null, date: null, time: null, loading: false }];
          }
        }),
      );
      if (!alive) return;
      setRecojoStatusMap((prev) => {
        const next = { ...prev };
        entries.forEach(([code, data]) => { next[code] = data; });
        writeEshopexCache(next);
        recojoStatusRef.current = next;
        return next;
      });
    })();
    return () => { alive = false; };
  }, [recojoOpen, recojoList, readEshopexCache, writeEshopexCache, getLastTracking]);

  const eshopexPendientes = React.useMemo(() => {
    const filtered = (eshopexCargaRows || []).filter((row) => {
      const estado = String(row?.estado || '').trim().toUpperCase();
      const guiaRaw = String(row?.guia || '').trim();
      const guiaDigits = guiaRaw.replace(/\D+/g, '');
      if (guiaDigits.length < 6) return false;
      if (productosByEshopex[guiaRaw]) return false;
      if (guiaDigits && trackingUsaEnEshopex.has(guiaDigits)) return false;
      if (estado.includes('PAGADO')) return false;
      return estado !== 'ENTREGADO';
    });
    return filtered
      .map((row, idx) => ({ row, idx }))
      .sort((a, b) => {
        const accountA = String(a.row?.account || '').trim().toLowerCase();
        const accountB = String(b.row?.account || '').trim().toLowerCase();
        const casA = String(casilleroByAccount[accountA] || '').trim().toLowerCase();
        const casB = String(casilleroByAccount[accountB] || '').trim().toLowerCase();
        const priA = casA && casillerosEnCamino.has(casA) ? 0 : 1;
        const priB = casB && casillerosEnCamino.has(casB) ? 0 : 1;
        if (priA !== priB) return priA - priB;
        return a.idx - b.idx;
      })
      .map((item) => item.row);
  }, [eshopexCargaRows, productosByEshopex, trackingUsaEnEshopex, casilleroByAccount, casillerosEnCamino]);
  const eshopexPendientesCount = eshopexPendientes.length;
  useEffect(() => {
    try {
      localStorage.setItem(ESHOPEX_BG_COUNT_KEY, String(eshopexPendientesCount));
    } catch {
      /* ignore */
    }
  }, [eshopexPendientesCount]);

  const eshopexOpenSignalSeenRef = useRef(0);
  useEffect(() => {
    const checkOpenSignal = () => {
      try {
        const signal = Number(localStorage.getItem(ESHOPEX_BG_OPEN_MODAL_KEY) || 0);
        if (!Number.isFinite(signal) || signal <= 0) return;
        if (signal <= eshopexOpenSignalSeenRef.current) return;
        eshopexOpenSignalSeenRef.current = signal;
        setEshopexCargaOpen(true);
        setEshopexCargaRequested(true);
        localStorage.removeItem(ESHOPEX_BG_OPEN_MODAL_KEY);
      } catch {
        /* ignore */
      }
    };
    const timer = window.setInterval(checkOpenSignal, 500);
    checkOpenSignal();
    return () => window.clearInterval(timer);
  }, []);

  const toggleRecojoSelect = (id) => {
    setRecojoSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRecojoWhatsapp = async () => {
    const items = recojoList.filter((p) => recojoSelected.has(p.id) && isRecojoReady(p));
    if (!items.length) { alert('Selecciona al menos un producto.'); return; }
    if (!recojoDate) { alert('Elige una fecha de recojo.'); return; }
    try {
      const results = await Promise.allSettled(items.map(async (p) => {
        const res = await api.put(`/tracking/producto/${p.id}`, {
          estado: 'recogido',
          fechaRecogido: recojoDate,
        });
        return { productoId: p.id, tracking: res?.data ?? res };
      }));
      const updated = results
        .filter((r) => r.status === 'fulfilled')
        .map((r) => r.value);
      updated.forEach(({ productoId, tracking }) => {
        applyTrackingUpdate(productoId, tracking);
      });

      const lineas = items.map(p => {
        const t = getLastTracking(p) || {};
        const esh = (t.trackingEshop || '').trim();
        const cas = t.casillero || '';
        const nombre = buildNombreProducto(p);
        return `${esh} | ${nombre} | Casillero: ${cas}`;
      });

      const url = `https://wa.me/+51938597478?text=${encodeURIComponent(lineas.join('\n'))}`;
      refreshProductos({ force: true, useCache: false, silent: true });
      window.open(url, '_blank', 'noopener,noreferrer');
      setRecojoOpen(false);
      setRecojoSelected(new Set());
      setRecojoDate('');
      if (updated.length !== items.length) {
        alert('Algunos productos no se pudieron marcar como recogidos.');
      }
    } catch (e) {
      console.error(e);
      alert('No se pudo completar el recojo de algunos productos.');
    }
  };

  const handleRecojoTrackingLinks = () => {
    const items = recojoList.filter((p) => recojoSelected.has(p.id));
    if (!items.length) { alert('Selecciona al menos un producto.'); return; }
    items.forEach((p) => {
      const t = getLastTracking(p);
      const esh = (t?.trackingEshop || '').trim();
      if (!esh) return;
      const href = URLS.eshopex(esh);
      window.open(href, '_blank', 'noopener,noreferrer');
    });
  };

  const markPagoLoading = (key, on) => {
    setEshopexPagoLoading((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const markVincularLoading = (key, on) => {
    setEshopexVincularLoading((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const openEshopexVincularModal = (row) => {
    setEshopexVincularRow(row || null);
    setEshopexVincularOpen(true);
  };

  const parseEshopexFecha = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^null$/i.test(raw)) return '';
    const monthMap = {
      jan: '01',
      feb: '02',
      mar: '03',
      apr: '04',
      may: '05',
      jun: '06',
      jul: '07',
      aug: '08',
      sep: '09',
      oct: '10',
      nov: '11',
      dec: '12',
    };
    const monMatch = raw.match(/([A-Za-z]{3,})\s*[-/ ]?\s*(\d{1,2})\s*[-/ ]?\s*(\d{4})/);
    if (monMatch) {
      const monToken = monMatch[1].slice(0, 3).toLowerCase();
      const mm = monthMap[monToken] || '';
      const dd = String(monMatch[2]).padStart(2, '0');
      const yyyy = monMatch[3];
      if (mm) return `${yyyy}-${mm}-${dd}`;
    }
    const parts = raw.match(/\d+/g) || [];
    if (parts.length < 3) return '';
    let year = '';
    let month = '';
    let day = '';
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } else if (parts[2] && parts[2].length === 4) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    } else {
      day = parts[0];
      month = parts[1];
      year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
    }
    if (!year || !month || !day) return '';
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const handleEshopexPrepago = async (row) => {
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

  const recojoCasilleros = React.useMemo(() => {
    const map = {};
    for (const p of recojoList || []) {
      const t = getLastTracking(p);
      const esh = (t?.trackingEshop || '').trim();
      const cargaRow = eshopexCargaByGuia[esh];
      const estatusEsho = normalizeCargaStatus(cargaRow?.estado || t?.estatusEsho || '');
      const casRaw = String(t?.casillero || '').trim();
      const casKey = casRaw.toLowerCase();
      const accountFromCas = casKey ? accountByCasillero[casKey] : '';
      const accountKey = String(cargaRow?.account || accountFromCas || '').trim().toLowerCase();
      const casLabel = casRaw || (accountKey ? casilleroByAccount[accountKey] : '') || '';
      if (!casLabel) continue;
      const key = casLabel.toLowerCase();
      if (!map[key]) {
        map[key] = {
          casKey: key,
          casLabel,
          accountKey: accountKey || '',
          total: 0,
          payable: 0,
        };
      }
      map[key].total += 1;
      if (!map[key].accountKey && accountKey) {
        map[key].accountKey = accountKey;
      }
      if (cargaRow && accountKey && isEnSucursal(estatusEsho)) {
        map[key].payable += 1;
      }
    }
    return Object.values(map).sort((a, b) => a.casLabel.localeCompare(b.casLabel));
  }, [recojoList, eshopexCargaByGuia, accountByCasillero, casilleroByAccount, getLastTracking]);

  const handleEshopexVincular = async (row, producto) => {
    const code = String(row?.guia || '').trim();
    const productoId = producto?.id;
    const key = `${code}-vincular-${productoId || 'na'}`;
    if (!code) return;
    if (eshopexVincularLoading.has(key)) return;
    if (!productoId) return;
    markVincularLoading(key, true);
    try {
      const fecha = parseEshopexFecha(row?.fechaRecepcion || '');
      const payload = {
        trackingEshop: code,
        estatusEsho: normalizeCargaStatus(row?.estado || ''),
      };
      if (fecha) payload.fechaRecepcion = fecha;
      const res = await api.put(`/tracking/producto/${productoId}`, payload);
      const updated = res?.data ?? res;
      applyTrackingUpdate(productoId, updated);
      setEshopexVincularOpen(false);
    } catch (err) {
      console.error(err);
      alert('No se pudo vincular el tracking Eshopex.');
    } finally {
      markVincularLoading(key, false);
    }
  };

  // Colores Tailwind por estado
  const badgeClasses = (estado) => {
    switch (normalizeEstado(estado)) {
      case 'comprado_sin_tracking':
        return 'bg-slate-100 text-slate-700 border border-slate-300';
      case 'comprado_en_camino':
        return 'bg-[#d6effe] text-[#009eff] border border-[#90b5fe]';
      case 'en_eshopex':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'recogido':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  // Reemplaza tu helper por emojis:
  const iconFromEstado = (estado) => {
    switch (normalizeEstado(estado)) {
      case 'comprado_sin_tracking':
        return <span role="img" aria-label="Paquete" className="text-lg">{"\uD83D\uDCE6"}</span>;
      case 'comprado_en_camino':
        return <span role="img" aria-label="Camion" className="text-lg">{"\uD83D\uDE9A"}</span>;
      case 'en_eshopex':
        return <span role="img" aria-label="Pin" className="text-lg">{"\uD83D\uDCCD"}</span>;
      case 'recogido':
        return <span role="img" aria-label="Check" className="text-lg">{"\u2705"}</span>;
      default:
        return <span role="img" aria-label="Desconocido" className="text-lg">{"\u2753"}</span>;
    }
  };





  // Bases de URL por operador declarado por backend
  const URLS = {
    usps: (code) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(code)}`,
    ups: (code) => `https://www.ups.com/track?tracknum=${encodeURIComponent(code)}`,
    fedex: (code) => `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(code)}`,
    dhl: (code) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(code)}&brand=DHL`,
    amazon: (code) => `https://www.amazon.com/progress-tracker/package?trackingId=${encodeURIComponent(code)}`,
    eshopex: (code) => `https://usamybox.com/internacional/tracking_box.php?nrotrack=${encodeURIComponent(code)}`,
  };

  // Construye el link segun estado y datos
  const buildTrackingLink = (t) => {
    if (!t) return null;

    const trackingUsa = typeof t.trackingUsa === 'string' ? t.trackingUsa.trim() : '';
    const trackingEsh = typeof t.trackingEshop === 'string' ? t.trackingEshop.trim() : '';
    const operadorRaw = typeof t.transportista === 'string' ? t.transportista : '';
    const operador = operadorRaw.toLowerCase();

    switch (t.estado) {
      case 'comprado_sin_tracking':
        return null;
      case 'comprado_en_camino':
        if (!trackingUsa || !operador || !URLS[operador]) return null;
        return { href: URLS[operador](trackingUsa), text: `Ver tracking ${operador.toUpperCase()}`};
      case 'en_eshopex':
        if (!trackingEsh) return null;
        return { href: URLS.eshopex(trackingEsh), text: 'Ver tracking Eshopex' };
      case 'recogido':
        if (trackingEsh) return { href: URLS.eshopex(trackingEsh), text: 'Ver historial Eshopex' };
        if (trackingUsa && operador && URLS[operador]) {
          return { href: URLS[operador](trackingUsa), text: `Ver historial ${operador.toUpperCase()}` };
        }
        return null;
      default:
        return null;
    }
  };

  // SWR helpers: cache + refresh
  const refreshProductos = useCallback(async ({ force = false, useCache = true, silent = false } = {}) => {
    const cache = useCache ? readCache() : null;
    const cacheFresh = cache && cache.ts && Date.now() - cache.ts <= CACHE_TTL_MS;
    if (!force && cacheFresh) {
      setProductos(cache.productos || []);
      if (cache.ventasMap) setVentasMap(cache.ventasMap || {});
      if (cache.adelantosMap) setAdelantosMap(cache.adelantosMap || {});
      if (cache.resumen) setResumen(cache.resumen);
      if (!silent) {
        setCargando(false);
        setError(null);
      }
      return cache.productos || [];
    }

    const showSpinner = !silent && (productos.length === 0 || force || !cacheFresh);
    if (showSpinner) setCargando(true);
    if (!silent) setError(null);
    try {
      const data = await api.get('/productos');
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : []);
      setProductos(lista);
      // Ventas se mantienen (se revalidan en otro efecto), pero el cache se pisa con ventas actuales ref
      writeCache(lista, ventasRef.current, resumenRef.current, adelantosRef.current);
      fetchResumen({ refresh: false });
      return lista;
    } catch (e) {
      console.error('Error cargando /productos:', e);
      const msg = (e && e.message) ? String(e.message) : '';
      setError(`No se pudieron cargar los productos. ${msg}`);
      return null;
    } finally {
      if (!silent) setCargando(false);
    }
  }, [productos.length, fetchResumen]);

  // Carga inicial: intenta cache, pero si no hay data hace fetch
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refreshProductos({ useCache: true, force: productos.length === 0 });
      await fetchResumen({ refresh: false });
    })();
    return () => { mounted = false; };
  }, [fetchResumen, refreshProductos, productos.length]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Array.isArray(productos) || productos.length === 0) return;
      const cache = readCache();
      const cacheFresh = cache && cache.ts && Date.now() - cache.ts <= CACHE_TTL_MS;
      const cacheHasVentas = cacheFresh && cache?.ventasMap && Object.keys(cache.ventasMap).length > 0;
      const cacheHasAdelantos = cacheFresh && cache?.adelantosMap && Object.keys(cache.adelantosMap).length > 0;
      if (cacheHasVentas) {
        setVentasMap(cache.ventasMap || {});
      }
      if (cacheHasAdelantos) {
        setAdelantosMap(cache.adelantosMap || {});
      }
      if (cacheHasVentas && cacheHasAdelantos) return;
      try {
        const ids = productos.map((p) => p.id).filter(Boolean);
        const query = ids.length ? `?ids=${ids.join(',')}` : '';
        const [ventasData, adelantosData] = await Promise.all([
          api.get(`/ventas/ultimas${query}`),
          api.get(`/ventas/adelantos/ultimos${query}`),
        ]);
        const ventasArr = Array.isArray(ventasData)
          ? ventasData
          : (Array.isArray(ventasData?.items) ? ventasData.items
            : (Array.isArray(ventasData?.data) ? ventasData.data : []));
        const adelantosArr = Array.isArray(adelantosData)
          ? adelantosData
          : (Array.isArray(adelantosData?.items) ? adelantosData.items
            : (Array.isArray(adelantosData?.data) ? adelantosData.data : []));
        const map = {};
        const adelantos = {};
        ventasArr.forEach((v) => {
          if (v && v.productoId != null) map[v.productoId] = v;
        });
        adelantosArr.forEach((a) => {
          if (a && a.productoId != null) adelantos[a.productoId] = a;
        });
        ids.forEach((id) => {
          if (map[id] === undefined) map[id] = null;
          if (adelantos[id] === undefined) adelantos[id] = null;
        });
        if (!mounted) return;
        setVentasMap(map);
        setAdelantosMap(adelantos);
        writeCache(productosRef.current, map, resumenRef.current, adelantos);
      } catch (e) {
        console.error('Error cargando ventas:', e);
      }
    })();
    return () => { mounted = false; };
  }, [productos]);

  const displayedProductos = React.useMemo(() => {

    const ts = (p) => {
      const fc = p?.valor?.fechaCompra || p?.valor?.fecha_compra || p?.fechaCompra || null;
      const t = fc ? Date.parse(fc) : 0;
      return Number.isFinite(t) ? t : 0;
    };
    const saleTs = (p) => {
      const venta = ventasMap[p?.id] || null;
      const fv =
        venta?.fechaVenta ||
        venta?.fecha_venta ||
        venta?.fecha ||
        venta?.createdAt ||
        venta?.updatedAt ||
        null;
      const t = fv ? Date.parse(fv) : 0;
      return Number.isFinite(t) ? t : 0;
    };

    let list = Array.isArray(productos) ? [...productos] : [];
    // --- Filtro por tracking (USA / Eshopex) ---
    const q = String(trackingQuery || '').trim().toLowerCase();
    if (q) {
      // versifn solo-dfgitos para casos donde pegas un cfdigo largo que contiene el real
      const qDigits = q.replace(/\D+/g, '');

      list = list.filter((p) => {
        const t = p.tracking?.[0] || {};
        const usa = String(t.trackingUsa || '').trim().toLowerCase();
        const esh = String(t.trackingEshop || '').trim().toLowerCase();

        const usaDigits = usa.replace(/\D+/g, '');
        const eshDigits = esh.replace(/\D+/g, '');

        // Coincidencias en ambos sentidos:
        // - normal: usa/esh contienen q  O q contiene usa/esh
        // - solo-dfgitos: usaDigits/eshDigits contienen qDigits  O qDigits contiene usaDigits/eshDigits
        const match =
          (usa && (usa.includes(q) || q.includes(usa))) ||
          (esh && (esh.includes(q) || q.includes(esh))) ||
          (qDigits && usaDigits && (usaDigits.includes(qDigits) || qDigits.includes(usaDigits))) ||
          (qDigits && eshDigits && (eshDigits.includes(qDigits) || qDigits.includes(eshDigits)));

        return Boolean(match);
      });
    }


    if (soloDisponibles && !soloVendidos && !soloAdelanto) {
      list = list.filter((p) => {
        const t = p.tracking?.[0];
        const venta = ventasMap[p.id] || null;
        const adelanto = adelantosMap[p.id] || null;
        return t?.estado === 'recogido' && !venta && !adelanto;
      });
    }
    if (soloVendidos && !soloDisponibles && !soloAdelanto) {
      list = list.filter((p) => Boolean(ventasMap[p.id]));
    }
    if (soloAdelanto && !soloDisponibles && !soloVendidos) {
      list = list.filter((p) => Boolean(adelantosMap[p.id]));
    }

    // Filtro por tipo ("otro" = todo lo que NO es macbook ni ipad)
    if (filtroTipo !== 'todos') {
      const matchTipo = (tipo) => {
        const t = String(tipo || '').toLowerCase().trim();
        if (filtroTipo === 'otro') {
          return t !== 'macbook' && t !== 'ipad' && t !== 'iphone';
          // Si NO quieres incluir "pantalla" dentro de "otros", usa:
          // return t !== 'macbook' && t !== 'ipad' && t !== 'pantalla';
        }
        return t === filtroTipo;
      };
      list = list.filter((p) => matchTipo(p.tipo));
    }

    // Subfiltros por procesador y tamano (segun tipo)
    if (filtroTipo !== 'todos') {
      const procTerm = String(filtroProc || '').toLowerCase();
      const tamTerm = String(filtroTam || '').toLowerCase();
      const gamaTerm = String(filtroGama || '').toLowerCase();

      list = list.filter((p) => {
        const tipo = String(p.tipo || '').toLowerCase();
        const d = p.detalle || {};
        const gamaP = String(d.gama || p.gama || '').toLowerCase();

        if (tipo === 'macbook' || tipo === 'ipad') {
          // Filtro por procesador (si aplica)
          if (procTerm !== 'todos') {
            const proc = String(d.procesador || '').toLowerCase();
            if (proc !== procTerm) return false;
          }
          if (gamaTerm !== 'todos' && gamaP !== gamaTerm) return false;
          // Filtro por tamano (si aplica)
          if (tamTerm !== 'todos') {
            const tam = String(getTam(d) || '').toLowerCase();
            if (tam !== tamTerm) return false;
          }
          return true;
        }

        if (tipo === 'iphone') {
          if (gamaTerm !== 'todos') {
            const modelo = String(d.modelo || '').toLowerCase();
            return modelo === gamaTerm;
          }
          return true;
        }

        if (tipo === 'pantalla') {
          // Para Pantalla, el selector "Procesador" es en realidad el tamano
          if (procTerm !== 'todos') {
            const tam = String(getTam(d) || '').toLowerCase();
            return tam === procTerm;
          }
          return true;
        }

        if (gamaTerm !== 'todos') {
          return gamaP === gamaTerm;
        }

        // Otros tipos no tienen subfiltros
        return true;
      });
    }


    if (soloVendidos && !soloDisponibles && !soloAdelanto) {
      list.sort((a, b) => saleTs(b) - saleTs(a)); // ventas mas recientes arriba
    } else {
      list.sort((a, b) => ts(b) - ts(a)); // mas nuevos arriba (fecha compra)
    }
    return list;
  }, [productos, ventasMap, adelantosMap, soloDisponibles, soloVendidos, soloAdelanto, filtroTipo, filtroProc, filtroTam, filtroGama, trackingQuery]);





  const abrirCrear = () => { setProductoSeleccionado(null); setModalModo('crear'); };
  const abrirDetalle = (p) => { setProductoSeleccionado(p); setModalModo('detalle'); };
  const abrirCostos = (p) => { setProductoSeleccionado(p); setModalModo('costos'); };
  const abrirTrack = (p) => { setProductoSeleccionado(p); setModalModo('track'); };
  const abrirDec = (p) => { setProductoSeleccionado(p); setModalModo('dec'); };
  const abrirFotosManual = (seed = null) => {
    if (seed) {
      setFotosManualSeed({
        trackingEshop: seed.trackingEshop || '',
        fechaRecepcion: seed.fechaRecepcion || '',
      });
    } else {
      setFotosManualSeed({ trackingEshop: '', fechaRecepcion: '' });
    }
    setModalModo('fotosManual');
  };
  const cerrarModal = () => { setModalModo(null); setProductoSeleccionado(null); setProductoEnCasillero(null); };
  const abrirCasillero = (cas) => { setSelectedCasillero(cas); setModalModo('casillero'); };
  const abrirAdelantoSelect = (p) => {
    setAdelantoProducto(p || null);
    setAdelantoActivo(null);
    setAdelantoModo('select');
  };
  const abrirAdelantoCreate = (p) => {
    setAdelantoProducto(p || null);
    setAdelantoActivo(null);
    setAdelantoModo('create');
  };
  const abrirAdelantoDetalle = (p, adelanto) => {
    setAdelantoProducto(p || null);
    setAdelantoActivo(adelanto || null);
    setAdelantoModo('detail');
  };
  const abrirAdelantoCompletar = (p, adelanto) => {
    setAdelantoProducto(p || null);
    setAdelantoActivo(adelanto || null);
    setAdelantoModo('complete');
  };
  const cerrarAdelanto = () => {
    setAdelantoModo(null);
    setAdelantoProducto(null);
    setAdelantoActivo(null);
  };

  const applyProductoUpdate = (updated, { isNuevo = false, closeModal = true } = {}) => {
    setProductos(list => {
      const next = isNuevo
        ? [updated, ...list]
        : list.map(p => (p.id === updated.id ? updated : p));
      writeCache(next, ventasMap, resumenRef.current, adelantosRef.current);
      return next;
    });
    if (closeModal) cerrarModal();
  };

  const applyTrackingUpdate = (productoId, tracking) => {
    if (!productoId || !tracking) return;
    setProductos(list => {
      const next = list.map(p => {
        if (p.id !== productoId) return p;
        const prev = Array.isArray(p.tracking) ? p.tracking : [];
        const merged = [tracking, ...prev.filter(t => t && t.id !== tracking.id)];
        return { ...p, tracking: merged };
      });
      writeCache(next, ventasMap, resumenRef.current, adelantosRef.current);
      return next;
    });
  };

  const guardarDetalleProducto = async (id, payload) => {
    let yaGuardando = false;
    setSavingProductos((prev) => {
      if (prev.has(id)) {
        yaGuardando = true;
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    if (yaGuardando) return;

    try {
      const res = await api.patch('/productos/' + id, payload);
      const updated = res?.data ?? res;
      applyProductoUpdate(updated, { isNuevo: false, closeModal: false });
    } catch (e) {
      console.error('[Productos] Error al guardar producto', e);
      alert('No se pudo actualizar el producto.');
    } finally {
      setSavingProductos((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSaved = (updated, trackingUpdate) => {
    const currentList = productosRef.current || [];
    const isNuevo = updated?.id ? !currentList.some((p) => p.id === updated.id) : modalModo === 'crear';
    applyProductoUpdate(updated, { isNuevo, closeModal: false });
    if (trackingUpdate && updated?.id) {
      applyTrackingUpdate(updated.id, trackingUpdate);
    }
    refreshProductos({ force: true, useCache: false, silent: true });
  };

  const handleSavedEnCasillero = (updated) => {
    applyProductoUpdate(updated, { isNuevo: false, closeModal: false });
    setProductoEnCasillero(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(',Eliminar este producto?')) return;
    try {
      await api.del(`/productos/${id}`);
      setProductos(list => list.filter(p => p.id !== id));
      fetchResumen({ refresh: true });
    } catch (e) {
      console.error(e);
      alert('Error al eliminar.');
    }
  };

  // === CONTADORES ===
  const stats = React.useMemo(() => {
    if (resumen) {
      return {
        total: resumen.total ?? 0,
        sinTracking: resumen.sinTracking ?? 0,
        enCamino: resumen.enCamino ?? 0,
        enEshopex: resumen.enEshopex ?? 0,
        disponible: resumen.disponible ?? 0,
        vendido: resumen.vendido ?? 0,
      };
    }

    const total = productos.length;
    let sinTracking = 0;
    let enCamino = 0;
    let enEshopex = 0;
    let disponible = 0;
    let vendido = 0;

    for (const p of productos) {
      const t = p.tracking?.[0];
      const estado = t?.estado || null;
      const venta = ventasMap[p.id] || null;
      const adelanto = adelantosMap[p.id] || null;

      if (!t || estado === 'comprado_sin_tracking') sinTracking++;
      if (estado === 'comprado_en_camino') enCamino++;
      if (estado === 'en_eshopex') enEshopex++;

      if (venta) {
        vendido++;
      } else if (estado === 'recogido' && !adelanto) {
        disponible++;
      }
    }

    return { total, sinTracking, enCamino, enEshopex, disponible, vendido };
  }, [productos, ventasMap, adelantosMap, resumen]);

  // Convierte "S/ 1,234.50" o "$ 99" a nfmero seguro
  const toNumber = useCallback((x) => {
    if (x == null || x === '') return 0;
    if (typeof x === 'number') return x;
    if (typeof x === 'string') {
      const clean = x.replace(/[^\d.-]/g, ''); // quita S/, $, comas, espacios
      const n = Number(clean);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  }, []);
  // Lee el monto de la venta en S/ sin importar el nombre/caso/anidacifn
  const getMontoVentaSoles = useCallback((venta) => {
    if (!venta) return 0;

    // posibles claves planas
    const claves = [
      'montoVentaSoles',
      'montoVenta',
      'monto_soles',
      'precioVentaSoles',
      'precioSoles',
      'totalSoles',
      'monto',
      'precioVenta',
      'importeSoles',
      'montoTotalSoles'
    ];

    for (const k of claves) {
      const n = toNumber(venta[k]);
      if (n) return n;
    }

    // si viniera anidado (p.ej. venta.detalle.montoSoles)
    if (venta.detalle && typeof venta.detalle === 'object') {
      const clavesDet = ['montoVentaSoles', 'montoSoles', 'precioSoles', 'totalSoles'];
      for (const k of clavesDet) {
        const n = toNumber(venta.detalle[k]);
        if (n) return n;
      }
    }

    return 0;
  }, [toNumber]);



  // === TOTALES DE MONTOS ===
  // Suma global de valorProducto ($), costoEnvio (S/), costoTotal (S/), total vendido (S/), y ganancia (S/)
  const totals = React.useMemo(() => {
    if (resumen) {
      const fmtS = (n) => `S/ ${Number(n).toFixed(2)}`;
      const fmtU = (n) => `$ ${Number(n).toFixed(2)}`;
      const toNum = (v) => Number(v ?? 0) || 0;
      return {
        totalGastadoUSD: fmtU(toNum(resumen.totalGastadoUsd)),
        totalEnvioSoles: fmtS(toNum(resumen.totalEnvioPen)),
        totalDecUSD: fmtU(toNum(resumen.totalDecUsd)),
        totalCostoSoles: fmtS(toNum(resumen.totalCostoPen)),
        totalVentaSoles: fmtS(toNum(resumen.totalVentaPen)),
        gananciaSoles: fmtS(toNum(resumen.gananciaPen)),
      };
    }

    let totalGastadoUSD = 0;   // suma de valorProducto ($)
    let totalEnvioSoles = 0;   // suma de costoEnvio (S/)
    let totalDecUSD = 0;
    let totalCostoSoles = 0;   // suma de costoTotal (S/)
    let totalVentaSoles = 0;   // suma de venta (S/) sflo si existe registro de venta
    let gananciaSoles = 0;     // totalVentaSoles - totalCostoSoles (por producto vendido)

    for (const p of productos) {
      const v = p.valor || {};
      const venta = ventasMap[p.id] || null;

      // Costos
      if (v.valorProducto != null && v.valorProducto !== '') {
        totalGastadoUSD += Number(v.valorProducto) || 0;
      }
      if (v.valorDec != null && v.valorDec !== '') {
        totalDecUSD += Number(v.valorDec) || 0;
      }
      if (v.costoEnvio != null && v.costoEnvio !== '') {
        totalEnvioSoles += Number(v.costoEnvio) || 0;
      }
      if (v.costoTotal != null && v.costoTotal !== '') {
        totalCostoSoles += Number(v.costoTotal) || 0;
      }

      // Ventas y ganancia (si existe venta)
      if (venta) {
        // Soporta distintos nombres y formateos
        const montoVenta = getMontoVentaSoles(venta);


        totalVentaSoles += montoVenta;

        const costoProducto = toNumber(v.costoTotal);
        gananciaSoles += (montoVenta - costoProducto);
      }

    }

    // Helpers de formato
    const fmtSoles = (n) => `S/ ${Number(n).toFixed(2)}`;
    const fmtUSD = (n) => `$ ${Number(n).toFixed(2)}`;

    return {
      totalGastadoUSD: fmtUSD(totalGastadoUSD),
      totalEnvioSoles: fmtSoles(totalEnvioSoles),
      totalDecUSD: fmtUSD(totalDecUSD),
      totalCostoSoles: fmtSoles(totalCostoSoles),
      totalVentaSoles: fmtSoles(totalVentaSoles),
      gananciaSoles: fmtSoles(gananciaSoles),
    };
  }, [productos, ventasMap, resumen, getMontoVentaSoles, toNumber]);



  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 bg-macGray text-macDark">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8">
        <h2 className="text-3xl font-semibold">Gesti&oacute;n de Productos</h2>
        <button onClick={() => setVista('home')} className="w-full sm:w-auto px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">
          &larr; Volver
        </button>
      </header>

      {/* Resumen de conteos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Totales</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Sin tracking</div>
          <div className="text-2xl font-semibold">{stats.sinTracking}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">En camino US</div>
          <div className="text-2xl font-semibold">{stats.enCamino}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">En Eshopex</div>
          <div className="text-2xl font-semibold">{stats.enEshopex}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Disponible</div>
          <div className="text-2xl font-semibold">{stats.disponible}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Vendido</div>
          <div className="text-2xl font-semibold">{stats.vendido}</div>
        </div>
      </div>{/* Panel de casilleros */}
      <ResumenCasilleros productos={productos} onCasilleroClick={abrirCasillero} />

      {/* Totales de montos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total gastado ($)</div>
          <div className="text-2xl font-semibold">{totals.totalGastadoUSD}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total env&iacute;o (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalEnvioSoles}</div>
        </div> {/* ? cierre agregado aquf */}
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total DEC ($)</div>
          <div className="text-2xl font-semibold">{totals.totalDecUSD}</div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total costo (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalCostoSoles}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total venta (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalVentaSoles}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Ganancia total (S/)</div>
          <div className="text-2xl font-semibold">{totals.gananciaSoles}</div>
        </div>
      </div>

      {/* Botonera: Agregar / Importar recojo / Recojo masivo */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        {!selectMode ? (
          <>
            {/* Filtro a la izquierda */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap w-full">
              <div className="border rounded-lg px-3 py-2 bg-white shadow-sm w-full sm:w-auto">
                <div className="text-xs text-gray-500 mb-1">Mostrar</div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={soloVendidos}
                    onChange={(e) => setSoloVendidos(e.target.checked)}
                  />
                  Vendidos
                </label>
                <label className="flex items-center gap-2 text-sm mt-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={soloAdelanto}
                    onChange={(e) => setSoloAdelanto(e.target.checked)}
                  />
                  Adelanto
                </label>
                <label className="flex items-center gap-2 text-sm mt-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={soloDisponibles}
                    onChange={(e) => setSoloDisponibles(e.target.checked)}
                  />
                  Disponibles
                </label>
              </div>

              <input
                type="text"
                className="border rounded px-2 py-1 w-full sm:w-60"
                placeholder="Buscar tracking (USA/Eshopex)"
                value={trackingQuery}
                onChange={(e) => setTrackingQuery(e.target.value)}
              />



              <label className="text-sm inline-flex items-center gap-2 w-full sm:w-auto">
                <span>Tipo</span>
                <select
                  className="border rounded px-2 py-1 w-full sm:w-auto"
                  value={filtroTipo}
                  onChange={(e) => { setFiltroTipo(e.target.value); setFiltroProc('todos'); setFiltroGama('todos'); setFiltroTam('todos'); }}
                >
                  <option value="todos">Todos</option>
                  {tiposDisponibles.includes('macbook') && <option value="macbook">MacBook</option>}
                  {tiposDisponibles.includes('ipad') && <option value="ipad">iPad</option>}
                  {tiposDisponibles.includes('pantalla') && <option value="pantalla">Pantalla</option>}
                  {tiposDisponibles.includes('iphone') && <option value="iphone">iPhone</option>}
                  {tiposDisponibles.includes('otro') && <option value="otro">Otros</option>}
                </select>
              </label>

              {(filtroTipo !== 'todos' && opcionesGama.length > 0) && (
                <label className="text-sm inline-flex items-center gap-2 w-full sm:w-auto">
                  <span>{filtroTipo === 'iphone' ? 'Modelo' : 'Gama'}</span>
                  <select
                    className="border rounded px-2 py-1 w-full sm:w-auto"
                    value={filtroGama}
                    onChange={(e) => setFiltroGama(e.target.value)}
                  >
                    <option value="todos">{filtroTipo === 'iphone' ? 'Todos' : 'Todas'}</option>
                    {opcionesGama.map((opt) => (
                      <option key={opt} value={String(opt).toLowerCase()}>{opt}</option>
                    ))}
                  </select>
                </label>
              )}

              {(filtroTipo === 'macbook' || filtroTipo === 'ipad' || filtroTipo === 'pantalla') && (
                <label className="text-sm inline-flex items-center gap-2 w-full sm:w-auto">
                  <span>{filtroTipo === 'pantalla' ? 'Pantalla' : 'Procesador'}</span>
                  <select
                    className="border rounded px-2 py-1 w-full sm:w-auto"
                    value={filtroProc}
                    onChange={(e) => { setFiltroProc(e.target.value); setFiltroTam('todos'); }}






                  >
                    <option value="todos">Todos</option>
                    {opcionesProc.map((opt) => (
                      <option key={opt} value={opt.toLowerCase()}>{opt}</option>
                    ))}
                  </select>
                </label>
              )}

              {(filtroTipo === 'macbook' || filtroTipo === 'ipad') && (
                <label className="text-sm inline-flex items-center gap-2 w-full sm:w-auto">
                  <span>{'Tama\u00f1o'}</span>
                  <select
                    className="border rounded px-2 py-1 w-full sm:w-auto"
                    value={filtroTam}
                    onChange={(e) => setFiltroTam(e.target.value)}
                  >
                    <option value="todos">Todos</option>
                    {opcionesTam.map((opt) => (
                      <option key={opt} value={String(opt).toLowerCase()}>{opt}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {/* Acciones a la derecha */}
            <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-start sm:justify-end">
              {/* Analisis a la izquierda, con m\u00e1s separaci\u00f3n del siguiente */}
              <button
                onClick={() => { setAnalisisBack('productos'); setVista('analisis'); }}
                className="w-full sm:w-auto bg-slate-600 text-white px-5 py-2 rounded hover:bg-slate-700 sm:mr-6"
                title="Ir al m\u00f3dulo de Analisis"
              >
                Analisis
              </button>
              <button
                onClick={startAdelantarVenta}
                className="w-full sm:w-auto bg-amber-600 text-white px-5 py-2 rounded hover:bg-amber-700"
                title="Selecciona 1 producto no vendido para registrar la venta"
              >
                Adelantar venta
              </button>
              <button
                onClick={abrirCrear}
                className="w-full sm:w-auto bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
              >
                Agregar Producto
              </button>
              <button
                onClick={startRecojo}
                className="w-full sm:w-auto bg-purple-600 text-white px-5 py-2 rounded hover:bg-purple-700"
                title="Selecciona varios y marcar como recogidos + generar texto para WhatsApp"
              >
                Recojo
              </button>
              <button
                onClick={() => setVentaMsgOpen(true)}
                className="w-full sm:w-auto bg-pink-600 text-white px-5 py-2 rounded hover:bg-pink-700"
                title="Generar texto de venta para WhatsApp"
              >
                Venta
              </button>
              <button
                onClick={abrirFotosManual}
                className="w-full sm:w-auto bg-teal-600 text-white px-5 py-2 rounded hover:bg-teal-700"
                title="Ingresar tracking y fecha para consultar fotos en Eshopex"
              >
                Fotos
              </button>
              <button
                onClick={abrirMarcaAgua}
                className="w-full sm:w-auto bg-emerald-700 text-white px-5 py-2 rounded hover:bg-emerald-800"
                title="Aplicar marca de agua a varias fotos"
              >
                Marca de agua
              </button>
              <button
                onClick={abrirDec}
                className="w-full sm:w-auto bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 inline-flex items-center gap-2"
                title="Generar DEC / Comprobante"
              >
                <FiFileText className="text-lg" />
                DEC
              </button>
            </div>
          </>
        ) : (
          // ??? tu bloque existente de seleccifn (pickup/whatsapp) se mantiene igual
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 w-full">
            <div className="flex-1">
              {selectAction === 'recojo' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha de recojo</label>
                  <input
                    type="date"
                    className="border rounded px-3 py-2 w-full sm:w-60"
                    value={pickupDate}
                    onChange={(e) => setPickupDate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Al aceptar: marcarf como <b>Recogido</b> y abrirf WhatsApp con el listado.
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 justify-start sm:justify-end w-full">
              <button
                onClick={confirmAction}
                className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
                disabled={(selectAction === 'recojo' && !pickupDate) || (selectAction === 'adelantar' ? selectedIds.size !== 1 : selectedIds.size === 0)}
              >
                Aceptar
              </button>
              <button
                onClick={cancelSelect}
                className="bg-gray-300 text-gray-800 px-5 py-2 rounded hover:bg-gray-400"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>







      {/* Cargando / Error */}
      {cargando && <p>Cargando productos...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* Tabla */}
      {!cargando && !error && (
        displayedProductos.length > 0 ? (
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-[1100px] w-full text-left border text-xs sm:text-sm">
              <thead className="bg-gray-100">
                <tr>
                  {selectMode && <th className="p-2">Sel.</th>}
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Estado</th>
                  <th className="p-2">Accesorios</th>
                  <th className="p-2">Valor $</th>
                  <th className="p-2">Valor S/</th>
                  <th className="p-2">{'Env\u00edo S/'}</th>
                  <th className="p-2">Total S/</th>
                  <th className="p-2">Calculadora</th>
                  <th className="p-2">F. Compra</th>
                  <th className="p-2">Tracking</th>
                  <th className="p-2">Fotos Es</th>
                  <th className="p-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {displayedProductos.map((p) => {
                  const v = p.valor || {};
                  const t = getLastTracking(p); // Ultimo tracking (si existe)
                  const label = labelFromEstado(t?.estado);
                  const link = buildTrackingLink(t);
                  const estado = t?.estado || '';
                  const venta = ventasMap[p.id] || null;
                  const adelanto = adelantosMap[p.id] || null;

                  // Solo seleccionable en Recojo si estf en Eshopex
                  const canSelectRecojo = selectAction === 'recojo' ? estado === 'en_eshopex' : true;

                  // En adelantar, tu regla de 1 y no vendido; en recojo, bloquear si no es Eshopex
                  const disabledSel = selectAction === 'adelantar'
                    ? (!!venta || !!adelanto || (selectedIds.size >= 1 && !selectedIds.has(p.id)))
                    : !canSelectRecojo;

                  const isSelected = selectedIds.has(p.id);
                  const guardando = savingProductos.has(p.id);



                  // Seleccifn deshabilitada solo para 'adelantar' (ya vendido o ya hay otro marcado)

                  return (
                    <tr
                      key={p.id}
                      className={`border-t hover:bg-gray-50 ${selectMode ? 'cursor-pointer' : ''} ${isSelected ? 'bg-indigo-50' : ''} ${(selectMode && disabledSel) ? 'opacity-60 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        if (!selectMode) return;
                        if (disabledSel) return;
                        toggleSelect(p.id);
                      }}
                    >

                    {selectMode && (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          disabled={disabledSel}
                          title={
                            disabledSel
                              ? (selectAction === 'recojo'
                                ? 'Solo se pueden seleccionar productos en Eshopex'
                                : 'No disponible para adelantar')
                              : ''
                          }
                          checked={isSelected}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => toggleSelect(p.id)}
                        />
                      </td>
                    )}



                    <td className="p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!guardando) abrirDetalle(p); }}
                        className={`bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 ${guardando ? 'opacity-60 cursor-not-allowed' : ''}`}
                        disabled={guardando}
                      >
                        {guardando ? 'Guardando...' : p.tipo}
                      </button>

                    </td>
                    <td className="p-2">{p.estado}</td>
                    <td className="p-2">{Array.isArray(p.accesorios) && p.accesorios.length ? (p.accesorios.length===3 ? "Todos" : p.accesorios.join(", ")) : "-"}</td>
                    <td className="p-2">{v.valorProducto != null ? `$ ${v.valorProducto}` : '-'}</td>
                    <td className="p-2">{fmtSoles(v.valorSoles)}</td>
                    <td className="p-2">{fmtSoles(v.costoEnvio)}</td>
                    <td className="p-2">{fmtSoles(v.costoTotal)}</td>
                    <td className="p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirCalculadora(p); }}
                        className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                        title="Calcular precio de venta"
                      >
                        Calcular precio venta
                      </button>

                    </td>
                    <td className="p-2">
                      {v.fechaCompra ? new Date(v.fechaCompra).toLocaleDateString('es-PE', { timeZone: 'UTC' }) : '-'}
                    </td>
                    <td className="p-2">
                      {/* Pill/ botfn de estado: mfs grande, negrita y ??oclickable??? */}
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirTrack(p); }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${badgeClasses(t?.estado)}`}
                        title="Abrir tracking"
                      >
                        {iconFromEstado(t?.estado)}
                        {label}
                      </button>



                      {/* Casillero mfs visible (mfs grande + negrita) */}
                      <div className="mt-1 text-sm font-semibold text-gray-800">
                        {t?.casillero ? `Casillero: ${t.casillero}` : 'Casillero: N/A'}
                      </div>

                      {/* Enlace dinfmico debajo */}
                      {link && (
                        <div className="mt-1 text-xs">
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {link.text}
                          </a>

                        </div>
                      )}

                      {/* Transportista + tracking USA, separados para copiar ffcilmente */}
                      {(() => {
                        const carrier = (t?.transportista || '').toString().trim();
                        const trackUsa = (t?.trackingUsa || '').toString().trim();
                        if (!carrier || !trackUsa) return null;
                        return (
                          <div className="mt-1 text-xs text-gray-700 font-mono flex gap-1">
                            <span className="select-none">{carrier.toLowerCase()}:</span>
                            <span className="select-all">{trackUsa}</span>
                          </div>
                        );
                      })()}



                    </td>


                    {/* Fotos Es */}
                    <td className="p-2">
                      {(() => {
                        const puedeVer = estado === 'en_eshopex' || estado === 'recogido';
                        return (
                          <button
                            onClick={(e) => { if (!puedeVer) return; e.stopPropagation(); abrirFotos(p); }}
                            disabled={!puedeVer}
                            className={`${puedeVer ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} px-2 py-1 rounded`}
                            title={puedeVer ? 'Ver fotos Eshopex' : 'Fotos no disponibles para este estado'}
                          >
                            Ver foto
                          </button>
                        );
                      })()}
                    </td>


                    {/* Venta */}
                    <td className="p-2">
                      {(() => {
                        const t = p.tracking?.[0];
                        const venta = ventasMap[p.id] || null;
                        const adelanto = adelantosMap[p.id] || null;
                        const recogido = t?.estado === 'recogido';

                        let text = 'En espera';
                        let className = 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-60';
                        let disabled = true;

                        if (recogido && !venta && !adelanto) {
                          text = 'Disponible';
                          className = 'bg-yellow-500 text-white hover:bg-yellow-600';
                          disabled = false;
                        }
                        if (adelanto && !venta) {
                          text = 'Adelanto';
                          className = 'bg-amber-600 text-white hover:bg-amber-700';
                          disabled = false;
                        }
                        if (venta) {
                          text = 'Vendido';
                          className = 'bg-green-600 text-white hover:bg-green-700';
                          disabled = false;
                        }

                        return (
                          <button
                            onClick={() => {
                              if (disabled) return;
                              if (venta) {
                                abrirVenta(p);
                                return;
                              }
                              if (adelanto) {
                                abrirAdelantoDetalle(p, adelanto);
                                return;
                              }
                              abrirVenta(p);
                            }}
                            className={`${className} px-3 py-1 rounded`}
                            disabled={disabled}
                            title={disabled ? 'A\u00fan no est\u00e1 recogido' : ''}
                          >
                            {text}
                          </button>
                        );
                      })()}
                    </td>


                    <td className="p-2 space-x-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirCostos(p); }}
                        className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        Editar Costos
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                        className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >
                        Borrar
                      </button>

                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p>
            {(soloDisponibles && !soloVendidos && !soloAdelanto)
              ? 'No hay productos disponibles para venta.'
              : (soloVendidos && !soloDisponibles && !soloAdelanto)
                ? 'No hay productos vendidos.'
                : (soloAdelanto && !soloDisponibles && !soloVendidos)
                  ? 'No hay productos con adelanto.'
                  : 'No hay productos a\u00fan.'}
          </p>
        )
      )}

      
            {recojoOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start sm:items-center justify-center z-50 overflow-y-auto p-2 sm:p-4">
          <div className="bg-white w-full max-w-4xl rounded-xl shadow-lg p-4 sm:p-6 relative max-h-[95dvh] sm:max-h-[92dvh] overflow-hidden flex flex-col">
            <button
              className="absolute right-3 top-3 sm:right-4 sm:top-4 w-11 h-11 sm:w-10 sm:h-10 flex items-center justify-center text-2xl font-bold rounded-full border border-gray-300 bg-white shadow-sm hover:bg-gray-100 active:scale-95 z-10"
              onClick={() => setRecojoOpen(false)}
              aria-label="Cerrar"
            >
              x
            </button>

            <div className="mb-4 pr-12">
              <h2 className="text-lg sm:text-xl font-semibold">Recojo Eshopex</h2>
            </div>

            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <button
                className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={handleRecojoWhatsapp}
              >
                Marcar recogido
              </button>
              <button
                className="px-3 py-2 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                onClick={handleRecojoTrackingLinks}
              >
                Abrir tracking
              </button>
            </div>

            <div className="pr-0.5 flex-1 min-h-0 flex flex-col">
            <div className="grid grid-cols-1 gap-3 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 w-full sm:w-auto"
                  onClick={() => {
                    const allIds = recojoList.filter((p) => isRecojoReady(p)).map((p) => p.id);
                    const allSelected = recojoSelected.size === allIds.length && allIds.length > 0;
                    setRecojoSelected(allSelected ? new Set() : new Set(allIds));
                  }}
                >
                  {recojoSelected.size === recojoList.filter((p) => isRecojoReady(p)).length && recojoList.some((p) => isRecojoReady(p))
                    ? 'Deseleccionar'
                    : 'Seleccionar todos'}
                </button>
                <div className="w-full sm:w-auto">
                  <label className="block text-sm font-medium mb-1">Fecha de recojo</label>
                  <input
                    type="date"
                    className="border rounded px-3 py-2 w-full sm:w-auto"
                    value={recojoDate}
                    onChange={(e) => setRecojoDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="text-sm text-gray-500">
                Productos en Eshopex: {recojoList.length}
              </div>

              <div className="overflow-x-auto">
                <div className="flex gap-2 items-center min-w-max pb-1">
                  {recojoCasilleros.map((c) => {
                    const accountKey = String(c.accountKey || '').trim().toLowerCase();
                    const pagoKey = `cas-${c.casKey}-${accountKey}`;
                    const pagoLoading = eshopexPagoLoading.has(pagoKey);
                    const canPay = c.payable > 0 && accountKey;
                    return (
                      <button
                        key={`${c.casKey}-pago`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canPay) return;
                          handleEshopexPrepago({ account: accountKey, guia: `cas-${c.casKey}` });
                        }}
                        disabled={!canPay || pagoLoading}
                        className={`${(!canPay || pagoLoading) ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-3 py-2 rounded whitespace-nowrap`}
                        title={!canPay ? 'Sin paquetes disponibles para pagar' : `Pagar casillero ${c.casLabel}`}
                      >
                        {pagoLoading ? 'Procesando...' : `${c.casLabel}`}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {recojoList.length === 0 ? (
              <div className="text-sm text-gray-500">No hay productos en Eshopex.</div>
            ) : (
              <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm flex-1 min-h-0 overflow-y-auto">
                <table className="min-w-[900px] w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Sel.</th>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-left">Estatus</th>
                      <th className="p-2 text-left">Tracking Eshopex</th>
                      <th className="p-2 text-left">EstatusEsho</th>
                      <th className="p-2 text-left">Fecha recepcion</th>
                      <th className="p-2 text-left">Casillero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recojoList.map((p) => {
                      const t = getLastTracking(p);
                      const esh = (t?.trackingEshop || '').trim();
                      const fecha = t?.fechaRecepcion
                        ? new Date(t.fechaRecepcion).toLocaleDateString('es-PE', { timeZone: 'UTC' })
                        : '-';
                      const cargaRow = eshopexCargaByGuia[esh];
                      const statusInfo = recojoStatusMap[esh] || {};
                      const statusNorm = normalizeEshopexStatus(statusInfo.status);
                      const estatusEsho = normalizeCargaStatus(cargaRow?.estado || t?.estatusEsho || '');
                      const cas = String(t?.casillero || '').trim().toLowerCase();
                      const isReady = isRecojoReady(p);
                      const checked = recojoSelected.has(p.id);
                      return (
                        <tr key={p.id} className="border-t">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!isReady}
                              title={isReady ? '' : 'Solo disponible cuando esta Pagado o En Sucursal'}
                              onChange={() => toggleRecojoSelect(p.id)}
                            />
                          </td>
                          <td className="p-2">{buildNombreProducto(p) || p.tipo}</td>
                          <td className="p-2">
                            <div className="text-sm font-medium">
                              {statusInfo.loading ? 'Cargando' : (statusInfo.status ? statusNorm.label : 'No hay informacion')}
                            </div>
                            {(statusInfo.date || statusInfo.time) && (
                              <div className="text-xs text-gray-500">
                                {(statusInfo.date || '')} {(statusInfo.time || '')}
                              </div>
                            )}
                          </td>
                          <td className="p-2">
                            {esh ? (
                              <a
                                href={URLS.eshopex(esh)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Ver tracking
                              </a>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                            <div className="text-sm">{esh || '-'}</div>
                          </td>
                          <td className="p-2">
                            <div className="text-sm font-medium">
                              {estatusEsho || 'No hay informacion'}
                            </div>
                          </td>
                          <td className="p-2">
                            <div className="text-sm">{fecha}</div>
                            {isReady && (
                              <div className="text-xs text-emerald-600 font-semibold">Listo para Recoger</div>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="text-sm">{cas || '-'}</div>
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
        </div>
      )}
      {eshopexCargaOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-6 relative mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Pendientes Eshopex</h2>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-2 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                  onClick={triggerEshopexCarga}
                  disabled={eshopexCargaLoading}
                  title="Actualizar pendientes"
                >
                  Actualizar
                </button>
                {eshopexCargaLoading && (
                  <button
                    className="px-3 py-2 rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                    onClick={() => setEshopexCargaOpen(false)}
                    title="Seguir trabajando mientras carga"
                  >
                    Seguir trabajando
                  </button>
                )}
                <button
                  className="w-9 h-9 flex items-center justify-center text-xl font-bold rounded-full hover:bg-gray-100"
                  onClick={() => {
                    setEshopexCargaOpen(false);
                  }}
                  aria-label="Cerrar"
                >
                  x
                </button>
              </div>
            </div>
            {eshopexCargaLoading && (
              <div className="text-xs text-gray-500 mb-2">
                Puedes cerrar y seguir trabajando. Seguimos cargando en segundo plano.
              </div>
            )}
            {eshopexCargaLoading && (
              <div className="text-sm text-gray-600">Cargando...</div>
            )}
            {eshopexCargaError && (
              <div className="text-sm text-red-600">{eshopexCargaError}</div>
            )}
            {!eshopexCargaLoading && !eshopexCargaError && (
              eshopexPendientes.length === 0 ? (
                <div className="text-sm text-gray-500">No hay cargas pendientes.</div>
              ) : (
                <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm max-h-[60vh] overflow-y-auto">
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
                      {eshopexPendientes.map((row) => {
                        const code = String(row?.guia || '').trim();
                        const producto = productosByEshopex[code];
                        const t = producto ? getLastTracking(producto) : null;
                        const accountKey = String(row?.account || '').trim().toLowerCase();
                        const pagoKey = `${code}-${accountKey}`;
                        const pagoLoading = eshopexPagoLoading.has(pagoKey);
                        const casilleroFromAccount = accountKey ? casilleroByAccount[accountKey] : '';
                        const cas = t?.casillero || casilleroFromAccount || '-';
                        const estadoProducto = String(t?.estado || '').toLowerCase();
                        const puedeVer = producto
                          ? (estadoProducto === 'en_eshopex' || estadoProducto === 'recogido')
                          : Boolean(code && row?.fechaRecepcion);
                        return (
                          <tr key={`${code}-${row?.account || ''}`} className="border-t">
                            <td className="p-2">{producto ? (buildNombreProducto(producto) || producto.tipo) : '-'}</td>
                            <td className="p-2">{code || '-'}</td>
                            <td className="p-2">{row?.descripcion || '-'}</td>
                            <td className="p-2">{row?.peso || '-'}</td>
                            <td className="p-2">{row?.valor || '-'}</td>
                            <td className="p-2">{normalizeCargaStatus(row?.estado) || '-'}</td>
                            <td className="p-2">{row?.fechaRecepcion || '-'}</td>
                            <td className="p-2">
                              <button
                                onClick={(e) => {
                                  if (!puedeVer) return;
                                  e.stopPropagation();
                                  if (producto) {
                                    abrirFotos(producto);
                                  } else {
                                    abrirFotosManual({ trackingEshop: code, fechaRecepcion: row?.fechaRecepcion || '' });
                                  }
                                }}
                                disabled={!puedeVer}
                                className={`${puedeVer ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-600 cursor-not-allowed'} px-2 py-1 rounded`}
                                title={puedeVer ? 'Ver fotos Eshopex' : 'Fotos no disponibles para este estado'}
                              >
                                Ver foto
                              </button>
                            </td>
                            <td className="p-2">{cas}</td>
                            <td className="p-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEshopexVincularModal(row);
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
                                  handleEshopexPrepago(row);
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
              )
            )}
          </div>
        </div>
      )}
      {eshopexVincularOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-6 relative mx-4">
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
              const cas = String(casilleroByAccount[accountKey] || '').trim().toLowerCase();
              const candidates = (productos || []).filter((p) => {
                const t = getLastTracking(p);
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
                        const t = getLastTracking(p);
                        const key = `${row?.guia || ''}-vincular-${p.id}`;
                        const loading = eshopexVincularLoading.has(key);
                        return (
                          <tr key={p.id} className="border-t">
                            <td className="p-2">
                              <button
                                className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 border"
                                onClick={() => {
                                  abrirDetalle(p);
                                }}
                                title="Ver detalles del producto"
                              >
                                {p?.tipo || 'Producto'}
                              </button>
                            </td>
                            <td className="p-2">{(t?.trackingUsa || '').trim() || '-'}</td>
                            <td className="p-2">{t?.casillero || '-'}</td>
                            <td className="p-2">
                              <button
                                onClick={() => handleEshopexVincular(row, p)}
                                disabled={loading}
                                className={`${loading ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-2 py-1 rounded`}
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
      {/* Modales */}
      {modalModo === 'crear' && <ModalProducto onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'detalle' && (
        <DetallesProductoModal
          producto={productoSeleccionado}
          productosAll={productos}
          onClose={cerrarModal}
          onSaved={handleSaved}
          onSaveOutside={guardarDetalleProducto}
        />
      )}
      {modalModo === 'fotos' && (<ModalFotos producto={productoSeleccionado} onClose={cerrarModal} />)}
      {modalModo === 'marca' && (<ModalMarcaAgua onClose={cerrarModal} />)}
      {modalModo === 'fotosManual' && (
        <ModalFotosManual
          onClose={cerrarModal}
          initialTrackingEshop={fotosManualSeed.trackingEshop}
          initialFechaRecepcion={fotosManualSeed.fechaRecepcion}
        />
      )}
      {modalModo === 'costos' && <ModalCostos producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'track' && (
        <ModalTracking
          producto={productoSeleccionado}
          onClose={cerrarModal}
          onSaved={(savedTracking) => {
            applyTrackingUpdate(productoSeleccionado?.id, savedTracking);
            refreshProductos({ force: true, useCache: false, silent: true });
          }}
        />
      )}
      {modalModo === 'casillero' && (
        <ModalCasillero
          casillero={selectedCasillero}
          productos={productos}
          onClose={() => { setSelectedCasillero(null); cerrarModal(); }}
          onOpenProducto={(p) => { setProductoEnCasillero(p); setProductoSeleccionado(p); }}
        />
      )}
      {modalModo === 'venta' && (
        <ModalVenta
          producto={productoSeleccionado}
          venta={ventasMap[productoSeleccionado?.id] || null}
          onClose={cerrarModal}
          onSaved={handleVentaSaved}
        />
      )}
      {adelantoModo === 'select' && (
        <ModalAdelantarTipo
          producto={adelantoProducto}
          onClose={cerrarAdelanto}
          onVentaCompleta={() => {
            cerrarAdelanto();
            setModalModo('venta');
          }}
          onAdelanto={() => abrirAdelantoCreate(adelantoProducto)}
        />
      )}
      {adelantoModo === 'create' && (
        <ModalAdelantoCreate
          producto={adelantoProducto}
          onClose={cerrarAdelanto}
          onSaved={handleAdelantoSaved}
        />
      )}
      {adelantoModo === 'detail' && (
        <ModalAdelantoDetalle
          producto={adelantoProducto}
          adelanto={adelantoActivo}
          onClose={cerrarAdelanto}
          onCompletar={() => abrirAdelantoCompletar(adelantoProducto, adelantoActivo)}
        />
      )}
      {adelantoModo === 'complete' && (
        <ModalAdelantoCompletar
          producto={adelantoProducto}
          adelanto={adelantoActivo}
          onClose={cerrarAdelanto}
          onSaved={(venta) => handleAdelantoCompleto(venta, adelantoProducto?.id)}
        />
      )}
      {modalModo === 'calc' && (
        <ModalCalculadora
          producto={productoSeleccionado}
          onClose={cerrarModal}
        />
      )}
      {modalModo === 'casillero' && productoEnCasillero && (
        <DetallesProductoModal
          producto={productoEnCasillero}
          productosAll={productos}
          onClose={() => setProductoEnCasillero(null)}
          onSaved={handleSavedEnCasillero}
          onSaveOutside={guardarDetalleProducto}
        />
      )}
      {modalModo === 'dec' && (
        <ModalDec
          onClose={cerrarModal}
          productos={productos}   // ?o. le pasas lo que ya cargaste arriba
          loading={cargando}      // ?o. estado de carga del padre
        />
      )}
      {ventaMsgOpen && (
        <ModalVentaMensaje
          onClose={() => setVentaMsgOpen(false)}
          productos={productosVentaMensaje}
        />
      )}




    </div>
  );

}









































