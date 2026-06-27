import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FiArchive,
  FiCamera,
  FiCheck,
  FiEdit3,
  FiEye,
  FiFileText,
  FiHome,
  FiImage,
  FiRefreshCw,
  FiSearch,
  FiShoppingBag,
  FiTrash2,
  FiUploadCloud,
  FiX,
  FiZoomIn,
  FiZoomOut,
} from 'react-icons/fi';
import api from '../api';
import parseSnImeiIds from '../utils/snImeiOcr';

const ModalFacu = lazy(() => import('../components/ModalFacu'));

const ACCESORIOS = [
  'Caja',
  'Cubo',
  'Cable',
  'Case',
  'Funda',
  'Cubo fake',
  'Cable fake',
  'Magic Keyboard',
  'Keyboard Logitech',
  'Ninguno',
];

const EMPTY_FORM = {
  enAlmacen: false,
  color: '',
  ciclosBateria: '',
  saludBateria: '',
  tieneGarantia: false,
  tipoGarantia: '',
  garantiaHasta: '',
  serial: '',
  imei: '',
  imei2: '',
  accesorios: [],
  observaciones: '',
  fotosTomadas: false,
  marketplaceSubido: false,
  primerPrecioSoles: '',
  ultimoPrecioSoles: '',
};

const text = (value) => String(value ?? '').trim();
const isNewProduct = (producto) => text(producto?.estado).toLowerCase() === 'nuevo';
const formatSoles = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const buildNombre = (producto) => {
  const detalle = producto?.detalle || {};
  const tipo = text(producto?.tipo).toLowerCase();
  if (tipo === 'otro') return text(detalle.descripcionOtro) || 'Otro producto';
  if (tipo === 'iphone') {
    return ['iPhone', detalle.numero, detalle.modelo].map(text).filter(Boolean).join(' ');
  }
  if (tipo === 'watch') {
    return ['Apple Watch', detalle.gama, detalle.tamano].map(text).filter(Boolean).join(' ');
  }
  if (tipo === 'macbook') {
    return ['MacBook', detalle.gama, detalle.procesador, detalle.tamano]
      .map(text).filter(Boolean).join(' ');
  }
  if (tipo === 'ipad') {
    return ['iPad', detalle.gama, detalle.generacion, detalle.tamano]
      .map(text).filter(Boolean).join(' ');
  }
  return [producto?.tipo, detalle.modelo].map(text).filter(Boolean).join(' ') || 'Producto';
};

const buildSpecs = (producto) => {
  const d = producto?.detalle || {};
  return [d.almacenamiento, d.ram ? `${d.ram} RAM` : '', d.conexion, producto?.estado]
    .map(text)
    .filter(Boolean)
    .join(' · ');
};

const lastPickupDate = (producto) => {
  const rows = Array.isArray(producto?.tracking) ? [...producto.tracking] : [];
  rows.sort((a, b) => (b.id || 0) - (a.id || 0));
  return rows.find((row) => row?.fechaRecogido)?.fechaRecogido || '';
};

const toForm = (entry) => {
  const ficha = entry?.ficha || {};
  const sourceAccessories = Array.isArray(entry?.producto?.accesorios)
    ? entry.producto.accesorios
    : [];
  return {
    ...EMPTY_FORM,
    ...ficha,
    color: ficha.color || '',
    ciclosBateria: ficha.ciclosBateria ?? '',
    saludBateria: ficha.saludBateria ?? '',
    tieneGarantia: Boolean(ficha.tieneGarantia || ficha.tipoGarantia || ficha.garantiaHasta || ficha.garantiaDetalle),
    tipoGarantia: ficha.tipoGarantia || (/apple\s*care/i.test(ficha.garantiaDetalle || '') ? 'applecare' : (ficha.garantiaHasta ? 'limitada' : '')),
    garantiaHasta: ficha.garantiaHasta || '',
    serial: ficha.serial || '',
    imei: ficha.imei || '',
    imei2: ficha.imei2 || '',
    observaciones: ficha.observaciones || '',
    accesorios: ficha.accesorios?.length ? ficha.accesorios : sourceAccessories,
    primerPrecioSoles: ficha.primerPrecioSoles ?? '',
    ultimoPrecioSoles: ficha.ultimoPrecioSoles ?? '',
  };
};

const Pill = ({ children, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
};

export default function Inventario({ setVista }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [sortOrder, setSortOrder] = useState('newest');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [photoData, setPhotoData] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState('');
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [facuOpen, setFacuOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrCandidates, setOcrCandidates] = useState({ serials: [], imeis: [] });
  const [scanImageData, setScanImageData] = useState('');
  const [scanImageName, setScanImageName] = useState('');
  const [scanDragActive, setScanDragActive] = useState(false);
  const [isLandscape, setIsLandscape] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  ));
  const [isTablet, setIsTablet] = useState(() => (
    typeof window !== 'undefined' ? Math.min(window.innerWidth, window.innerHeight) >= 600 : false
  ));
  const [showDesktopTable, setShowDesktopTable] = useState(() => (
    typeof window !== 'undefined'
      ? window.innerWidth >= 1280 && Number(window.navigator?.maxTouchPoints || 0) === 0
      : false
  ));
  const [uncheckConfirm, setUncheckConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/inventario');
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el inventario.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const updateView = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
      setIsTablet(Math.min(window.innerWidth, window.innerHeight) >= 600);
      setShowDesktopTable(
        window.innerWidth >= 1280 && Number(window.navigator?.maxTouchPoints || 0) === 0,
      );
    };
    updateView();
    window.addEventListener('resize', updateView);
    window.addEventListener('orientationchange', updateView);
    return () => {
      window.removeEventListener('resize', updateView);
      window.removeEventListener('orientationchange', updateView);
    };
  }, []);

  const replaceFicha = (productoId, ficha) => {
    setEntries((current) => current.map((entry) => (
      entry.producto?.id === productoId ? { ...entry, ficha } : entry
    )));
    setEditing((current) => (
      current?.producto?.id === productoId ? { ...current, ficha } : current
    ));
  };

  const quickPatch = async (entry, patch) => {
    const id = entry.producto.id;
    setBusyId(id);
    setError('');
    try {
      const ficha = await api.patch(`/inventario/${id}`, patch);
      replaceFicha(id, ficha);
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el cotejo.');
    } finally {
      setBusyId(null);
    }
  };

  const requestQuickCheck = (entry, key, checked) => {
    const apply = () => quickPatch(entry, { [key]: !checked });
    if (key === 'enAlmacen' && checked) {
      setUncheckConfirm({
        message: 'Este producto está confirmado en almacén. ¿Estás seguro de quitar el cotejo?',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const requestFormCheck = (key, nextChecked) => {
    const apply = () => setForm((current) => ({ ...current, [key]: nextChecked }));
    if (key === 'enAlmacen' && !nextChecked && form.enAlmacen) {
      setUncheckConfirm({
        message: 'Este producto está confirmado en almacén. ¿Estás seguro de quitar el cotejo?',
        onConfirm: apply,
      });
      return;
    }
    apply();
  };

  const confirmStorageUncheck = () => {
    const action = uncheckConfirm?.onConfirm;
    setUncheckConfirm(null);
    action?.();
  };

  const openEditor = (entry) => {
    setEditing(entry);
    setForm(toForm(entry));
    setPhotoData('');
    setNotice('');
    setDragActive(false);
    setReviewOpen(false);
    setPhotoZoom(1);
    setOcrLoading(false);
    setOcrError('');
    setOcrCandidates({ serials: [], imeis: [] });
    setScanImageData('');
    setScanImageName('');
    setScanDragActive(false);
  };

  const openPhotoViewer = (url, nombre) => {
    if (!url) return;
    setViewerZoom(1);
    setViewingPhoto({ url, nombre });
  };

  const closePhotoViewer = () => {
    setViewingPhoto(null);
    setViewerZoom(1);
  };

  const toggleAccessory = (accessory) => {
    setForm((current) => {
      if (accessory === 'Ninguno') {
        return { ...current, accesorios: current.accesorios.includes('Ninguno') ? [] : ['Ninguno'] };
      }
      const withoutNone = current.accesorios.filter((item) => item !== 'Ninguno');
      return {
        ...current,
        accesorios: withoutNone.includes(accessory)
          ? withoutNone.filter((item) => item !== accessory)
          : [...withoutNone, accessory],
      };
    });
  };

  const handlePhotoFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNotice('Selecciona un archivo de imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice('La foto no puede superar 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoData(String(reader.result || ''));
      setForm((current) => ({ ...current, fotosTomadas: true }));
      setNotice('');
    };
    reader.readAsDataURL(file);
  };

  const choosePhoto = (event) => handlePhotoFile(event.target.files?.[0]);

  const dropPhoto = (event) => {
    event.preventDefault();
    setDragActive(false);
    handlePhotoFile(event.dataTransfer?.files?.[0]);
  };

  const handleScanFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setOcrError('La imagen temporal debe ser un archivo de imagen.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setOcrError('La imagen temporal no puede superar 8 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setScanImageData(String(reader.result || ''));
      setScanImageName(file.name || 'Imagen temporal');
      setReviewOpen(true);
      setPhotoZoom(1);
      setOcrError('');
      setOcrCandidates({ serials: [], imeis: [] });
    };
    reader.readAsDataURL(file);
  };

  const dropScanImage = (event) => {
    event.preventDefault();
    setScanDragActive(false);
    handleScanFile(event.dataTransfer?.files?.[0]);
  };

  const clearScanImage = () => {
    setScanImageData('');
    setScanImageName('');
    setReviewOpen(false);
    setPhotoZoom(1);
    setOcrError('');
    setOcrCandidates({ serials: [], imeis: [] });
  };

  const scanIdentifiers = async () => {
    if (!scanImageData) {
      setOcrError('Primero selecciona o arrastra la imagen temporal del SN/IMEI.');
      return;
    }
    setReviewOpen(true);
    setOcrLoading(true);
    setOcrError('');
    try {
      const mimeType = scanImageData.match(/^data:([^;]+);base64,/)?.[1] || 'image/jpeg';
      const result = await api.post('/ocr/vision', { imageBase64: scanImageData, mimeType });
      const parsed = parseSnImeiIds(result?.text || '');
      setOcrCandidates({
        serials: Array.isArray(parsed.serials) ? parsed.serials : [],
        imeis: Array.isArray(parsed.imeis) ? parsed.imeis : [],
      });
      setForm((current) => ({
        ...current,
        serial: current.serial || parsed.serial || '',
        imei: current.imei || parsed.imei1 || '',
        imei2: current.imei2 || parsed.imei2 || '',
      }));
      if (!parsed.serials?.length && !parsed.imeis?.length) {
        setOcrError('No se detectaron SN o IMEI claros. Amplía la foto y corrige los campos manualmente.');
      }
    } catch (err) {
      setOcrError(err?.message || 'No se pudo analizar la foto.');
    } finally {
      setOcrLoading(false);
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!editing?.producto?.id) return;
    const productoNuevo = isNewProduct(editing.producto);
    if (!productoNuevo && form.tieneGarantia && !form.tipoGarantia) {
      setNotice('Selecciona si la garantía es limitada o AppleCare.');
      return;
    }
    if (!productoNuevo && form.tieneGarantia && form.tipoGarantia === 'limitada' && !form.garantiaHasta) {
      setNotice('La garantía limitada necesita una fecha de vencimiento.');
      return;
    }
    const primerPrecioSoles = form.primerPrecioSoles === '' ? null : Number(form.primerPrecioSoles);
    if (primerPrecioSoles !== null && (!Number.isFinite(primerPrecioSoles) || primerPrecioSoles < 0)) {
      setNotice('El precio debe ser un número válido mayor o igual a 0.');
      return;
    }
    const ultimoPrecioSoles = form.ultimoPrecioSoles === '' ? null : Number(form.ultimoPrecioSoles);
    if (ultimoPrecioSoles !== null && (!Number.isFinite(ultimoPrecioSoles) || ultimoPrecioSoles < 0)) {
      setNotice('El último precio debe ser un número válido mayor o igual a 0.');
      return;
    }
    const id = editing.producto.id;
    setSaving(true);
    setNotice('');
    try {
      const payload = {
        enAlmacen: Boolean(form.enAlmacen),
        color: text(form.color) || null,
        ciclosBateria: productoNuevo || form.ciclosBateria === '' ? null : Number(form.ciclosBateria),
        saludBateria: productoNuevo || form.saludBateria === '' ? null : Number(form.saludBateria),
        primerPrecioSoles,
        ultimoPrecioSoles,
        tieneGarantia: productoNuevo ? false : Boolean(form.tieneGarantia),
        tipoGarantia: !productoNuevo && form.tieneGarantia ? form.tipoGarantia : null,
        garantiaHasta: !productoNuevo && form.tieneGarantia ? (form.garantiaHasta || null) : null,
        garantiaDetalle: null,
        serial: text(form.serial) || null,
        imei: text(form.imei) || null,
        imei2: text(form.imei2) || null,
        accesorios: form.accesorios,
        observaciones: text(form.observaciones) || null,
        fotosTomadas: Boolean(form.fotosTomadas),
        marketplaceSubido: Boolean(form.marketplaceSubido),
      };
      let ficha = await api.patch(`/inventario/${id}`, payload);
      if (photoData) ficha = await api.post(`/inventario/${id}/foto`, { dataUrl: photoData });
      replaceFicha(id, ficha);
      setEditing(null);
      setPhotoData('');
    } catch (err) {
      setNotice(err?.message || 'No se pudo guardar la ficha.');
    } finally {
      setSaving(false);
    }
  };

  const removePhoto = async () => {
    const id = editing?.producto?.id;
    if (!id || (!editing?.ficha?.fotoUrl && !photoData)) return;
    if (photoData && !editing?.ficha?.fotoUrl) {
      setPhotoData('');
      return;
    }
    setSaving(true);
    try {
      const ficha = await api.del(`/inventario/${id}/foto`);
      replaceFicha(id, ficha);
      setForm((current) => ({ ...current, fotosTomadas: false }));
      setPhotoData('');
    } catch (err) {
      setNotice(err?.message || 'No se pudo eliminar la foto.');
    } finally {
      setSaving(false);
    }
  };

  const stats = useMemo(() => ({
    total: entries.length,
    almacen: entries.filter((entry) => entry.ficha?.enAlmacen).length,
    sinFoto: entries.filter((entry) => !entry.ficha?.fotosTomadas || !entry.ficha?.fotoUrl).length,
    sinMarketplace: entries.filter((entry) => !entry.ficha?.marketplaceSubido).length,
  }), [entries]);

  const filtered = useMemo(() => {
    const needle = text(query).toLowerCase();
    const result = entries.filter((entry) => {
      const { producto, ficha } = entry;
      if (filter === 'almacen' && !ficha?.enAlmacen) return false;
      if (filter === 'pendientes' && ficha?.enAlmacen) return false;
      if (filter === 'sinFoto' && ficha?.fotosTomadas && ficha?.fotoUrl) return false;
      if (filter === 'sinMarketplace' && ficha?.marketplaceSubido) return false;
      if (!needle) return true;
      const compactCodeQuery = needle.replace(/[\s_-]+/g, '');
      const codeQueryMatch = compactCodeQuery.match(/^(?:ms(?:code)?|code)?(\d+)$/i);
      if (codeQueryMatch && Number(producto?.id) === Number(codeQueryMatch[1])) return true;
      const haystack = [
        producto?.id,
        buildNombre(producto),
        buildSpecs(producto),
        ficha?.color,
        ficha?.serial,
        ficha?.imei,
        ficha?.imei2,
        ...(ficha?.accesorios || []),
      ].join(' ').toLowerCase();
      return haystack.includes(needle);
    });

    return result.sort((a, b) => {
      const aDate = Date.parse(lastPickupDate(a.producto) || '');
      const bDate = Date.parse(lastPickupDate(b.producto) || '');
      const aHasDate = Number.isFinite(aDate);
      const bHasDate = Number.isFinite(bDate);
      if (aHasDate !== bHasDate) return aHasDate ? -1 : 1;

      const direction = sortOrder === 'oldest' ? 1 : -1;
      if (aHasDate && aDate !== bDate) return (aDate - bDate) * direction;
      return ((Number(a.producto?.id) || 0) - (Number(b.producto?.id) || 0)) * direction;
    });
  }, [entries, filter, query, sortOrder]);

  const photoPreview = photoData || editing?.ficha?.fotoUrl || '';

  return (
    <div className="min-h-screen bg-slate-50 px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-500">
              <FiArchive /> Control de almacén
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">Inventario</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              Cotejo físico de productos recogidos, disponibles y sin venta ni adelanto activo.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => setVista('home')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FiHome /> Inicio
            </button>
            <button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Actualizar
            </button>
          </div>
        </header>

        <section className="mb-5 grid grid-cols-2 gap-2.5 sm:mb-6 sm:gap-3 lg:grid-cols-4">
          {[
            ['Disponibles', stats.total, 'text-slate-950'],
            ['Confirmados en almacén', stats.almacen, 'text-emerald-700'],
            ['Sin foto completa', stats.sinFoto, 'text-amber-700'],
            ['Sin Marketplace', stats.sinMarketplace, 'text-blue-700'],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4">
              <div className="text-[11px] font-medium uppercase leading-4 tracking-wide text-slate-500 sm:text-xs">{label}</div>
              <div className={`mt-1.5 text-2xl font-bold sm:mt-2 sm:text-3xl ${tone}`}>{value}</div>
            </div>
          ))}
        </section>

        <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:flex-row xl:items-center">
          <label className="relative flex-1">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto, color, serial o IMEI" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
            <label className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600">
              Orden
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value)}
                className="h-10 cursor-pointer bg-transparent pr-1 text-sm font-semibold text-slate-800 outline-none"
                aria-label="Ordenar inventario"
              >
                <option value="newest">Más nuevos primero</option>
                <option value="oldest">Más antiguos primero</option>
              </select>
            </label>
            <button type="button" onClick={() => setFacuOpen(true)} className="inline-flex whitespace-nowrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100">
              <FiFileText /> Factura US
            </button>
            {[
              ['todos', 'Todos'], ['almacen', 'En almacén'], ['pendientes', 'Por cotejar'],
              ['sinFoto', 'Sin foto'], ['sinMarketplace', 'Sin Marketplace'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium ${filter === value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </section>

        {error && <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {loading ? (
          <div className="py-20 text-center text-sm text-slate-500">Cargando productos disponibles...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-20 text-center text-sm text-slate-500">No hay productos que coincidan con este filtro.</div>
        ) : (
          <>
          {showDesktopTable ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1180px] w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Producto</th>
                  <th className="px-4 py-3 text-left">Cotejo</th>
                  <th className="px-4 py-3 text-left">Datos</th>
                  <th className="px-4 py-3 text-left">Último precio</th>
                  <th className="px-4 py-3 text-left">Accesorios</th>
                  <th className="px-4 py-3 text-center">Fotos</th>
                  <th className="px-4 py-3 text-center">Marketplace</th>
                  <th className="px-4 py-3 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((entry) => {
                  const { producto, ficha } = entry;
                  const disabled = busyId === producto.id;
                  return (
                    <tr key={`row-${producto.id}`} className="hover:bg-slate-50/70">
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-700">MS-{producto.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-950">{buildNombre(producto)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{buildSpecs(producto) || 'Sin especificaciones'}</div>
                        <div className="mt-0.5 text-xs text-slate-400">Recogido: {lastPickupDate(producto) || 'Sin fecha'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 font-medium text-slate-700 hover:bg-slate-100">
                           <input type="checkbox" checked={Boolean(ficha?.enAlmacen)} disabled={disabled} onChange={() => requestQuickCheck(entry, 'enAlmacen', Boolean(ficha?.enAlmacen))} className="h-6 w-6 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-500" />
                          {ficha?.enAlmacen ? 'En almacén' : 'Por cotejar'}
                        </label>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        <div>{ficha?.color || 'Color pendiente'}</div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {ficha?.ciclosBateria != null ? `${ficha.ciclosBateria} ciclos` : 'Ciclos —'} · {ficha?.saludBateria != null ? `${ficha.saludBateria}% batería` : 'Salud —'}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {formatSoles(ficha?.ultimoPrecioSoles) ? (
                          <div className="font-semibold text-emerald-700">S/ {formatSoles(ficha.ultimoPrecioSoles)}</div>
                        ) : (
                          <span className="text-xs text-slate-400">Sin definir</span>
                        )}
                      </td>
                      <td className="max-w-56 px-4 py-3 text-xs text-slate-600">{(ficha?.accesorios || []).join(', ') || 'Sin registrar'}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100">
                            <input type="checkbox" aria-label={`Fotos ${buildNombre(producto)}`} checked={Boolean(ficha?.fotosTomadas)} disabled={disabled} onChange={() => quickPatch(entry, { fotosTomadas: !ficha?.fotosTomadas })} className="h-6 w-6 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-500" />
                          </label>
                          {ficha?.fotoUrl ? (
                            <button type="button" onClick={() => openPhotoViewer(ficha.fotoUrl, buildNombre(producto))} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                              <FiEye /> Ver foto
                            </button>
                          ) : (
                            <button type="button" onClick={() => openEditor(entry)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                              <FiCamera /> Agregar foto
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <label className="mx-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg hover:bg-slate-100">
                          <input type="checkbox" aria-label={`Marketplace ${buildNombre(producto)}`} checked={Boolean(ficha?.marketplaceSubido)} disabled={disabled} onChange={() => quickPatch(entry, { marketplaceSubido: !ficha?.marketplaceSubido })} className="h-6 w-6 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-500" />
                        </label>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button type="button" onClick={() => openEditor(entry)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"><FiEdit3 /> Completar ficha</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          ) : (
          <div className={`grid gap-3 sm:gap-4 ${isTablet ? (isLandscape ? 'grid-cols-4' : 'grid-cols-3') : 'grid-cols-1 sm:grid-cols-2'}`}>
            {filtered.map((entry) => {
              const { producto, ficha } = entry;
              const disabled = busyId === producto.id;
              return (
                <article key={producto.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md">
                  <div className="relative aspect-[16/8] bg-slate-100 sm:aspect-[16/9]">
                    {ficha?.fotoUrl ? (
                      <button type="button" onClick={() => openPhotoViewer(ficha.fotoUrl, buildNombre(producto))} className="group relative h-full w-full cursor-zoom-in bg-cover bg-center transition duration-200 hover:brightness-95" style={{ backgroundImage: `url(${ficha.fotoUrl})` }} aria-label={`Ampliar foto de ${buildNombre(producto)}`}>
                      </button>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                        <FiImage className="h-8 w-8" /><span className="text-xs">Sin foto de inventario</span>
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-lg bg-slate-950/80 px-2.5 py-1.5 font-mono text-xs font-semibold text-white shadow-sm backdrop-blur">MS-{producto.id}</span>
                  </div>
                  <div className={isTablet && !isLandscape ? 'p-3' : 'p-4'}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold leading-5 text-slate-950">{buildNombre(producto)}</h2>
                        <p className="mt-1 text-xs leading-4 text-slate-500">{buildSpecs(producto) || 'Sin especificaciones'}</p>
                      </div>
                      <Pill tone={ficha?.enAlmacen ? 'green' : 'amber'}>{ficha?.enAlmacen ? 'En almacén' : 'Por cotejar'}</Pill>
                    </div>

                    <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
                      {ficha?.color && <Pill>{ficha.color}</Pill>}
                      {ficha?.ciclosBateria != null && <Pill>{ficha.ciclosBateria} ciclos</Pill>}
                      {ficha?.saludBateria != null && <Pill>{ficha.saludBateria}% batería</Pill>}
                      {(ficha?.accesorios || []).slice(0, 3).map((item) => <Pill key={item}>{item}</Pill>)}
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <span className="text-xs font-semibold text-emerald-700">Último precio</span>
                      <span className="text-base font-bold text-emerald-800">
                        {formatSoles(ficha?.ultimoPrecioSoles) ? `S/ ${formatSoles(ficha.ultimoPrecioSoles)}` : 'Sin definir'}
                      </span>
                    </div>

                    <div className={`mt-4 grid grid-cols-3 border-y border-slate-100 ${isTablet && !isLandscape ? 'gap-1 py-2' : 'gap-2 py-3'}`}>
                      {[
                        ['enAlmacen', <FiArchive />, 'Almacén', Boolean(ficha?.enAlmacen)],
                        ['fotosTomadas', <FiCamera />, 'Fotos', Boolean(ficha?.fotosTomadas)],
                        ['marketplaceSubido', <FiShoppingBag />, 'Marketplace', Boolean(ficha?.marketplaceSubido)],
                      ].map(([key, icon, label, checked]) => (
                        <label key={key} className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border text-center font-semibold transition active:scale-[0.98] ${isTablet && !isLandscape ? 'min-h-14 px-1 py-2 text-[10px]' : 'min-h-16 p-2 text-[11px]'} ${checked ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                          <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} onChange={() => requestQuickCheck(entry, key, checked)} />
                          <span className="text-lg">{checked ? <FiCheck /> : icon}</span>{label}
                        </label>
                      ))}
                    </div>

                    <div className={`mt-4 grid gap-2 ${ficha?.fotoUrl ? '' : 'grid-cols-2'}`}>
                      <span className={`text-xs text-slate-500 ${ficha?.fotoUrl ? '' : 'col-span-2'}`}>Recogido: {lastPickupDate(producto) || 'Sin fecha'}</span>
                      {!ficha?.fotoUrl && (
                        <button type="button" onClick={() => openEditor(entry)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <FiCamera /> Agregar foto
                        </button>
                      )}
                      <button type="button" onClick={() => openEditor(entry)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                        <FiEdit3 /> Completar ficha
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          )}
          </>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:p-4 lg:p-6" role="dialog" aria-modal="true" aria-label="Completar ficha de inventario" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setEditing(null); }}>
          <form onSubmit={save} className="h-[100dvh] w-full max-w-5xl overflow-y-auto bg-white shadow-2xl sm:h-auto sm:max-h-[96vh] sm:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5 sm:py-4">
              <div>
                <div className="text-xs font-medium text-slate-500">Producto #{editing.producto.id}</div>
                <h2 className="line-clamp-2 text-base font-semibold text-slate-950 sm:text-lg">{buildNombre(editing.producto)}</h2>
              </div>
              <button type="button" disabled={saving} onClick={() => setEditing(null)} className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"><FiX /></button>
            </div>

            <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[0.9fr_1.4fr] lg:gap-6">
              <div className="self-start lg:sticky lg:top-20">
                <div
                  className={`rounded-2xl border-2 border-dashed p-4 transition ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50'}`}
                  onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
                  onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
                  onDrop={dropPhoto}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200"><FiCamera /></div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900">Foto del producto</div>
                      <div className="mt-0.5 text-xs text-slate-500">{photoData ? 'Nueva foto seleccionada; se subirá al guardar.' : editing?.ficha?.fotoUrl ? 'Hay una foto guardada.' : 'Todavía no hay una foto guardada.'}</div>
                    </div>
                  </div>
                  <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-5 text-center hover:bg-slate-50">
                    <FiUploadCloud className="h-7 w-7 text-slate-500" />
                    <span className="mt-2 text-sm font-semibold text-slate-800">Arrastra la foto aquí</span>
                    <span className="mt-1 text-xs text-slate-500">o pulsa para seleccionarla</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={choosePhoto} className="sr-only" />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800">
                      <FiCamera /> {photoPreview ? 'Cambiar foto' : 'Seleccionar foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={choosePhoto} className="sr-only" />
                    </label>
                    {photoPreview && <button type="button" onClick={() => openPhotoViewer(photoPreview, buildNombre(editing.producto))} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"><FiImage /> Ver foto</button>}
                    {photoPreview && <button type="button" onClick={removePhoto} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"><FiTrash2 /> Eliminar</button>}
                  </div>
                </div>
                <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  <div className="aspect-square">
                    {false ? <img src={photoPreview} alt="Vista previa" className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400"><FiCamera className="h-10 w-10" /><span className="text-sm">Agrega la foto de cotejo</span></div>}
                  </div>
                  <div className="flex gap-2 border-t border-slate-200 bg-white p-3">
                    <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                      <FiCamera /> {photoPreview ? 'Cambiar foto' : 'Subir foto'}
                      <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={choosePhoto} className="sr-only" />
                    </label>
                    {photoPreview && <button type="button" onClick={removePhoto} className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-200 text-red-600 hover:bg-red-50" title="Eliminar foto"><FiTrash2 /></button>}
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">JPG, PNG, WEBP o HEIC. Máximo 8 MB. Se almacena en Cloudinary.</p>

                <div className="mt-5 space-y-2 rounded-2xl border border-slate-200 p-4">
                  {[
                    ['enAlmacen', 'Confirmado físicamente en almacén'],
                    ['fotosTomadas', 'Sesión de fotos terminada'],
                    ['marketplaceSubido', 'Publicado en Marketplace'],
                  ].map(([key, label]) => (
                    <label key={key} className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
                      {label}<input type="checkbox" checked={Boolean(form[key])} onChange={(event) => requestFormCheck(key, event.target.checked)} className="h-7 w-7 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-500" />
                    </label>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-950">Identificar SN / IMEI por foto</div>
                  <p className="mt-1 text-xs text-slate-500">Usa una imagen independiente y temporal. No se guarda ni se sube a Cloudinary.</p>
                  <label
                    className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-5 text-center transition ${scanDragActive ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                    onDragEnter={(event) => { event.preventDefault(); setScanDragActive(true); }}
                    onDragOver={(event) => { event.preventDefault(); setScanDragActive(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setScanDragActive(false); }}
                    onDrop={dropScanImage}
                  >
                    <FiSearch className="h-6 w-6 text-violet-600" />
                    <span className="mt-2 text-sm font-semibold text-slate-800">{scanImageData ? 'Reemplazar imagen del escáner' : 'Arrastra la imagen del SN/IMEI'}</span>
                    <span className="mt-1 max-w-xs truncate text-xs text-slate-500">{scanImageName || 'o pulsa para seleccionar una imagen temporal'}</span>
                    <input aria-label="Imagen temporal para escanear" type="file" accept="image/*" onChange={(event) => handleScanFile(event.target.files?.[0])} className="sr-only" />
                  </label>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={scanIdentifiers} disabled={!scanImageData || ocrLoading} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <FiSearch /> {ocrLoading ? 'Analizando...' : 'Detectar SN / IMEI'}
                    </button>
                    {scanImageData && <button type="button" onClick={() => setReviewOpen((current) => !current)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><FiZoomIn /> {reviewOpen ? 'Ocultar lupa' : 'Revisar con lupa'}</button>}
                    {scanImageData && <button type="button" onClick={clearScanImage} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"><FiTrash2 /> Quitar imagen temporal</button>}
                  </div>

                  {ocrError && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{ocrError}</div>}

                  {(ocrCandidates.serials.length > 0 || ocrCandidates.imeis.length > 0) && (
                    <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Todos los detectados</div>
                      {ocrCandidates.serials.length > 0 && (
                        <div>
                          <div className="mb-1 text-xs font-medium text-slate-600">Seriales</div>
                          <div className="flex flex-wrap gap-1.5">
                            {ocrCandidates.serials.map((serial) => <button key={serial} type="button" onClick={() => setForm((current) => ({ ...current, serial }))} className="rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs text-slate-800 hover:border-blue-400 hover:bg-blue-50" title="Usar como Serial">{serial}</button>)}
                          </div>
                        </div>
                      )}
                      {ocrCandidates.imeis.length > 0 && (
                        <div>
                          <div className="mb-1 text-xs font-medium text-slate-600">IMEIs</div>
                          <div className="space-y-1.5">
                            {ocrCandidates.imeis.map((imei) => (
                              <div key={imei} className="flex flex-wrap items-center gap-1.5 rounded-lg bg-white p-2 ring-1 ring-slate-200">
                                <span className="mr-auto font-mono text-xs text-slate-800">{imei}</span>
                                <button type="button" onClick={() => setForm((current) => ({ ...current, imei }))} className="rounded bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100">Usar en IMEI 1</button>
                                <button type="button" onClick={() => setForm((current) => ({ ...current, imei2: imei }))} className="rounded bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-700 hover:bg-violet-100">Usar en IMEI 2</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {reviewOpen && scanImageData && (
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
                      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-2 py-2 text-white">
                        <span className="text-xs font-medium">Lupa · {Math.round(photoZoom * 100)}%</span>
                        <div className="flex gap-1">
                          <button type="button" aria-label="Alejar foto" onClick={() => setPhotoZoom((value) => Math.max(1, Number((value - 0.5).toFixed(1))))} disabled={photoZoom <= 1} className="flex h-8 w-8 items-center justify-center rounded bg-white/10 hover:bg-white/20 disabled:opacity-30"><FiZoomOut /></button>
                          <button type="button" onClick={() => setPhotoZoom(1)} className="rounded bg-white/10 px-2 text-[11px] font-semibold hover:bg-white/20">100%</button>
                          <button type="button" aria-label="Ampliar foto" onClick={() => setPhotoZoom((value) => Math.min(5, Number((value + 0.5).toFixed(1))))} disabled={photoZoom >= 5} className="flex h-8 w-8 items-center justify-center rounded bg-white/10 hover:bg-white/20 disabled:opacity-30"><FiZoomIn /></button>
                        </div>
                      </div>
                      <div className="max-h-[26rem] overflow-auto">
                        <img src={scanImageData} alt="Revisión ampliada para SN e IMEI" draggable={false} className="block h-auto object-contain" style={{ width: `${photoZoom * 100}%`, maxWidth: 'none' }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-5">
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-950">Identificación y condición</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs font-medium text-slate-600">Color<input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Ej. Azul Sierra" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                    <label className="text-xs font-medium text-slate-600">Serial<input value={form.serial} onChange={(e) => setForm({ ...form, serial: e.target.value })} placeholder="Número de serie" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:border-slate-400" /></label>
                    <label className="text-xs font-medium text-slate-600">IMEI 1<input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} placeholder="IMEI principal" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:border-slate-400" /></label>
                    <label className="text-xs font-medium text-slate-600">IMEI 2<input value={form.imei2} onChange={(e) => setForm({ ...form, imei2: e.target.value })} placeholder="Segundo IMEI si corresponde" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 font-mono text-sm outline-none focus:border-slate-400" /></label>
                    {!isNewProduct(editing.producto) && (
                      <>
                        <label className="text-xs font-medium text-slate-600">Ciclos de batería<input type="number" min="0" max="100000" value={form.ciclosBateria} onChange={(e) => setForm({ ...form, ciclosBateria: e.target.value })} placeholder="Ej. 145" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                        <label className="text-xs font-medium text-slate-600">Salud de batería (%)<input type="number" min="0" max="100" value={form.saludBateria} onChange={(e) => setForm({ ...form, saludBateria: e.target.value })} placeholder="Ej. 92" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" /></label>
                      </>
                    )}
                    <div className="text-xs font-medium text-slate-600">
                      <label htmlFor="inventario-primer-precio">Precio (S/)</label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">S/</span>
                        <input id="inventario-primer-precio" type="number" min="0" step="0.01" inputMode="decimal" value={form.primerPrecioSoles} onChange={(e) => setForm({ ...form, primerPrecioSoles: e.target.value })} placeholder="Ingresar precio" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-slate-400" />
                      </div>
                    </div>
                    <div className="text-xs font-medium text-slate-600">
                      <label htmlFor="inventario-ultimo-precio">Último precio (S/)</label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-500">S/</span>
                        <input id="inventario-ultimo-precio" type="number" min="0" step="0.01" inputMode="decimal" value={form.ultimoPrecioSoles} onChange={(e) => setForm({ ...form, ultimoPrecioSoles: e.target.value })} placeholder="Precio mínimo final" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none focus:border-slate-400" />
                      </div>
                    </div>
                    {!isNewProduct(editing.producto) && (
                      <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 sm:col-span-2">
                        ¿Tiene garantía?
                        <input type="checkbox" checked={Boolean(form.tieneGarantia)} onChange={(event) => setForm((current) => ({ ...current, tieneGarantia: event.target.checked, tipoGarantia: event.target.checked ? current.tipoGarantia : '', garantiaHasta: event.target.checked ? current.garantiaHasta : '' }))} className="h-7 w-7 shrink-0 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-slate-500" />
                      </label>
                    )}
                    {!isNewProduct(editing.producto) && form.tieneGarantia && (
                      <label className="text-xs font-medium text-slate-600">
                        Tipo de garantía
                        <select value={form.tipoGarantia} onChange={(event) => setForm((current) => ({ ...current, tipoGarantia: event.target.value, garantiaHasta: event.target.value === 'limitada' ? current.garantiaHasta : '' }))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-400">
                          <option value="">Seleccionar</option>
                          <option value="limitada">Garantía limitada</option>
                          <option value="applecare">AppleCare</option>
                        </select>
                      </label>
                    )}
                    {!isNewProduct(editing.producto) && form.tieneGarantia && form.tipoGarantia && (
                      <label className="text-xs font-medium text-slate-600">
                        Garantía hasta {form.tipoGarantia === 'applecare' ? '(opcional)' : ''}
                        <input required={form.tipoGarantia === 'limitada'} type="date" value={form.garantiaHasta} onChange={(e) => setForm({ ...form, garantiaHasta: e.target.value })} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-slate-400" />
                      </label>
                    )}
                    {!isNewProduct(editing.producto) && form.tieneGarantia && form.tipoGarantia === 'applecare' && (
                      <div className="flex items-center rounded-xl border border-blue-100 bg-blue-50 px-3 py-3 text-xs text-blue-800">La fecha de AppleCare es opcional.</div>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="mb-1 text-sm font-semibold text-slate-950">Accesorios incluidos</h3>
                  <p className="mb-3 text-xs text-slate-500">Marca exactamente lo que acompaña a este producto.</p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ACCESORIOS.map((accessory) => {
                      const active = form.accesorios.includes(accessory);
                      return <button key={accessory} type="button" onClick={() => toggleAccessory(accessory)} className={`flex min-h-11 items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-medium ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><span>{accessory}</span>{active && <FiCheck />}</button>;
                    })}
                  </div>
                </section>

                <label className="block text-xs font-medium text-slate-600">Observaciones<textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows="4" placeholder="Golpes, rayones, pruebas realizadas, piezas faltantes u otros datos..." className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-slate-400" /></label>

                {notice && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{notice}</div>}
              </div>
            </div>

            <div className="sticky bottom-0 grid grid-cols-2 gap-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:flex sm:justify-end sm:px-5 sm:py-4">
              <button type="button" disabled={saving} onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={saving} className="inline-flex min-h-11 min-w-36 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60">{saving ? <><FiRefreshCw className="animate-spin" /> Guardando...</> : <><FiCheck /> Guardar ficha</>}</button>
            </div>
          </form>
        </div>
      )}
      {facuOpen && (
        <Suspense fallback={null}>
          <ModalFacu onClose={() => setFacuOpen(false)} inventoryEntries={entries} inventoryMode />
        </Suspense>
      )}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[100] h-[100dvh] overflow-auto overscroll-contain bg-transparent backdrop-blur-[2px]" role="dialog" aria-modal="true" onMouseDown={(event) => { if (event.target === event.currentTarget) closePhotoViewer(); }}>
          <button type="button" onClick={closePhotoViewer} className="fixed right-3 top-3 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/75 text-2xl text-slate-900 shadow-lg ring-1 ring-black/10 backdrop-blur-md hover:bg-white sm:right-5 sm:top-5" aria-label="Cerrar foto"><FiX /></button>
          <div className="flex min-h-full min-w-full items-center justify-center p-3 sm:p-6">
            <button
              type="button"
              aria-label={viewerZoom > 1 ? 'Reducir foto' : 'Ampliar foto'}
              onClick={() => setViewerZoom((value) => (value > 1 ? 1 : 2))}
              className={`flex items-center justify-center ${viewerZoom > 1 ? 'w-[200%] min-w-[200%] cursor-zoom-out' : 'h-auto w-auto max-h-full max-w-full cursor-zoom-in'}`}
              style={{ touchAction: 'pinch-zoom' }}
            >
              <img
                src={viewingPhoto.url}
                alt={viewingPhoto.nombre}
                draggable={false}
                className={viewerZoom > 1
                  ? 'block h-auto w-full max-w-none object-contain drop-shadow-2xl'
                  : 'block h-auto w-auto max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] rounded-lg object-contain drop-shadow-2xl sm:max-h-[calc(100dvh-3rem)] sm:max-w-[calc(100vw-3rem)]'}
              />
            </button>
          </div>
        </div>
      )}
      {uncheckConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-quitar-cotejo">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/10">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700">!</div>
            <h2 id="confirmar-quitar-cotejo" className="mt-4 text-lg font-semibold text-slate-950">Confirmar cambio</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{uncheckConfirm.message}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setUncheckConfirm(null)} className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">No, mantener</button>
              <button type="button" onClick={confirmStorageUncheck} className="min-h-11 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Sí, quitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
