// src/components/ModalProducto.js
import React, { useState, useEffect, useRef } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';
import api from '../api';

const normalizeText = (val) =>
  String(val || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const PEDIDO_CLIENTS = ['Jorge', 'Rodrigo', 'Miguel', 'Carlos', 'Kenny', 'Sebastian', 'Williams'];
const OTHER_PEDIDO_SELLER = '__otro_nombre_pedido__';
const titleCaseName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
    .join(' ');
const pedidoSeller = (client) => {
  const name = titleCaseName(client);
  return name ? `Gonzalo (${name})` : '';
};
const pedidoClientFromSeller = (seller) => {
  const match = String(seller || '').trim().match(/^gonzalo\s*\(([^)]+)\)$/i);
  return match?.[1] ? match[1].trim() : '';
};

const mapEbayConditionToEstado = (condition) => {
  const c = normalizeText(condition);
  if (c === 'new') return 'nuevo';
  if (c === 'used') return 'usado';
  if (c.includes('for parts')) return 'usado';
  return 'usado';
};

const labelFromCondition = (condition) => {
  const c = normalizeText(condition);
  if (c === 'new') return 'Nuevo';
  if (c === 'used') return 'Usado';
  if (c.includes('for parts')) return 'Para piezas';
  if (!c) return '-';
  return condition;
};

const inferTipo = (title) => {
  const t = normalizeText(title);
  if (t.includes('macbook')) return 'macbook';
  if (t.includes('iphone')) return 'iphone';
  if (t.includes('ipad')) return 'ipad';
  if (t.includes('watch')) return 'watch';
  return '';
};

const inferGama = (title, tipo = '') => {
  const t = normalizeText(title);
  if (tipo === 'macbook' && /\bneo\b/.test(t)) return 'Neo';
  if (/\bpro max\b/.test(t)) return 'Pro Max';
  if (/\bpro\b/.test(t)) return 'Pro';
  if (/\bair\b/.test(t)) return 'Air';
  if (/\bmini\b/.test(t)) return 'Mini';
  if (/\bplus\b/.test(t)) return 'Plus';
  if (/\bultra\b/.test(t)) return 'Ultra';
  return '';
};

const inferIphoneMeta = (title) => {
  const t = normalizeText(title);
  const numero = (
    t.match(/\biphone\s*(\d{2})(?:\s*[a-z])?\b/) ||
    t.match(/\b(\d{2})[a-z]\b/) ||
    t.match(/\b(\d{2})\b/)
  )?.[1] || '';
  let modelo = '';
  if (/\bpro max\b/.test(t)) modelo = 'Pro Max';
  else if (/\bpro\b/.test(t)) modelo = 'Pro';
  else if (/\bplus\b/.test(t)) modelo = 'Plus';
  else if (/\bmini\b/.test(t)) modelo = 'Mini';
  else if (/\bair\b/.test(t)) modelo = 'Air';
  else if ((numero === '16' || numero === '17') && (/\biphone\s*(16|17)\s*e\b/.test(t) || /\b(16|17)e\b/.test(t))) modelo = 'E';
  else if (t.includes('iphone')) modelo = 'Normal';
  return { numero, modelo };
};

const inferWatchMeta = (title) => {
  const t = normalizeText(title);
  let gama = '';
  let generacion = '';
  let conexion = '';
  const serie = t.match(/\bseries\s*(\d{1,2})\b/);
  const ultra = t.match(/\bultra\s*(\d{1,2})\b/);
  const se = t.match(/\bse\s*(\d)?\b/);
  if (ultra) {
    gama = 'Ultra';
    generacion = ultra[1];
  } else if (serie) {
    gama = 'Series';
    generacion = serie[1];
  } else if (se) {
    gama = 'SE';
    generacion = se[1] || '';
  }
  if (t.includes('cellular') || t.includes('gps + cel') || t.includes('gps+cel')) {
    conexion = 'GPS + Cel';
  } else if (t.includes('gps')) {
    conexion = 'GPS';
  }
  const size = t.match(/\b(40|41|42|44|45|46|49)\s*mm\b/);
  const tamano = size ? `${size[1]} mm` : '';
  return { gama, generacion, conexion, tamano };
};

const inferProcesador = (title) => {
  const t = normalizeText(title);
  const a18 = t.match(/\b(a18)\s*(pro)\b/);
  if (a18) return `${a18[1].toUpperCase()} ${a18[2].charAt(0).toUpperCase()}${a18[2].slice(1)}`;
  const m = t.match(/\b(m[1-5])\s*(pro|max|ultra)?\b/);
  if (m) return `${m[1].toUpperCase()}${m[2] ? ` ${m[2].charAt(0).toUpperCase()}${m[2].slice(1)}` : ''}`.trim();
  const intel = t.match(/\b(i[3579])\b/);
  if (intel) return intel[1].toUpperCase();
  return '';
};

const inferPantalla = (title) => {
  const t = normalizeText(title);
  const m = t.match(/\b(10\.2|10\.9|11|12\.9|13\.3|13\.5|13\.6|13|14|15\.3|15|16)\b/);
  if (!m) return '';
  const rawSize = Number(m[1]);
  if (Number.isNaN(rawSize)) return '';
  if (rawSize >= 13 && rawSize < 14) return '13';
  if (rawSize >= 14 && rawSize < 15) return '14';
  if (rawSize >= 15 && rawSize < 16) return '15';
  if (rawSize >= 16 && rawSize < 17) return '16';
  return String(m[1]);
};

const inferIpadConexion = (title) => {
  const t = normalizeText(title);
  if (
    t.includes('cellular') ||
    t.includes('wifi + cel') ||
    t.includes('wifi+cel') ||
    t.includes('wi-fi + cel') ||
    t.includes('wi-fi+cel') ||
    t.includes('lte') ||
    /\b5g\b/.test(t)
  ) return 'Wifi + Cel';
  if (t.includes('wi-fi') || t.includes('wifi') || t.includes('wlan')) return 'Wifi';
  return '';
};

const normalizeIpadConexion = (value) => {
  const raw = normalizeText(value);
  if (!raw) return '';
  if (
    raw.includes('cellular') ||
    raw.includes('wifi + cel') ||
    raw.includes('wifi+cel') ||
    raw.includes('wi-fi + cel') ||
    raw.includes('wi-fi+cel') ||
    raw.includes('lte') ||
    /\b5g\b/.test(raw)
  ) return 'Wifi + Cel';
  if (raw.includes('wi-fi') || raw.includes('wifi') || raw.includes('wlan')) return 'Wifi';
  return '';
};

const inferRamFromTitle = (title) => {
  const t = normalizeText(title);
  const m =
    t.match(/(\d+)\s*gb[^a-z0-9]{0,6}ram\b/i) ||
    t.match(/(\d+)\s*gb[^a-z0-9]{0,6}unified memory\b/i) ||
    t.match(/(\d+)\s*gb\b/);
  return m ? m[1] : '';
};

const inferStorageFromTitle = (title) => {
  const t = normalizeText(title);
  const m =
    t.match(/(\d+)\s*tb[^a-z0-9]{0,8}(ssd|storage|rom)?/i) ||
    t.match(/(\d+)\s*gb[^a-z0-9]{0,8}(ssd|storage|rom)?/i);
  if (!m) return '';
  const val = m[1];
  return t.includes('tb') ? `${val}TB` : val;
};

const extractStorageValue = (val) => {
  const raw = String(val || '').toUpperCase().replace(/\s+/g, '');
  if (!raw) return '';
  if (raw.includes('TB')) {
    const n = raw.match(/(\d+(?:\.\d+)?)/)?.[1] || '';
    return n ? `${n}TB` : '';
  }
  const gb = raw.match(/(\d+)\s*GB/)?.[1] || raw.match(/(\d+)/)?.[1] || '';
  return gb ? String(gb) : '';
};

const extractRamValue = (val) => {
  const raw = String(val || '').toUpperCase();
  const m = raw.match(/(\d+)\s*GB/);
  return m ? m[1] : '';
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

const repartirCantidadLote = (rows, total) => {
  const cantidadTotal = Number(total);
  if (!Number.isInteger(cantidadTotal) || cantidadTotal < 0) return rows;

  const automaticos = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => !row.cantidadFija);
  if (!automaticos.length) return rows;

  const totalFijo = rows.reduce(
    (sum, row) => sum + (row.cantidadFija ? Number(row.cantidad) || 0 : 0),
    0
  );
  const restante = Math.max(0, cantidadTotal - totalFijo);
  const base = Math.floor(restante / automaticos.length);
  const sobrante = restante % automaticos.length;
  const cantidadPorIndice = new Map(
    automaticos.map(({ index }, position) => [
      index,
      base + (position < sobrante ? 1 : 0),
    ])
  );

  return rows.map((row, index) =>
    row.cantidadFija
      ? row
      : { ...row, cantidad: cantidadPorIndice.get(index) || 0 }
  );
};

export default function ModalProducto({ producto, onClose, onSaved, onSavedBatch }) {
  const isEdit = Boolean(producto);
  const [saving, setSaving] = useState(false);
  const [loteActivo, setLoteActivo] = useState(false);
  const [vincularTodoLote, setVincularTodoLote] = useState(false);
  const [cantidadLote, setCantidadLote] = useState(2);
  const [distribucionLote, setDistribucionLote] = useState([
    { vendedor: '', pedidoCliente: '', cantidad: 2, cantidadFija: false },
  ]);
  const mountedRef = useRef(true);
  const [ebayUrl, setEbayUrl] = useState('');
  const [ebayLoading, setEbayLoading] = useState(false);
  const [ebayError, setEbayError] = useState('');
  const [ebayTitle, setEbayTitle] = useState('');
  const [ebayPrice, setEbayPrice] = useState(null);
  const [ebayShipping, setEbayShipping] = useState(null);
  const [ebayConditionRaw, setEbayConditionRaw] = useState('');
  const [linkerOpen, setLinkerOpen] = useState(false);
  const [loadingLinker, setLoadingLinker] = useState(false);
  const [linkables, setLinkables] = useState([]);
  const [pendingLinkIds, setPendingLinkIds] = useState([]);
  const [vincularConList, setVincularConList] = useState([]);
  const [desvincularEnvio, setDesvincularEnvio] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentError, setRecentError] = useState('');
  const [recentNuevo, setRecentNuevo] = useState([]);

  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    vendedor: '',
    pedidoCliente: '',
    accesorios: [],
    casillero: '',
    detalle: {
      gama: '', procesador: '', generacion: '',
      modelo: '', tamano: '',
      almacenamiento: '', ram: '',
      conexion: '', descripcionOtro: '',
    },
    valor: {
      valorProducto: '', valorDec: '',
      peso: '', fechaCompra: '',
    },
  });

  const getLastTrackingEstado = (p) => {
    const trk = Array.isArray(p?.tracking) ? [...p.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.id || 0) - (a.id || 0);
    });
    return String(trk[0]?.estado || '').toLowerCase();
  };

  const getCasilleroActual = () => {
    if (form.casillero) return form.casillero;
    const trk = Array.isArray(producto?.tracking) ? [...producto.tracking] : [];
    if (!trk.length) return '';
    trk.sort((a, b) => {
      if (a.createdAt && b.createdAt) return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return (b.id || 0) - (a.id || 0);
    });
    return trk[0]?.casillero || '';
  };

  useEffect(() => {
    if (!isEdit) return;
    const detalle = { ...(producto.detalle || {}) };
    if (detalle.tamanio && !detalle.tamano) {
      detalle.tamano = detalle.tamanio;
      delete detalle.tamanio;
    }
    if (!detalle.descripcionOtro) {
      detalle.descripcionOtro = detalle.descripcion || producto.descripcion || '';
    }
    setForm({
      tipo: producto.tipo || '',
      estado: producto.estado || '',
      vendedor: producto.vendedor || '',
      pedidoCliente: pedidoClientFromSeller(producto.vendedor || ''),
      accesorios: Array.isArray(producto.accesorios) ? producto.accesorios : [],
      casillero: producto.tracking?.[0]?.casillero || '',
      detalle,
      valor: {
        valorProducto: producto.valor?.valorProducto || '',
        valorDec: producto.valor?.valorDec || '',
        peso: producto.valor?.peso || '',
        fechaCompra: producto.valor?.fechaCompra || '',
      },
    });
    setVincularConList([]);
    setPendingLinkIds([]);
    setDesvincularEnvio(false);
    setLinkerOpen(false);
  }, [isEdit, producto]);

  useEffect(() => {
    if (isEdit) return;
    setEbayUrl('');
    setEbayLoading(false);
    setEbayError('');
    setEbayTitle('');
    setEbayPrice(null);
    setEbayShipping(null);
    setEbayConditionRaw('');
  }, [isEdit]);

  useEffect(() => {
    if (form.tipo === 'otro' && ebayTitle) {
      setForm((f) => ({
        ...f,
        detalle: { ...f.detalle, descripcionOtro: ebayTitle },
      }));
    }
  }, [form.tipo, ebayTitle]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!producto?.envioGrupoId) {
      return;
    }
    api.get('/productos').then((res) => {
      const data = res?.data || res || [];
      // precarga para evitar llamada extra cuando se abre el vinculado
      void (Array.isArray(data) ? data : []).filter(
        (p) => p.envioGrupoId && p.envioGrupoId === producto.envioGrupoId && p.id !== producto.id,
      );
    }).catch(() => {});
  }, [producto?.envioGrupoId, producto?.id]);

  const onChange = (section, field, value) => {
    if (section === 'main') {
      setForm((f) => ({ ...f, [field]: value }));
    } else {
      setForm((f) => ({ ...f, [section]: { ...f[section], [field]: value } }));
    }
  };
  const onSellerChange = (value) => {
    if (value === OTHER_PEDIDO_SELLER) {
      setForm((f) => ({
        ...f,
        vendedor: f.pedidoCliente?.trim() ? pedidoSeller(f.pedidoCliente) : OTHER_PEDIDO_SELLER,
      }));
      return;
    }
    setForm((f) => ({
      ...f,
      vendedor: value,
      pedidoCliente: pedidoClientFromSeller(value),
    }));
  };
  const onPedidoClientChange = (value) => {
    setForm((f) => ({
      ...f,
      pedidoCliente: value,
      vendedor: value.trim() ? pedidoSeller(value) : OTHER_PEDIDO_SELLER,
    }));
  };
  const updateDistribucionLote = (index, changes) => {
    setDistribucionLote((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...changes } : row
      )
    );
  };
  const onLoteSellerChange = (index, value) => {
    updateDistribucionLote(index, {
      vendedor: value,
      pedidoCliente: pedidoClientFromSeller(value),
    });
  };
  const onLoteClientChange = (index, value) => {
    updateDistribucionLote(index, {
      pedidoCliente: value,
      vendedor: value.trim() ? pedidoSeller(value) : OTHER_PEDIDO_SELLER,
    });
  };
  const onCantidadLoteChange = (value) => {
    setCantidadLote(value);
    setDistribucionLote((rows) => repartirCantidadLote(rows, Number(value)));
  };
  const onCantidadDistribucionChange = (index, value) => {
    setDistribucionLote((rows) => {
      const changed = rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, cantidad: value, cantidadFija: true }
          : row
      );
      return repartirCantidadLote(changed, Number(cantidadLote));
    });
  };
  const restaurarCantidadAutomatica = (index) => {
    setDistribucionLote((rows) => {
      const changed = rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, cantidadFija: false } : row
      );
      return repartirCantidadLote(changed, Number(cantidadLote));
    });
  };
  const agregarDistribucionLote = () => {
    setDistribucionLote((rows) =>
      repartirCantidadLote(
        [
          ...rows,
          {
            vendedor: '',
            pedidoCliente: '',
            cantidad: 0,
            cantidadFija: false,
          },
        ],
        Number(cantidadLote)
      )
    );
  };
  const quitarDistribucionLote = (index) => {
    setDistribucionLote((rows) =>
      repartirCantidadLote(
        rows.filter((_, rowIndex) => rowIndex !== index),
        Number(cantidadLote)
      )
    );
  };

  const describeProducto = (p) => {
    const tipo = String(p?.tipo || '').trim();
    const d = p?.detalle || {};
    if (tipo.toLowerCase() === 'watch') {
      return ['Apple Watch', d.gama, d.generacion, d.tamano || d.tamanio, d.conexion].filter(Boolean).join(' ');
    }
    if (tipo.toLowerCase() === 'iphone') {
      return ['iPhone', d.numero, d.modelo, d.almacenamiento].filter(Boolean).join(' ');
    }
    if (tipo.toLowerCase() === 'ipad') {
      const linea = d.gama === 'Normal' ? '' : d.gama;
      const modelo = d.gama === 'Normal' || d.gama === 'Mini' ? d.generacion : d.procesador;
      const tamano = d.tamano || d.tamanio;
      const pantalla = tamano && String(tamano) !== String(modelo || '') ? tamano : '';
      return ['iPad', linea, modelo, pantalla, d.almacenamiento].filter(Boolean).join(' ');
    }
    if (tipo.toLowerCase() === 'otro') {
      return String(d.descripcionOtro || '').trim() || 'Otro';
    }
    return [tipo, d.gama, d.procesador, d.tamano || d.tamanio, d.almacenamiento].filter(Boolean).join(' ');
  };

  const getRecentTs = (p) => {
    const fechaCompra = String(p?.valor?.fechaCompra || '').trim();
    const tsCompra = fechaCompra ? Date.parse(fechaCompra) : 0;
    if (Number.isFinite(tsCompra) && tsCompra > 0) return tsCompra;
    const createdAt = String(p?.createdAt || '').trim();
    const tsCreated = createdAt ? Date.parse(createdAt) : 0;
    return Number.isFinite(tsCreated) ? tsCreated : 0;
  };

  const loadRecentNuevo = async () => {
    try {
      setRecentLoading(true);
      setRecentError('');
      const res = await api.get('/productos');
      const data = res?.data || res || [];
      const list = (Array.isArray(data) ? data : [])
        .filter((p) => String(p?.estado || '').toLowerCase() === 'nuevo')
        .sort((a, b) => getRecentTs(b) - getRecentTs(a))
        .slice(0, 15);
      setRecentNuevo(list);
    } catch (err) {
      console.error('No se pudieron cargar productos recientes', err);
      setRecentError('No se pudo cargar el listado reciente.');
    } finally {
      setRecentLoading(false);
    }
  };

  const applyRecentNuevo = (p) => {
    if (!p) return;
    const detalleSrc = { ...(p?.detalle || {}) };
    if (detalleSrc.tamanio && !detalleSrc.tamano) {
      detalleSrc.tamano = detalleSrc.tamanio;
      delete detalleSrc.tamanio;
    }
    setForm((f) => ({
      ...f,
      tipo: p?.tipo || f.tipo,
      estado: p?.estado || f.estado,
      accesorios: Array.isArray(p?.accesorios) ? [...p.accesorios] : f.accesorios,
      detalle: { ...f.detalle, ...detalleSrc },
      valor: {
        ...f.valor,
        valorProducto: p?.valor?.valorProducto ?? f.valor.valorProducto,
        // Preserve current valorDec/peso/fechaCompra and casillero as requested.
      },
    }));
    setRecentOpen(false);
  };

  const fetchEbay = async () => {
    const url = String(ebayUrl || '').trim();
    if (!url) {
      setEbayError('Ingresa un URL de eBay.');
      return;
    }
    setEbayLoading(true);
    setEbayError('');
    try {
      const data = await api.get(`/utils/ebay?url=${encodeURIComponent(url)}`);
      const price = Number.isFinite(data?.priceUSD) ? data.priceUSD : 0;
      const ship = Number.isFinite(data?.shippingUSD) ? data.shippingUSD : 0;
      const total = price + ship;
      const title = String(data?.title || '');
      const parsed = data?.titleParsed || {};
      const condition = String(data?.condition || '');

      const tipoInfer = normalizeText(parsed?.tipo || inferTipo(title));
      const tipo = tipoInfer || 'otro';
      const gama = parsed?.gama || inferGama(title, tipo);
      const proc = parsed?.proc || inferProcesador(title);
      const pantalla = parsed?.pantalla || inferPantalla(title);
      const ram = extractRamValue(parsed?.ram || '') || inferRamFromTitle(title);
      const ssd = extractStorageValue(
        parsed?.ssd ||
          parsed?.storage ||
          parsed?.almacenamiento ||
          parsed?.capacidad ||
          '',
      ) || inferStorageFromTitle(title);
      const iphoneMeta = inferIphoneMeta(title);
      const watchMeta = inferWatchMeta(title);
      const ipadConexion = normalizeIpadConexion(
        parsed?.conexion ||
          parsed?.conectividad ||
          parsed?.connectivity ||
          '',
      ) || inferIpadConexion(title);

      setEbayTitle(title);
      setEbayPrice(price);
      setEbayShipping(ship);
      setEbayConditionRaw(condition || 'used');

      setForm((f) => {
        const nextDetalle = { ...f.detalle };
        if (tipo === 'macbook') {
          nextDetalle.gama = gama || nextDetalle.gama;
          nextDetalle.procesador = proc || nextDetalle.procesador;
          nextDetalle.tamano = pantalla || nextDetalle.tamano;
          nextDetalle.ram = ram || nextDetalle.ram;
          nextDetalle.almacenamiento = ssd || nextDetalle.almacenamiento;
        } else if (tipo === 'ipad') {
          nextDetalle.gama = gama || nextDetalle.gama;
          nextDetalle.procesador = proc || nextDetalle.procesador;
          nextDetalle.tamano = pantalla || nextDetalle.tamano;
          nextDetalle.almacenamiento = ssd || nextDetalle.almacenamiento;
          nextDetalle.conexion = ipadConexion || nextDetalle.conexion;
        } else if (tipo === 'iphone') {
          nextDetalle.numero = iphoneMeta.numero || nextDetalle.numero;
          nextDetalle.modelo = iphoneMeta.modelo || nextDetalle.modelo;
          nextDetalle.almacenamiento = ssd || nextDetalle.almacenamiento;
        } else if (tipo === 'watch') {
          nextDetalle.gama = watchMeta.gama || nextDetalle.gama;
          nextDetalle.generacion = watchMeta.generacion || nextDetalle.generacion;
          nextDetalle.tamano = watchMeta.tamano || nextDetalle.tamano;
          nextDetalle.conexion = watchMeta.conexion || nextDetalle.conexion;
        } else if (tipo === 'otro') {
          nextDetalle.descripcionOtro = title || nextDetalle.descripcionOtro;
        }
        return {
          ...f,
          tipo: tipo || f.tipo,
          estado: mapEbayConditionToEstado(condition || 'used'),
          detalle: nextDetalle,
          valor: { ...f.valor, valorProducto: Number.isFinite(total) && total > 0 ? String(total) : f.valor.valorProducto },
        };
      });
    } catch (err) {
      setEbayError(extractApiError(err, 'No se pudo leer el URL. Verifica que sea un enlace de eBay.'));
    } finally {
      setEbayLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;
    setSaving(true);

    const isBatch = !isEdit && loteActivo;
    const url = isEdit ? `/productos/${producto.id}` : (isBatch ? '/productos/lote' : '/productos');
    const method = isEdit ? 'patch' : 'post';

    let accesorios = Array.isArray(form.accesorios) ? [...form.accesorios] : [];
    const hasTodos = accesorios.includes('Todos');
    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
    if (hasTodos || isNuevo) accesorios = ['Caja', 'Cubo', 'Cable'];

    const base = { tipo: form.tipo, estado: form.estado, accesorios };
    const allowedDetalle = ['gama', 'procesador', 'generacion', 'numero', 'modelo', 'tamano', 'almacenamiento', 'ram', 'conexion', 'esim', 'descripcionOtro'];
    const cleanDetalle = Object.fromEntries(
      Object.entries(form.detalle || {}).filter(([k]) => allowedDetalle.includes(k))
    );

    const vendedorPayload =
      form.vendedor === OTHER_PEDIDO_SELLER ? null : form.vendedor?.trim() || null;
    const payload = { ...base, vendedor: vendedorPayload, detalle: cleanDetalle, valor: form.valor };
    const primaryLink = Array.isArray(vincularConList) ? vincularConList[0] : null;
    if (primaryLink) payload.vincularCon = Number(primaryLink);
    if (desvincularEnvio) payload.desvincularEnvio = true;

    let requestPayload = payload;
    if (isBatch) {
      const cantidad = Number(cantidadLote);
      const rows = distribucionLote.map((row) => ({
        vendedor:
          row.vendedor === OTHER_PEDIDO_SELLER
            ? null
            : String(row.vendedor || '').trim() || null,
        cantidad: Number(row.cantidad),
      }));
      const totalDistribuido = rows.reduce((sum, row) => sum + row.cantidad, 0);
      const invalidRow = rows.some(
        (row, index) =>
          !Number.isInteger(row.cantidad) ||
          row.cantidad < 1 ||
          (distribucionLote[index].vendedor === OTHER_PEDIDO_SELLER &&
            !String(distribucionLote[index].pedidoCliente || '').trim())
      );

      if (!Number.isInteger(cantidad) || cantidad < 2 || cantidad > 100) {
        alert('La cantidad del lote debe estar entre 2 y 100.');
        setSaving(false);
        return;
      }
      if (invalidRow) {
        alert('Completa correctamente cada cliente y su cantidad.');
        setSaving(false);
        return;
      }
      if (totalDistribuido !== cantidad) {
        alert(`La distribución debe sumar ${cantidad}. Actualmente suma ${totalDistribuido}.`);
        setSaving(false);
        return;
      }

      requestPayload = {
        producto: payload,
        cantidad,
        distribucion: rows,
        casillero: form.casillero || undefined,
        vincularTodos: vincularTodoLote,
      };
    }

    try {
      const res = await api[method](url, requestPayload);
      const saved = res?.data ?? res;

      if (isBatch) {
        const savedItems = Array.isArray(saved) ? saved : [];
        if (!savedItems.length) throw new Error('El lote no devolvió productos');
        if (onSavedBatch) onSavedBatch(savedItems);
        else savedItems.forEach((item) => onSaved(item));
        onClose();
        return;
      }

      const extras = Array.isArray(vincularConList) ? vincularConList.slice(1) : [];
      if (saved?.id && extras.length) {
        const ops = extras.map((id) => api.patch(`/productos/${id}`, { vincularCon: saved.id }).catch(() => {}));
        await Promise.allSettled(ops);
      }

      if (form.casillero) {
        const optimisticTracking = { casillero: form.casillero, estado: 'comprado_sin_tracking' };
        onSaved(saved, optimisticTracking);
        api.put(`/tracking/producto/${saved.id}`, {
          casillero: form.casillero,
          estado: 'comprado_sin_tracking',
        }).then((trk) => {
          if (trk) onSaved(saved, trk);
        }).catch((err) => console.error('Error al asignar casillero:', err));
      } else {
        onSaved(saved);
      }

      if (isEdit) onClose();
      if (!isEdit) onClose();
    } catch (err) {
      console.error('Error al guardar:', err);
      alert('No se pudo guardar el producto.');
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const baseSellerOptions = [
    { value: '', label: 'Selecciona' },
    { value: 'Gonzalo', label: 'Gonzalo' },
    { value: 'Renato', label: 'Renato' },
    { value: 'ambos', label: 'Ambos' },
    ...PEDIDO_CLIENTS.map((client) => ({
      value: pedidoSeller(client),
      label: pedidoSeller(client),
    })),
    { value: OTHER_PEDIDO_SELLER, label: 'Otro nombre' },
  ];
  const currentSeller = String(form.vendedor || '').trim();
  const currentPedidoClient = pedidoClientFromSeller(currentSeller);
  const isKnownSeller = baseSellerOptions.some((opt) => opt.value === currentSeller);
  const sellerOptions = baseSellerOptions;
  const sellerSelectValue = currentSeller && isKnownSeller
    ? currentSeller
    : currentPedidoClient
      ? OTHER_PEDIDO_SELLER
      : currentSeller;
  const showOtherPedidoInput = sellerSelectValue === OTHER_PEDIDO_SELLER;
  const totalDistribuidoLote = distribucionLote.reduce(
    (sum, row) => sum + (Number(row.cantidad) || 0),
    0
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-5xl rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        <button
          className={`absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl font-bold rounded-full hover:bg-gray-100 ${
            saving ? 'opacity-50 cursor-not-allowed text-gray-400' : 'text-gray-600 hover:text-gray-900'
          }`}
          onClick={saving ? undefined : onClose}
          disabled={saving}
          aria-disabled={saving}
          aria-label="Cerrar"
        >x</button>

        <h2 className="text-2xl font-semibold mb-4">
          {isEdit ? 'Editar Producto' : 'Agregar Producto'}
        </h2>

        <form onSubmit={handleSubmit}>
          <fieldset disabled={saving} className={saving ? 'opacity-60 pointer-events-none' : ''}>
            {!isEdit && (
              <div className="border border-indigo-200 rounded-lg p-4 mb-6 bg-indigo-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-indigo-600"
                    checked={loteActivo}
                    onChange={(e) => setLoteActivo(e.target.checked)}
                  />
                  <span>
                    <span className="block font-semibold text-gray-900">Crear varios productos iguales</span>
                    <span className="block text-sm text-gray-600">
                      Los datos y el precio se ingresan una sola vez para todo el lote.
                    </span>
                  </span>
                </label>

                {loteActivo && (
                  <div className="mt-4 space-y-4">
                    <div className="max-w-xs">
                      <label className="block text-sm font-medium mb-1">Cantidad total</label>
                      <input
                        type="number"
                        min="2"
                        max="100"
                        className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={cantidadLote}
                        onChange={(e) => onCantidadLoteChange(e.target.value)}
                      />
                    </div>

                    <label className="flex items-start gap-3 border border-indigo-200 rounded-lg bg-white p-3 cursor-pointer">
                      <input
                        type="checkbox"
                        className="h-4 w-4 mt-0.5 accent-indigo-600"
                        checked={vincularTodoLote}
                        onChange={(e) => setVincularTodoLote(e.target.checked)}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">
                          Vincular todos los productos
                        </span>
                        <span className="block text-xs text-gray-600 mt-1">
                          Todos compartirán el mismo DEC, peso, tracking y costo de envío prorrateado.
                        </span>
                      </span>
                    </label>

                    <div>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="text-sm font-semibold">Distribución</span>
                        <span className={`text-sm font-medium ${
                          totalDistribuidoLote === Number(cantidadLote)
                            ? 'text-green-700'
                            : 'text-amber-700'
                        }`}>
                          Asignados: {totalDistribuidoLote} de {Number(cantidadLote) || 0}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {distribucionLote.map((row, index) => {
                          const rowSeller = String(row.vendedor || '');
                          const known = sellerOptions.some((opt) => opt.value === rowSeller);
                          const selectValue = known
                            ? rowSeller
                            : pedidoClientFromSeller(rowSeller)
                              ? OTHER_PEDIDO_SELLER
                              : rowSeller;
                          const showClient = selectValue === OTHER_PEDIDO_SELLER;
                          return (
                            <div key={`lote-${index}`} className="grid grid-cols-1 sm:grid-cols-[1fr_170px_auto] gap-2 items-start">
                              <div>
                                <select
                                  className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  value={selectValue}
                                  onChange={(e) => onLoteSellerChange(index, e.target.value)}
                                >
                                  {sellerOptions.map((opt) => (
                                    <option key={`${index}-${opt.label}`} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                                {showClient && (
                                  <input
                                    type="text"
                                    className="w-full border p-2 rounded bg-white mt-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={row.pedidoCliente || ''}
                                    onChange={(e) => onLoteClientChange(index, e.target.value)}
                                    placeholder="Nombre del cliente"
                                  />
                                )}
                              </div>
                              <div>
                                <div className="flex gap-1">
                                  <input
                                    type="number"
                                    min="1"
                                    className="w-full min-w-0 border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    value={row.cantidad}
                                    aria-label={`Cantidad de la distribución ${index + 1}`}
                                    onChange={(e) => onCantidadDistribucionChange(index, e.target.value)}
                                  />
                                  {row.cantidadFija && (
                                    <button
                                      type="button"
                                      className="px-2 py-2 rounded border bg-white text-xs text-indigo-700 hover:bg-indigo-50"
                                      onClick={() => restaurarCantidadAutomatica(index)}
                                      title="Volver a distribuir esta cantidad automáticamente"
                                    >
                                      Auto
                                    </button>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {row.cantidadFija ? 'Cantidad fijada' : 'Se distribuye automáticamente'}
                                </div>
                              </div>
                              <button
                                type="button"
                                className="px-3 py-2 rounded border bg-white text-red-600 hover:bg-red-50 disabled:opacity-40"
                                disabled={distribucionLote.length === 1}
                                onClick={() => quitarDistribucionLote(index)}
                              >
                                Quitar
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        className="mt-3 px-3 py-2 rounded border bg-white text-sm hover:bg-gray-100"
                        onClick={agregarDistribucionLote}
                      >
                        Agregar cliente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {!isEdit && (
                  <div className="border rounded-lg p-4 bg-gray-50/70">
                    <div className="text-sm font-semibold mb-2">Agregar Producto Ebay</div>
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
                        type="button"
                        onClick={fetchEbay}
                        disabled={ebayLoading}
                        className={`${ebayLoading ? 'bg-gray-300 text-gray-600' : 'bg-indigo-600 text-white hover:bg-indigo-700'} px-4 py-2 rounded-lg`}
                      >
                        {ebayLoading ? 'Cargando...' : 'Buscar'}
                      </button>
                    </div>
                    {ebayError && <div className="text-sm text-red-600 mt-2">{ebayError}</div>}
                    <div className="text-xs text-gray-600 mt-2 space-y-1">
                      <div>
                        Precio: <strong>${Number(ebayPrice || 0).toFixed(2)}</strong> | Envio: <strong>${Number(ebayShipping || 0).toFixed(2)}</strong>
                      </div>
                      <div>
                        Condition: <strong>{labelFromCondition(ebayConditionRaw)}</strong>
                      </div>
                    </div>
                    {ebayTitle && (
                      <div className="text-xs text-gray-700 mt-2 border rounded bg-white p-2">
                        {ebayTitle}
                      </div>
                    )}
                  </div>
                )}
                {!isEdit && (
                  <div className="border rounded-lg p-3 bg-gray-50/60">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded border text-sm bg-white hover:bg-gray-100"
                        onClick={async () => {
                          if (!recentOpen && recentNuevo.length === 0) {
                            await loadRecentNuevo();
                          }
                          setRecentOpen((v) => !v);
                        }}
                      >
                        {recentOpen ? 'Cerrar lista recientes' : 'Usar comprados recientes (nuevo)'}
                      </button>
                    </div>
                    {recentOpen && (
                      <div className="mt-3 border rounded-lg bg-white p-2 max-h-52 overflow-auto space-y-2">
                        {recentLoading && <div className="text-sm text-gray-500">Cargando recientes...</div>}
                        {!recentLoading && recentError && <div className="text-sm text-red-600">{recentError}</div>}
                        {!recentLoading && !recentError && recentNuevo.length === 0 && (
                          <div className="text-sm text-gray-500">No hay productos en estado nuevo.</div>
                        )}
                        {!recentLoading && !recentError && recentNuevo.map((p) => (
                          <div key={`recent-${p.id}`} className="flex items-center justify-between gap-3 border rounded-md p-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">#{p.id} - {describeProducto(p) || p.tipo || 'Producto'}</div>
                              <div className="text-xs text-gray-600">
                                Compra: {p?.valor?.fechaCompra || '-'} | Valor producto: {p?.valor?.valorProducto ?? '-'}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700"
                              onClick={() => applyRecentNuevo(p)}
                            >
                              Usar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div>
                  <label className="block font-medium">Tipo de Producto</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.tipo}
                    onChange={e => onChange('main', 'tipo', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="macbook">Macbook</option>
                    <option value="ipad">iPad</option>
                    <option value="iphone">iPhone</option>
                    <option value="watch">Apple Watch</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {form.tipo === 'macbook' && (
                  <FormProductoMacbook
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'ipad' && (
                  <FormProductoIpad
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'iphone' && (
                  <FormProductoIphone
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'watch' && (
                  <FormProductoWatch
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'otro' && (
                  <FormProductoOtro
                    value={form.detalle?.descripcionOtro || ''}
                    onChange={v => onChange('detalle', 'descripcionOtro', v)}
                  />
                )}

                <div className={form.tipo === 'iphone' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : ''}>
                  <div>
                    <label className="block font-medium">Estado</label>
                    <select
                      className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={form.estado}
                      onChange={e => onChange('main', 'estado', e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      <option value="nuevo">Nuevo</option>
                      <option value="usado">Usado</option>
                      <option value="roto">Roto</option>
                    </select>
                  </div>
                  {form.tipo === 'iphone' && (
                    <div>
                      <label className="block font-medium">eSIM</label>
                      <select
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.detalle?.esim || ''}
                        onChange={e => onChange('detalle', 'esim', e.target.value)}
                      >
                        <option value="">Selecciona</option>
                        <option value="Si">Si</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-medium mb-1">Accesorios</label>
                  {(() => {
                    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
                    const todos = Array.isArray(form.accesorios) && form.accesorios.includes('Todos');
                    const disabledGroup = isNuevo || todos;
                    return (
                      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${disabledGroup ? 'opacity-60' : ''}`}>
                        {['Caja', 'Cubo', 'Cable', 'Todos'].map(opt => (
                          <label key={opt} className={`flex items-center gap-2 border rounded px-3 py-2 cursor-pointer ${isNuevo ? 'pointer-events-none' : ''}`}>
                            <input
                              type="checkbox"
                              className="accent-indigo-600"
                              checked={isNuevo ? true : (opt === 'Todos' ? todos : (todos ? true : (form.accesorios || []).includes(opt)))}
                              disabled={opt !== 'Todos' && (isNuevo || todos)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setForm(f => {
                                  let next = Array.isArray(f.accesorios) ? [...f.accesorios] : [];
                                  if (opt === 'Todos') {
                                    return { ...f, accesorios: checked ? Array.from(new Set([...next, 'Todos'])) : next.filter(x => x !== 'Todos') };
                                  }
                                  if (checked) next = Array.from(new Set([...next, opt])); else next = next.filter(x => x !== opt);
                                  return { ...f, accesorios: next };
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                  {String(form.estado || '').toLowerCase() === 'nuevo' && (
                    <p className="text-sm text-gray-500 mt-1">Estado "Nuevo" fuerza Todos (Caja, Cubo y Cable).</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium">Casillero</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.casillero}
                    onChange={e => onChange('main', 'casillero', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="Walter">Walter</option>
                    <option value="Renato">Renato</option>
                    <option value="Christian">Christian</option>
                    <option value="Alex">Alex</option>
                    <option value="MamaRen">MamaRen</option>
                    <option value="Jorge">Jorge</option>
                    <option value="Kenny">Kenny</option>
                    <option value="Sebastian">Sebastian</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                {['valorProducto', 'valorDec', 'peso', 'fechaCompra'].map(field => (
                  <div key={field}>
                    <label className="block font-medium mb-1">
                      {{
                        valorProducto: loteActivo ? 'Valor total del lote ($)' : 'Valor Producto ($)',
                        valorDec: loteActivo ? 'Valor DEC compartido ($)' : 'Valor DEC ($)',
                        peso: 'Peso (kg)',
                        fechaCompra: 'Fecha de Compra'
                      }[field]}
                    </label>
                    <input
                      type={field === 'fechaCompra' ? 'date' : 'number'}
                      className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={form.valor[field]}
                      onChange={e => onChange('valor', field, e.target.value)}
                    />
                    {loteActivo && field === 'valorProducto' && (
                      <p className="text-xs text-gray-500 mt-1">
                        Por unidad: ${(
                          (Number(form.valor[field]) || 0) /
                          Math.max(Number(cantidadLote) || 1, 1)
                        ).toFixed(2)}
                      </p>
                    )}
                    {loteActivo && (field === 'valorDec' || field === 'peso') && (
                      <p className="text-xs text-gray-500 mt-1">
                        Este valor será igual para todas las unidades del lote.
                      </p>
                    )}
                  </div>
                ))}

                {!loteActivo && <div className="border rounded-lg p-3 space-y-3 bg-gray-50/60">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-gray-900">Vincular envio</span>
                      {producto?.envioGrupoId && (
                        <span className="text-xs text-gray-600">Grupo: {producto.envioGrupoId}</span>
                      )}
                    </div>
                  </div>
                  {producto?.envioGrupoId && !linkerOpen && !desvincularEnvio && (
                    <p className="text-sm text-gray-600">Este producto ya esta vinculado. Usa "Agregar vinculo" solo si necesitas moverlo o desvincular.</p>
                  )}
                  <div className="flex flex-wrap gap-3 items-center">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-gray-100 shadow-sm"
                      onClick={async () => {
                        if (!linkerOpen) {
                          try {
                            setLoadingLinker(true);
                            const res = await api.get('/productos');
                            const data = res?.data || res || [];
                            const allowed = new Set(['comprado_sin_tracking', 'comprado_en_camino', 'en_eshopex']);
                            const casActual = getCasilleroActual();
                            const filtered = (Array.isArray(data) ? data : []).filter((p) => {
                              if (!allowed.has(getLastTrackingEstado(p))) return false;
                              const casP = Array.isArray(p?.tracking) && p.tracking[0]?.casillero ? p.tracking[0].casillero : '';
                              if (casActual && casP && casActual !== casP) return false;
                              if (isEdit && p.id === producto.id) return false;
                              return true;
                            });
                            setLinkables(filtered);
                          } catch (err) {
                            console.error('No se pudieron cargar productos para vincular', err);
                            alert('No se pudieron cargar productos elegibles para vincular.');
                          } finally {
                            setLoadingLinker(false);
                          }
                        }
                        setLinkerOpen((v) => !v);
                      }}
                    >
                      {linkerOpen ? 'Cerrar lista' : (producto?.envioGrupoId ? 'Agregar vinculo' : 'Vincular producto')}
                    </button>
                    {producto?.envioGrupoId && (
                      <button
                        type="button"
                        className="px-4 py-2 rounded-md border text-sm bg-white hover:bg-gray-100 text-red-600 border-red-200 shadow-sm"
                        onClick={() => {
                          setDesvincularEnvio(true);
                          setVincularConList([]);
                          setPendingLinkIds([]);
                          setLinkerOpen(false);
                        }}
                      >
                        Desvincular
                      </button>
                    )}
                    {Array.isArray(vincularConList) && vincularConList.length > 0 && !desvincularEnvio && (
                      <div className="flex flex-wrap gap-1">
                        {vincularConList.map((id) => (
                          <span key={id} className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-1 rounded">
                            Seleccionado: #{id}
                          </span>
                        ))}
                      </div>
                    )}
                    {desvincularEnvio && (
                      <span className="text-sm text-amber-600">Se desvinculara al guardar.</span>
                    )}
                  </div>

                  {linkerOpen && (
                    <div className="mt-3 space-y-3">
                      <div className="border border-gray-200 rounded-xl bg-white p-3 space-y-3 max-h-56 overflow-auto shadow-sm">
                        {loadingLinker && <div className="text-sm text-gray-500">Cargando opciones...</div>}
                        {!loadingLinker && linkables.length === 0 && (
                          <div className="text-sm text-gray-500">No hay productos elegibles.</div>
                        )}
                        {!loadingLinker && linkables.map((p) => {
                          const d = p.detalle || {};
                          const checked = pendingLinkIds.includes(p.id);
                          const locked = producto?.envioGrupoId ? (p.envioGrupoId && p.envioGrupoId !== producto.envioGrupoId) : false;
                          const inCurrentGroup = producto?.envioGrupoId && p.envioGrupoId === producto.envioGrupoId;
                          const disabled = locked || inCurrentGroup;
                          return (
                            <label
                              key={`link-${p.id}`}
                              className={`flex flex-col gap-1 border rounded-lg p-3 cursor-pointer transition shadow-sm ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-200'} ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : ''}`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm text-gray-900">#{p.id} - {p.tipo}</div>
                                <input
                                  type="checkbox"
                                  name="link-product"
                                  className="h-4 w-4"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => {
                                    if (disabled) return;
                                    setPendingLinkIds((prev) =>
                                      prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                                    );
                                  }}
                                />
                              </div>
                              <div className="text-xs text-gray-700">
                                {[d.gama, d.generacion, d.procesador, d.tamano || d.tamanio, d.conexion, p.estado].filter(Boolean).join(' - ')}
                              </div>
                              <div className="text-xs text-gray-600">
                                Casillero: {p.tracking?.[0]?.casillero || 'N/A'} - Tracking: {getLastTrackingEstado(p) || 'N/A'}
                                {inCurrentGroup && <span className="ml-1 text-gray-600">(Vinculado actual)</span>}
                                {locked && <span className="ml-1 text-amber-600">(Ya en grupo)</span>}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          className="px-3 py-1.5 rounded-md border text-sm bg-white hover:bg-gray-100"
                          onClick={() => {
                            setLinkerOpen(false);
                            setPendingLinkIds([]);
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          className="px-4 py-1.5 rounded-md text-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                          disabled={!pendingLinkIds.length}
                          onClick={() => {
                            setVincularConList(pendingLinkIds);
                            setDesvincularEnvio(false);
                            setLinkerOpen(false);
                          }}
                        >
                          Aceptar
                        </button>
                      </div>
                    </div>
                  )}
                </div>}

                {!loteActivo && <div>
                  <label className="block font-medium mb-1">Vendedor</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={sellerSelectValue}
                    onChange={e => onSellerChange(e.target.value)}
                  >
                    {sellerOptions.map((opt) => (
                      <option key={opt.label} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {showOtherPedidoInput && (
                    <>
                      <label className="block text-sm font-medium mt-3 mb-1">Nombre del cliente</label>
                      <input
                        type="text"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.pedidoCliente || ''}
                        onChange={e => onPedidoClientChange(e.target.value)}
                        placeholder="Escribe el nombre"
                      />
                    </>
                  )}
                </div>}
              </div>
            </div>
          </fieldset>

          <div className="text-right mt-6">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={saving}
              aria-busy={saving}
            >
              {saving
                ? 'Guardando...'
                : isEdit
                  ? 'Guardar cambios'
                  : loteActivo
                    ? `Crear ${Number(cantidadLote) || 0} productos`
                    : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}





