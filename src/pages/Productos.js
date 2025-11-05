// src/pages/Productos.js
import React, { useState, useEffect, useCallback } from 'react';
import ModalProducto from '../components/ModalProducto';
import DetallesProductoModal from '../components/DetallesProductoModal';
import ModalCostos from '../components/ModalCostos';
import ModalTracking from '../components/ModalTracking';
import api from '../api';  // cliente fetch centralizado
import ResumenCasilleros from '../components/ResumenCasilleros';
import ModalVenta from '../components/ModalVenta';
import ModalFotos from '../components/ModalFotos2';
import ModalCalculadora from '../components/ModalCalculadora';
import ModalDec from '../components/ModalDec';
import {
  FiFileText,
  FiPackage,        // comprado_sin_tracking
  FiTruck,          // comprado_en_camino
  FiMapPin,         // en_eshopex
  FiCheckCircle,    // recogido
  FiHelpCircle      // default / desconocido
} from 'react-icons/fi';


export default function Productos({ setVista, setAnalisisBack }) {
  const cacheKey = 'productos:lastList:v1';
  const [productos, setProductos] = useState(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [modalModo, setModalModo] = useState(null); // 'crear'|'detalle'|'costos'|'track'
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  // Mapa: productoId -> última venta (o null)
  const [ventasMap, setVentasMap] = useState({});

  // Abre modal de venta (creación o lectura)
  const abrirVenta = (p) => { setProductoSeleccionado(p); setModalModo('venta'); };
  const abrirCalculadora = (p) => { setProductoSeleccionado(p); setModalModo('calc'); };

  const abrirFotos = (p) => {
    // Log de depuración al abrir el modal de fotos
    const fecha = p?.valor?.fechaCompra || '';
    const trackingEshop = (p?.tracking || []).map(t => t?.trackingEshop).find(v => v && String(v).trim()) || '';
    console.log('[Productos] Ver foto →', { id: p?.id, fechaCompra: fecha, trackingEshop });
    setProductoSeleccionado(p);
    setModalModo('fotos');
  };
  // Cuando se guarda una venta, refrescamos sólo ese producto en el mapa
  const handleVentaSaved = (ventaGuardada) => {
    setVentasMap(prev => ({ ...prev, [ventaGuardada.productoId]: ventaGuardada }));
    cerrarModal();
  };

  const fmtSoles = (v) => (v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '-');

  // === Selección (Importar recojo / Recojo masivo) ===
  const [selectMode, setSelectMode] = useState(false);
  const [selectAction, setSelectAction] = useState(null); // 'whatsapp' | 'pickup' | 'adelantar'
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [pickupDate, setPickupDate] = useState(''); // YYYY-MM-DD
  const [soloDisponibles, setSoloDisponibles] = useState(false);
  // Filtros adicionales
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'macbook' | 'ipad' | 'pantalla' | 'otro'
  const [filtroProc, setFiltroProc] = useState('todos'); // procesador o pantalla (texto libre)
  const [filtroTam, setFiltroTam] = useState('todos');   // tamano adicional para macbook/ipad
  const [trackingQuery, setTrackingQuery] = useState('');

  // Helper: lee tamano desde detalle (soporta 'tamano' | 'tamanio' | 'tamano')
  const getTam = (d) => {
    if (!d) return '';
    const v = (d['tamaño'] ? String(d['tamaño']).trim() : '');
    return v;
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

  // Opciones disponibles de procesador (macbook/ipad) o tamaño (pantalla)
  const opcionesProc = React.useMemo(() => {
    const tipo = String(filtroTipo || '').toLowerCase();
    const set = new Set();
    if (tipo === 'macbook' || tipo === 'ipad') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
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
  }, [productos, filtroTipo]);

  // Opciones de tamano para macbook/ipad
  const opcionesTam = React.useMemo(() => {
    const tipo = String(filtroTipo || '').toLowerCase();
    const proc = String(filtroProc || '').toLowerCase();
    const set = new Set();
    if (tipo === 'macbook' || tipo === 'ipad') {
      for (const p of productos || []) {
        if (String(p.tipo || '').toLowerCase() !== tipo) continue;
        const procP = String(p.detalle?.procesador || '').toLowerCase();
        if (proc !== 'todos' && procP !== proc) continue;
        const val = getTam(p.detalle || {});
        if (val) set.add(val);
      }
    }
    return Array.from(set);
  }, [productos, filtroTipo, filtroProc]);

  // Si el tipo seleccionado ya no existe, resetea a 'todos'
  React.useEffect(() => {
    if (filtroTipo !== 'todos' && !tiposDisponibles.includes(filtroTipo)) {
      setFiltroTipo('todos');
      setFiltroProc('todos');
    }
  }, [tiposDisponibles, filtroTipo]);

  // Reemplaza ambos startImport() / startMassPickup() por:
  const startRecojo = () => {
    setSelectMode(true);
    setSelectAction('recojo'); // flujo único
    setSelectedIds(new Set());
    setPickupDate('');
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

  // Nombre del producto para el texto (iPad, Air, M2, 11) o "Otros" con descripción
  const buildNombreProducto = (p) => {
    if (!p) return '';
    if (p.tipo === 'otro') return (p.detalle?.descripcionOtro || '').trim() || 'Otros';
    const parts = [
      p.tipo,
      p.detalle?.gama,
      p.detalle?.procesador,
      (p.detalle || {})['tamaño']
    ].filter(Boolean);
    return parts.join(' ');
  };

  // Acción ACEPTAR (flujo único: marcar recogidos + WhatsApp)
  const confirmAction = async () => {
    const items = productos.filter(p => selectedIds.has(p.id));
    if (items.length === 0) { alert('Selecciona al menos un producto.'); return; }

    if (selectAction === 'recojo') {
      if (!pickupDate) { alert('Elige una fecha de recojo.'); return; }

      try {
        // 1) Marca todos como 'recogido' con la misma fecha
        await Promise.all(items.map(p =>
          api.put(`/tracking/producto/${p.id}`, {
            estado: 'recogido',
            fechaRecogido: pickupDate,
          })
        ));

        // 2) Genera texto para WhatsApp
        const lineas = items.map(p => {
          const t = p.tracking?.[0] || {};
          const esh = (t.trackingEshop || '').trim(); // puede ser vacío
          const cas = t.casillero || '';
          const nombre = buildNombreProducto(p);
          return `${esh} | ${nombre} | Casillero: ${cas}`;
        });

        const url = `https://wa.me/+51938597478?text=${encodeURIComponent(lineas.join('\n'))}`;

        // 3) Refresca productos
        await refreshProductos();

        // 4) Abre WhatsApp
        window.open(url, '_blank', 'noopener,noreferrer');

        // 5) Salir del modo selección
        cancelSelect();
        return;
      } catch (e) {
        console.error(e);
        alert('No se pudo completar el recojo de algunos productos.');
        return;
      }
    }

    // (se mantiene el caso 'adelantar' tal cual ya lo tienes)
    if (selectAction === 'adelantar') {
      const itemsSel = productos.filter(p => selectedIds.has(p.id));
      if (itemsSel.length !== 1) { alert('Selecciona exactamente un producto.'); return; }
      const p = itemsSel[0];
      setProductoSeleccionado(p);
      setModalModo('venta');
      cancelSelect();
      return;
    }
  };





  // ===== Helpers de Tracking (sin heurística) =====
  const labelFromEstado = (estado) => {
    switch (estado) {
      case 'comprado_sin_tracking': return 'Sin Tracking';
      case 'comprado_en_camino': return 'En Camino';
      case 'en_eshopex': return 'Eshopex';
      case 'recogido': return 'Recogido';
      default: return '-';
    }
  };

  // Colores Tailwind por estado
  const badgeClasses = (estado) => {
    switch (estado) {
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
  const emojiFromEstado = (estado) => {
    switch (estado) {
      case 'comprado_sin_tracking':
        return <span role="img" aria-label="Paquete" className="text-xl">📦</span>;
      case 'comprado_en_camino':
        return <span role="img" aria-label="Camión" className="text-xl">🚚</span>;
      case 'en_eshopex':
        return <span role="img" aria-label="Pin" className="text-xl">📍</span>;
      case 'recogido':
        return <span role="img" aria-label="Check" className="text-xl">✅</span>;
      default:
        return <span role="img" aria-label="Desconocido" className="text-xl">❔</span>;
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

  // Construye el link según estado y datos
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
  // SWR helpers: cache + refresh
  const saveCache = (lista) => {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(lista));
      localStorage.setItem(`${cacheKey}:ts`, String(Date.now()));
    } catch {}
  };

  const refreshProductos = useCallback(async () => {
    setCargando(productos.length === 0);
    setError(null);
    try {
      const data = await api.get('/productos');
      const lista = Array.isArray(data)
        ? data
        : (Array.isArray(data?.items) ? data.items : []);
      setProductos(lista);
      saveCache(lista);
      return lista;
    } catch (e) {
      console.error('Error cargando /productos:', e);
      const msg = (e && e.message) ? String(e.message) : '';
      setError(`No se pudieron cargar los productos. ${msg}`);
      return null;
    } finally {
      setCargando(false);
    }
  }, [productos.length]);

  // Carga inicial con SWR: muestra snapshot y revalida en segundo plano
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await refreshProductos();
    })();
    return () => { mounted = false; };
  }, [refreshProductos]);  // Cargar última venta por producto (si existe) cuando cambia la lista
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!Array.isArray(productos) || productos.length === 0) return;
      try {
        const entries = await Promise.all(
          productos.map(async (p) => {
            try {
              const data = await api.get(`/ventas/producto/${p.id}`);
              // Normaliza: array directo | {items:[]} | {data:[]}
              const arr = Array.isArray(data)
                ? data
                : (Array.isArray(data?.items) ? data.items
                  : (Array.isArray(data?.data) ? data.data : []));
              const ultima = arr.length > 0 ? arr[0] : null;
              return [p.id, ultima];
            } catch (err) {
              console.warn('ventas/producto error', p.id, err);
              return [p.id, null];
            }
          })
        );
        if (!mounted) return;
        const map = {};
        entries.forEach(([id, v]) => { map[id] = v; });
        setVentasMap(map);
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

    let list = Array.isArray(productos) ? [...productos] : [];
    // --- Filtro por tracking (USA / Eshopex) ---
    const q = String(trackingQuery || '').trim().toLowerCase();
    if (q) {
      // versión solo-dígitos para casos donde pegas un código largo que contiene el real
      const qDigits = q.replace(/\D+/g, '');

      list = list.filter((p) => {
        const t = p.tracking?.[0] || {};
        const usa = String(t.trackingUsa || '').trim().toLowerCase();
        const esh = String(t.trackingEshop || '').trim().toLowerCase();

        const usaDigits = usa.replace(/\D+/g, '');
        const eshDigits = esh.replace(/\D+/g, '');

        // Coincidencias en ambos sentidos:
        // - normal: usa/esh contienen q  O q contiene usa/esh
        // - solo-dígitos: usaDigits/eshDigits contienen qDigits  O qDigits contiene usaDigits/eshDigits
        const match =
          (usa && (usa.includes(q) || q.includes(usa))) ||
          (esh && (esh.includes(q) || q.includes(esh))) ||
          (qDigits && usaDigits && (usaDigits.includes(qDigits) || qDigits.includes(usaDigits))) ||
          (qDigits && eshDigits && (eshDigits.includes(qDigits) || qDigits.includes(eshDigits)));

        return Boolean(match);
      });
    }


    if (soloDisponibles) {
      list = list.filter((p) => {
        const t = p.tracking?.[0];
        const venta = ventasMap[p.id] || null;
        return t?.estado === 'recogido' && !venta;
      });
    }

    // Filtro por tipo ("otro" = todo lo que NO es macbook ni ipad)
    if (filtroTipo !== 'todos') {
      const matchTipo = (tipo) => {
        const t = String(tipo || '').toLowerCase().trim();
        if (filtroTipo === 'otro') {
          return t !== 'macbook' && t !== 'ipad';
          // Si NO quieres incluir "pantalla" dentro de "otros", usa:
          // return t !== 'macbook' && t !== 'ipad' && t !== 'pantalla';
        }
        return t === filtroTipo;
      };
      list = list.filter((p) => matchTipo(p.tipo));
    }

    // Subfiltros por procesador y tamaño (según tipo)
    if (filtroTipo !== 'todos') {
      const procTerm = String(filtroProc || '').toLowerCase();
      const tamTerm = String(filtroTam || '').toLowerCase();

      list = list.filter((p) => {
        const tipo = String(p.tipo || '').toLowerCase();
        const d = p.detalle || {};

        if (tipo === 'macbook' || tipo === 'ipad') {
          // Filtro por procesador (si aplica)
          if (procTerm !== 'todos') {
            const proc = String(d.procesador || '').toLowerCase();
            if (proc !== procTerm) return false;
          }
          // Filtro por tamaño (si aplica)
          if (tamTerm !== 'todos') {
            const tam = String(getTam(d) || '').toLowerCase();
            if (tam !== tamTerm) return false;
          }
          return true;
        }

        if (tipo === 'pantalla') {
          // Para Pantalla, el selector "Procesador" es en realidad el tamaño
          if (procTerm !== 'todos') {
            const tam = String(getTam(d) || '').toLowerCase();
            return tam === procTerm;
          }
          return true;
        }

        // Otros tipos no tienen subfiltros
        return true;
      });
    }


    list.sort((a, b) => ts(b) - ts(a)); // más nuevos arriba
    return list;
  }, [productos, ventasMap, soloDisponibles, filtroTipo, filtroProc, filtroTam, trackingQuery]);





  const abrirCrear = () => { setProductoSeleccionado(null); setModalModo('crear'); };
  const abrirDetalle = (p) => { setProductoSeleccionado(p); setModalModo('detalle'); };
  const abrirCostos = (p) => { setProductoSeleccionado(p); setModalModo('costos'); };
  const abrirTrack = (p) => { setProductoSeleccionado(p); setModalModo('track'); };
  const abrirDec = (p) => { setProductoSeleccionado(p); setModalModo('dec'); };
  const cerrarModal = () => { setModalModo(null); setProductoSeleccionado(null); };

  const handleSaved = (updated) => {
    setProductos(list =>
      modalModo === 'crear'
        ? [updated, ...list]
        : list.map(p => (p.id === updated.id ? updated : p))
    );
    cerrarModal();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try {
      await api.del(`/productos/${id}`);
      setProductos(list => list.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error al eliminar.');
    }
  };

  // === CONTADORES ===
  const stats = React.useMemo(() => {
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

      if (!t || estado === 'comprado_sin_tracking') sinTracking++;
      if (estado === 'comprado_en_camino') enCamino++;
      if (estado === 'en_eshopex') enEshopex++;

      if (venta) {
        vendido++;
      } else if (estado === 'recogido') {
        disponible++;
      }
    }

    return { total, sinTracking, enCamino, enEshopex, disponible, vendido };
  }, [productos, ventasMap]);

  // Convierte "S/ 1,234.50" o "$ 99" a número seguro
  const toNumber = (x) => {
    if (x == null || x === '') return 0;
    if (typeof x === 'number') return x;
    if (typeof x === 'string') {
      const clean = x.replace(/[^\d.-]/g, ''); // quita S/, $, comas, espacios
      const n = Number(clean);
      return isNaN(n) ? 0 : n;
    }
    return 0;
  };
  // Lee el monto de la venta en S/ sin importar el nombre/caso/anidación
  const getMontoVentaSoles = (venta) => {
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
  };



  // === TOTALES DE MONTOS ===
  // Suma global de valorProducto ($), costoEnvio (S/), costoTotal (S/), total vendido (S/), y ganancia (S/)
  const totals = React.useMemo(() => {
    let totalGastadoUSD = 0;   // suma de valorProducto ($)
    let totalEnvioSoles = 0;   // suma de costoEnvio (S/)
    let totalDecUSD = 0;
    let totalCostoSoles = 0;   // suma de costoTotal (S/)
    let totalVentaSoles = 0;   // suma de venta (S/) sólo si existe registro de venta
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
  }, [productos, ventasMap]);



  return (
    <div className="min-h-screen p-8 bg-macGray text-macDark">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold">Gesti&oacute;n de Productos</h2>
        <button onClick={() => setVista('home')} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">
          &larr; Volver
        </button>
      </header>

      {/* Resumen de conteos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
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
      <ResumenCasilleros productos={productos} />

      {/* Totales de montos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total gastado ($)</div>
          <div className="text-2xl font-semibold">{totals.totalGastadoUSD}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total env&iacute;o (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalEnvioSoles}</div>
        </div> {/* ✅ cierre agregado aquí */}
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
            <div className="flex items-center gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={soloDisponibles}
                  onChange={(e) => setSoloDisponibles(e.target.checked)}
                />
                Mostrar listos venta
              </label>

              <input
                type="text"
                className="border rounded px-2 py-1"
                placeholder="Buscar tracking (USA/Eshopex)"
                value={trackingQuery}
                onChange={(e) => setTrackingQuery(e.target.value)}
              />



              <label className="text-sm inline-flex items-center gap-2">
                <span>Tipo</span>
                <select
                  className="border rounded px-2 py-1"
                  value={filtroTipo}
                  onChange={(e) => { setFiltroTipo(e.target.value); setFiltroProc('todos'); setFiltroTam('todos'); }}
                >
                  <option value="todos">Todos</option>
                  {tiposDisponibles.includes('macbook') && <option value="macbook">MacBook</option>}
                  {tiposDisponibles.includes('ipad') && <option value="ipad">iPad</option>}
                  {tiposDisponibles.includes('pantalla') && <option value="pantalla">Pantalla</option>}
                  {tiposDisponibles.includes('otro') && <option value="otro">Otros</option>}
                </select>
              </label>

              {(filtroTipo === 'macbook' || filtroTipo === 'ipad' || filtroTipo === 'pantalla') && (
                <label className="text-sm inline-flex items-center gap-2">
                  <span>{filtroTipo === 'pantalla' ? 'Pantalla' : 'Procesador'}</span>
                  <select
                    className="border rounded px-2 py-1"
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
                <label className="text-sm inline-flex items-center gap-2">
                  <span>Tamaño</span>
                  <select
                    className="border rounded px-2 py-1"
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
            <div className="flex gap-2 justify-end">
              {/* Análisis a la izquierda, con m\u00e1s separaci\u00f3n del siguiente */}
              <button
                onClick={() => { setAnalisisBack('productos'); setVista('analisis'); }}
                className="bg-slate-600 text-white px-5 py-2 rounded hover:bg-slate-700 mr-6"
                title="Ir al m\u00f3dulo de Análisis"
              >
                Análisis
              </button>
              <button
                onClick={startAdelantarVenta}
                className="bg-amber-600 text-white px-5 py-2 rounded hover:bg-amber-700"
                title="Selecciona 1 producto no vendido para registrar la venta"
              >
                Adelantar venta
              </button>
              <button
                onClick={abrirCrear}
                className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700"
              >
                Agregar Producto
              </button>
              <button
                onClick={startRecojo}
                className="bg-purple-600 text-white px-5 py-2 rounded hover:bg-purple-700"
                title="Selecciona varios y marcar como recogidos + generar texto para WhatsApp"
              >
                Recojo
              </button>

              <button
                onClick={abrirDec}
                className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900 inline-flex items-center gap-2"
                title="Generar DEC / Comprobante"
              >
                <FiFileText className="text-lg" />
                DEC
              </button>
            </div>
          </>
        ) : (
          // �?� tu bloque existente de selección (pickup/whatsapp) se mantiene igual
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
                    Al aceptar: marcará como <b>Recogido</b> y abrirá WhatsApp con el listado.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
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
          <table className="w-full text-left border">
            <thead className="bg-gray-100">
              <tr>
                {selectMode && <th className="p-2">Sel.</th>}
                <th className="p-2">Tipo</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Accesorios</th>
                <th className="p-2">Valor $</th>
                <th className="p-2">Valor S/</th>
                <th className="p-2">Envío S/</th>
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
                const t = p.tracking?.[0]; // Primer tracking (si existe)
                const label = labelFromEstado(t?.estado);
                const link = buildTrackingLink(t);
                const estado = t?.estado || '';
                const venta = ventasMap[p.id] || null;

                // Solo seleccionable en Recojo si está en Eshopex
                const canSelectRecojo = selectAction === 'recojo' ? estado === 'en_eshopex' : true;

                // En adelantar, tu regla de 1 y no vendido; en recojo, bloquear si no es Eshopex
                const disabledSel = selectAction === 'adelantar'
                  ? (!!venta || (selectedIds.size >= 1 && !selectedIds.has(p.id)))
                  : !canSelectRecojo;

                const isSelected = selectedIds.has(p.id);



                const tRow = t;

                const esh = (tRow?.trackingEshop || '').trim();

                // Selección deshabilitada solo para 'adelantar' (ya vendido o ya hay otro marcado)

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
                        {(() => {
                          const esh = p.tracking?.[0]?.trackingEshop?.trim() || '';
                          const venta = ventasMap[p.id] || null;
                          const isAdelantar = selectAction === 'adelantar';
                          // Reglas:
                          // - whatsapp/pickup: requiere tracking eshopex
                          // - adelantar: no permite productos ya vendidos y restringe a 1 selección
                          const disabled = isAdelantar
                            ? (!!venta || (selectedIds.size >= 1 && !selectedIds.has(p.id)))
                            : (!esh);

                          return (
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


                          );
                        })()}
                      </td>
                    )}



                    <td className="p-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirDetalle(p); }}
                        className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                      >
                        {p.tipo}
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
                      {/* Pill/ botón de estado: más grande, negrita y �?oclickable�?� */}
                      <button
                        onClick={(e) => { e.stopPropagation(); abrirTrack(p); }}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${badgeClasses(t?.estado)}`}
                        title="Abrir tracking"
                      >
                        {emojiFromEstado(t?.estado)}
                        {label}
                      </button>



                      {/* Casillero más visible (más grande + negrita) */}
                      <div className="mt-1 text-sm font-semibold text-gray-800">
                        {t?.casillero ? `Casillero: ${t.casillero}` : 'Casillero: N/A'}
                      </div>

                      {/* Enlace dinámico debajo */}
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

                      {/* Transportista + tracking USA, separados para copiar fácilmente */}
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
                        const recogido = t?.estado === 'recogido';

                        let text = 'En espera';
                        let className = 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-60';
                        let disabled = true;

                        if (recogido && !venta) {
                          text = 'Disponible';
                          className = 'bg-yellow-500 text-white hover:bg-yellow-600';
                          disabled = false;
                        }
                        if (venta) {
                          text = 'Vendido';
                          className = 'bg-green-600 text-white hover:bg-green-700';
                          disabled = false;
                        }

                        return (
                          <button
                            onClick={() => { if (!disabled) abrirVenta(p); }}
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
        ) : (
          <p>{soloDisponibles ? 'No hay productos disponibles para venta.' : 'No hay productos a\u00fan.'}</p>
        )
      )}

      {/* Modales */}
      {modalModo === 'crear' && <ModalProducto onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'detalle' && (
        <DetallesProductoModal
          producto={productoSeleccionado}
          onClose={cerrarModal}
          onSaved={handleSaved}
        />
      )}
            {modalModo === 'fotos' && (<ModalFotos producto={productoSeleccionado} onClose={cerrarModal} />)}
      {modalModo === 'costos' && <ModalCostos producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'track' && (
        <ModalTracking
          producto={productoSeleccionado}
          onClose={cerrarModal}
          onSaved={async () => {
            try {
              await refreshProductos();
            } catch { }
            cerrarModal();
          }}
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
      {modalModo === 'calc' && (
        <ModalCalculadora
          producto={productoSeleccionado}
          onClose={cerrarModal}
        />
      )}
      {modalModo === 'dec' && (
        <ModalDec
          onClose={cerrarModal}
          productos={productos}   // �o. le pasas lo que ya cargaste arriba
          loading={cargando}      // �o. estado de carga del padre
        />
      )}


    </div>
  );

}



































