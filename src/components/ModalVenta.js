import { accessorySalePrice } from '../utils/accessoryPrice';
import useAccessoryQuote from '../hooks/useAccessoryQuote';
import React, { useEffect, useState, useRef } from 'react';
import api from '../api';
import { notifySalesChanged } from '../utils/salesSync';
import { accessoryLotDate, consumedAccessoryLots, accessoryLotAvailable } from '../utils/accessorySales';
import { nuevaClave } from '../services/finanzas';
import AnularVentaButton from './AnularVentaButton';

const normalizeSeller = (value) =>
  value == null ? '' : String(value).trim().toLowerCase();

const saleExpenseOwner = (seller) => {
  const value = normalizeSeller(seller);
  return value === 'renato' || value === 'gonzalo' || value.startsWith('gonzalo (');
};

const formatSeller = (value) => {
  const slug = normalizeSeller(value);
  if (slug === 'gonzalo') return 'Gonzalo';
  if (slug === 'renato') return 'Renato';
  if (slug === 'ambos') return 'Ambos';
  const pedidoMatch = String(value || '').trim().match(/^gonzalo\s*\(([^)]+)\)$/i);
  if (pedidoMatch?.[1]) return `Gonzalo (${pedidoMatch[1].trim()})`;
  return '';
};

const PEDIDO_CLIENTS = ['Jorge', 'Rodrigo', 'Miguel', 'Carlos', 'Kenny', 'Sebastian', 'Williams'];
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

const resolvedSaleSeller = (saleSeller, productSeller, presetSeller) => {
  const sale = String(saleSeller || '').trim();
  const product = String(productSeller || presetSeller || '').trim();
  const productIsPedido = /^gonzalo\s*\([^)]+\)$/i.test(product);
  const genericSale = !sale || /^(gonzalo|renato|ambos)$/i.test(sale);
  return productIsPedido && genericSale ? product : (sale || product);
};

export default function ModalVenta({
  producto,
  venta,
  onClose,
  onSaved,
  allowVendedorOnCreate = false,
  presetVendedor = '',
  precioPublicado,
  precioMinimo,
  embedded = false,
  // Solo Productos lo indica: habilita la anulación completa desde el detalle.
  onAnulada,
}) {
  const [priceEdited, setPriceEdited] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const operation = useRef(null);
  const [incomeBank, setIncomeBank] = useState('bcp');
  const [accessorySummary, setAccessorySummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [form, setForm] = useState({
    tipoCambio: '',
    tipoCambioGonzalo: '',
    tipoCambioRenato: '',
    fechaVenta: '',
    precioVenta: '',
    vendedor: '',
    pedidoCliente: '',
    cantidad: '1',
    modalidad: 'unidad',
    loteInicialId: '',
  });

  const effectiveSeller = form.vendedor || resolvedSaleSeller(venta?.vendedor, producto?.vendedor, presetVendedor);
  const sellerSlug = normalizeSeller(effectiveSeller);
  const sellerLabel = formatSeller(effectiveSeller) || 'Sin asignar';
  const isReadOnly = Boolean(venta) && !editMode;
  const isSplitVenta = Boolean(
    venta &&
      (sellerSlug === 'ambos' ||
        venta?.tipoCambioGonzalo != null ||
        venta?.tipoCambioRenato != null),
  );
  const isSplitCreate = !venta && sellerSlug === 'ambos';
  const splitModeActive = venta ? isSplitVenta : isSplitCreate;
  const isAccessory = String(producto?.tipo || '').toLowerCase() === 'accesorios';
  const accessoryCreate = !venta && isAccessory;
  const accessoryLots = (Array.isArray(producto?.__lots) && producto.__lots.length ? producto.__lots : [producto])
    .filter((lot) => lot?.id && accessoryLotAvailable(lot))
    .sort((a, b) => accessoryLotDate(a) - accessoryLotDate(b) || Number(a.id) - Number(b.id));
  const selectedLot = accessoryLots.find((lot) => String(lot.id) === form.loteInicialId) || accessoryLots[0];
  const consumedLots = consumedAccessoryLots(accessoryLots, selectedLot?.id, form.cantidad);
  const quotation = useAccessoryQuote({ enabled: accessoryCreate, productoId: producto?.id,
    comprador: effectiveSeller, cantidad: Number(form.cantidad), loteInicialId: selectedLot?.id,
    precioUnitario: form.precioVenta === '' ? '' : Number(form.precioVenta) / Math.max(1, Number(form.cantidad)) });
  const minimum = producto?.referencia?.precioMinimoSoles ?? precioMinimo ?? quotation.quote?.precioMinimo;
  const referencePricing = producto?.referencia || quotation.quote;
  const automaticUnitPrice = accessorySalePrice({ ...referencePricing, precioPublicado: producto?.referencia?.precioPublicadoSoles ?? precioPublicado ?? referencePricing?.precioPublicado }, form.cantidad);
  useEffect(() => {
    if (accessoryCreate && !priceEdited && automaticUnitPrice != null) setForm((current) => {
      const value = String(Number((Number(automaticUnitPrice) * Math.max(1, Number(current.cantidad))).toFixed(2)));
      return current.precioVenta === value ? current : { ...current, precioVenta: value };
    });
  }, [accessoryCreate, priceEdited, automaticUnitPrice, form.cantidad]);
  // Old lots without a currency were purchased in USD.
  const requiresExchangeRate = !isAccessory ? String(producto.valor?.monedaCompra || 'USD').toUpperCase() !== 'PEN' : (venta
    ? (venta.distribucionStock?.length
      ? venta.distribucionStock.some((part) => {
        const lot = (producto.__lots || [producto]).find((item) => Number(item.id) === Number(part.productoId));
        return String(lot?.valor?.monedaCompra || 'USD').toUpperCase() !== 'PEN';
      })
      : String(producto.valor?.monedaCompra || 'USD').toUpperCase() !== 'PEN')
    : consumedLots.some(({ lot }) => String(lot.valor?.monedaCompra || 'USD').toUpperCase() !== 'PEN'));

  useEffect(() => {
    setPriceEdited(false);
    const initialSeller = resolvedSaleSeller(venta?.vendedor, producto?.vendedor, presetVendedor);
    if (venta) {
      setForm({
        tipoCambio: venta.tipoCambio != null ? String(venta.tipoCambio) : '',
        tipoCambioGonzalo:
          venta.tipoCambioGonzalo != null ? String(venta.tipoCambioGonzalo) : '',
        tipoCambioRenato:
          venta.tipoCambioRenato != null ? String(venta.tipoCambioRenato) : '',
        fechaVenta: venta.fechaVenta ?? '',
        precioVenta: venta.precioVenta != null ? String(venta.precioVenta) : '',
        vendedor: initialSeller,
        pedidoCliente: pedidoClientFromSeller(initialSeller),
        cantidad: String(venta.cantidad || 1),
        modalidad: venta.modalidad || 'unidad',
        loteInicialId: '',
      });
      return;
    }

    const initialPrice = accessorySalePrice({ ...producto?.referencia, precioPublicado: producto?.referencia?.precioPublicadoSoles ?? precioPublicado }, 1);
    setForm({
      tipoCambio: '',
      tipoCambioGonzalo: '',
      tipoCambioRenato: '',
      fechaVenta: '',
      precioVenta: initialPrice == null ? '' : String(initialPrice),
      vendedor: initialSeller,
      pedidoCliente: pedidoClientFromSeller(initialSeller),
      cantidad: '1',
      modalidad: 'unidad',
      loteInicialId: '',
    });
  }, [venta, producto?.id, producto?.vendedor, presetVendedor, allowVendedorOnCreate, precioPublicado, producto?.referencia]);

  useEffect(() => {
    setEditMode(false);
  }, [producto?.id, venta?.id, venta]);

  useEffect(() => {
    if (!venta?.id) return undefined;
    let active = true;
    Promise.resolve(api.get(`/ventas/${venta.id}/cobros`)).then((data) => {
      if (active && data?.incomeBank) setIncomeBank(data.incomeBank);
    }).catch(() => {});
    return () => { active = false; };
  }, [venta?.id]);

  useEffect(() => {
    if (!accessoryCreate || !producto?.id) {
      setAccessorySummary(null);
      return;
    }
    let active = true;
    setSummaryLoading(true);
    Promise.resolve(api.get(`/ventas/accesorio-resumen?productoId=${producto.id}`))
      .then((data) => { if (active) setAccessorySummary(data || null); })
      .catch(() => { if (active) setAccessorySummary(null); })
      .finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [accessoryCreate, producto?.id]);

  if (!producto) return null;

  const onChange = (field, value) => {
    if (field === 'precioVenta') setPriceEdited(true);
    setForm((prev) => ({ ...prev, [field]: value, ...(accessoryCreate && field === 'cantidad' && prev.precioVenta !== '' ? { precioVenta: String(Number((Number(prev.precioVenta) / Math.max(1, Number(prev.cantidad)) * Number(value || 1)).toFixed(2))) } : {}) }));
  };
  const onSellerChange = (value) => {
    setForm((prev) => ({
      ...prev,
      vendedor: value,
      pedidoCliente: pedidoClientFromSeller(value),
    }));
  };
  const onPedidoClientChange = (value) => {
    setForm((prev) => ({
      ...prev,
      pedidoCliente: value,
      vendedor: value.trim() ? pedidoSeller(value) : '',
    }));
  };

  const validate = () => {
    if (!Number.isFinite(Number(form.precioVenta)) || Number(form.precioVenta) <= 0 || Number(form.precioVenta) > 99999999.99 || Math.abs(Number(form.precioVenta) * 100 - Math.round(Number(form.precioVenta) * 100)) > 0.000001) {
      alert('Indica un precio mayor que cero y con un máximo de dos decimales.');
      return false;
    }
    const exchangeRates = splitModeActive ? [form.tipoCambioGonzalo, form.tipoCambioRenato] : [form.tipoCambio];
    if (requiresExchangeRate && exchangeRates.some((value) => Number(value) > 1000 || Math.abs(Number(value) * 10000 - Math.round(Number(value) * 10000)) > 0.000001)) {
      alert('El tipo de cambio admite hasta cuatro decimales y un máximo de 1000.');
      return false;
    }
    if (isAccessory && !['gonzalo', 'renato', 'ambos'].includes(sellerSlug)) {
      alert('Selecciona quién compró el accesorio para asignar su ganancia.');
      return false;
    }
    if (accessoryCreate) {
      const quantity = Number(form.cantidad);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > Number(producto.stockActual || 0)) {
        alert(`Ingresa una cantidad entre 1 y ${producto.stockActual || 0}.`);
        return false;
      }
    }
    if (splitModeActive) {
      if (
        !form.fechaVenta ||
        !form.precioVenta ||
        (requiresExchangeRate && (!Number.isFinite(Number(form.tipoCambioGonzalo)) || Number(form.tipoCambioGonzalo) <= 0 ||
          !Number.isFinite(Number(form.tipoCambioRenato)) || Number(form.tipoCambioRenato) <= 0))
      ) {
        alert('Completa Fecha de venta, Precio de venta y tipo de cambio para ambos.');
        return false;
      }
      return true;
    }
    if ((requiresExchangeRate && (!Number.isFinite(Number(form.tipoCambio)) || Number(form.tipoCambio) <= 0)) || !form.fechaVenta || !form.precioVenta) {
      alert('Completa Tipo de cambio, Fecha de venta y Precio de venta.');
      return false;
    }
    return true;
  };

  const syncProductSeller = async (seller) => {
    const value = String(seller || '').trim();
    if (!value || value === String(producto?.vendedor || '').trim()) return;
    try {
      const updatedProduct = await api.patch(`/productos/${producto.id}`, { vendedor: value });
      window.dispatchEvent(new CustomEvent('productos-updated', { detail: { producto: updatedProduct } }));
    } catch (sellerError) {
      console.error('[ModalVenta] La venta se guardó, pero no se pudo sincronizar el vendedor del producto:', sellerError);
    }
  };

  const handleSaveCreate = async () => {
    if (saving || !validate()) return;
    if (accessoryCreate && !quotation.quote?.cotizacionToken) { alert(quotation.error || 'Espera la cotización antes de vender.'); return; }

    setSaving(true);
    let requestedSeller = '';
    try {
      const body = {
        productoId: producto.id,
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
        incomeBank,
      };
      if (isAccessory) {
        const cantidad = Number(form.cantidad);
        body.cantidad = cantidad;
        body.cotizacionToken = quotation.quote.cotizacionToken;
        body.modalidad = cantidad > 1 ? 'mayor' : 'unidad';
        body.loteInicialId = Number(selectedLot?.id || producto.id);
      }

      if (splitModeActive) {
        const tcG = requiresExchangeRate ? Number(form.tipoCambioGonzalo) : 1;
        const tcR = requiresExchangeRate ? Number(form.tipoCambioRenato) : 1;
        const avg = (tcG + tcR) / 2;
        body.tipoCambio = Number(avg.toFixed(4));
        body.tipoCambioGonzalo = tcG;
        body.tipoCambioRenato = tcR;
        body.vendedor = 'ambos';
      } else {
        body.tipoCambio = requiresExchangeRate ? Number(form.tipoCambio) : 1;
        const seller = String(form.pedidoCliente || '').trim() ? pedidoSeller(form.pedidoCliente) : form.vendedor?.trim();
        if (seller) {
          body.vendedor = seller;
          requestedSeller = seller;
        }
      }

      const fingerprint = JSON.stringify(body);
      if (!operation.current || operation.current.fingerprint !== fingerprint) operation.current = { fingerprint, key: nuevaClave() };
      body.operacionKey = operation.current.key;
      const saved = await api.post('/ventas', body);
      await syncProductSeller(saved?.vendedor || body.vendedor);

      notifySalesChanged({
        action: 'create',
        venta: { ...saved, producto: saved?.producto || producto },
        producto,
        productoId: producto.id,
      });
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al guardar venta:', e);
      if (/409|cotización cambió|Stock insuficiente/i.test(e.message || '')) {
        quotation.refresh();
        alert('El stock o los costos cambiaron. Revisa la nueva cotización antes de confirmar.');
        return;
      }
      // Si se perdio la respuesta despues de guardar, confirmar antes de pedir repetir.
      try {
        const ventas = await api.get(`/ventas/producto/${producto.id}`);
        const existing = Array.isArray(ventas) ? ventas.find((row) => row.operacionKey === operation.current?.key) : null;
        if (existing) {
          await syncProductSeller(existing?.vendedor || requestedSeller);

          notifySalesChanged({
            action: 'create-confirmed',
            venta: { ...existing, producto: existing?.producto || producto },
            producto,
            productoId: producto.id,
          });
          onSaved?.(existing);
          onClose?.();
          return;
        }
      } catch (confirmError) {
        console.error('[ModalVenta] No se pudo confirmar la venta:', confirmError);
      }
      alert('No se pudo guardar la venta. Intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!venta || saving || !validate()) return;

    setSaving(true);
    try {
      const payload = {
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
      };

      if (splitModeActive) {
        const tcG = requiresExchangeRate ? Number(form.tipoCambioGonzalo || form.tipoCambio || 0) : 1;
        const tcR = requiresExchangeRate ? Number(form.tipoCambioRenato || form.tipoCambio || 0) : 1;
        const avg = (tcG + tcR) / 2;
        payload.tipoCambio = Number(avg.toFixed(4));
        payload.tipoCambioGonzalo = tcG;
        payload.tipoCambioRenato = tcR;
        payload.vendedor = 'ambos';
      } else {
        payload.tipoCambio = requiresExchangeRate ? Number(form.tipoCambio) : 1;
        payload.vendedor = String(form.pedidoCliente || '').trim() ? pedidoSeller(form.pedidoCliente) : (form.vendedor?.trim() || null);
      }

      const updated = await api.patch(`/ventas/${venta.id}`, payload);
      await syncProductSeller(updated?.vendedor || payload.vendedor);

      notifySalesChanged({
        action: 'update',
        venta: { ...updated, producto: updated?.producto || producto },
        producto,
        productoId: producto.id,
      });
      onSaved?.(updated);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al actualizar venta:', e);
      alert(e?.message || 'No se pudo actualizar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const valorUsd = Number(producto?.valor?.valorProducto ?? 0);
  const envioSoles = Number(
    producto?.valor?.costoEnvioProrrateado ?? producto?.valor?.costoEnvio ?? 0,
  );
  const ventaTotalSoles = Number(form.precioVenta || 0);
  const mitadVentaSoles = ventaTotalSoles ? ventaTotalSoles / 2 : 0;
  const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const baseTc =
    requiresExchangeRate ? (toPositiveNumber(form.tipoCambio) ?? toPositiveNumber(venta?.tipoCambio) ?? 0) : 1;
  const tcG =
    toPositiveNumber(form.tipoCambioGonzalo) ??
    toPositiveNumber(venta?.tipoCambioGonzalo) ??
    baseTc;
  const tcR =
    toPositiveNumber(form.tipoCambioRenato) ??
    toPositiveNumber(venta?.tipoCambioRenato) ??
    baseTc;

  const calcSplit = (tc) => {
    if (venta?.costoPendiente) return null;
    if (!tc && !isAccessory) return null;
    if (isAccessory && !venta && quotation.quote?.costoTotal == null) return null;
    const costo = isAccessory
      ? (venta ? Number(venta.costoVendido ?? (Number(venta.precioVenta) - Number(venta.ganancia))) : Number(quotation.quote.costoTotal)) / 2
      : (valorUsd / 2) * (String(producto.valor?.monedaCompra || 'USD').toUpperCase() === 'PEN' ? 1 : tc) + envioSoles / 2;
    const ganancia = mitadVentaSoles - costo;
    const porcentaje = costo > 0 ? (ganancia / costo) * 100 : 0;
    return { costo, ganancia, porcentaje };
  };

  const splitG = calcSplit(tcG);
  const splitR = calcSplit(tcR);

  const fmtMoney = (n) =>
    Number.isFinite(n) ? Number(n).toFixed(2) : '--';
  const fmtPct = (n) =>
    Number.isFinite(n) ? `${Number(n).toFixed(2)}%` : '--';
  const fmtTc = (n) =>
    Number.isFinite(n) && n > 0 ? Number(n).toFixed(4) : '--';
  const accessoryQuantity = Number(form.cantidad || 0);
  const accessoryTotalPrice = Number(form.precioVenta || 0);
  const accessoryUnitPrice = accessoryQuantity > 0 && accessoryTotalPrice > 0
    ? accessoryTotalPrice / accessoryQuantity
    : null;

  const accessoryLotPicker = accessoryCreate && (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <label htmlFor="venta-lote-inicial" className="block text-sm font-medium mb-1">Lote del que se vende primero</label>
      <select id="venta-lote-inicial" className="w-full rounded border bg-white p-2" value={selectedLot?.id || ''} onChange={(e) => onChange('loteInicialId', e.target.value)}>
        {accessoryLots.map((lot) => <option key={lot.id} value={lot.id}>{`Lote ${lot.id} | compra ${String(lot.valor?.fechaCompra || '').slice(0, 10) || 'sin fecha'} | ${lot.stockActual} disponibles | costo S/ ${(Number(lot.valor?.costoTotalProrrateado ?? lot.valor?.costoTotal ?? lot.valor?.valorSoles ?? 0) / Math.max(1, Number(lot.stockInicial || 1))).toFixed(2)} c/u`}</option>)}
      </select>
      <p className="mt-1 text-xs text-indigo-800">Si la cantidad supera este lote, se completa con los otros lotes por fecha de compra.</p>
    </div>
  );

  const renderSplitFields = () => (
    <>
      {accessoryLotPicker}
      {accessoryCreate && <label className="block text-sm font-medium">Precio por unidad (S/)<input type="number" min="0" step="0.01" className="w-full rounded border p-2" value={form.precioVenta === '' ? '' : Number((Number(form.precioVenta) / Math.max(1, Number(form.cantidad))).toFixed(2))} onChange={(event) => onChange('precioVenta', event.target.value === '' ? '' : String(Number((Number(event.target.value) * Number(form.cantidad || 1)).toFixed(2))))} /></label>}
      {accessoryCreate && (
        <div>
          <label htmlFor="venta-cantidad" className="block font-medium mb-1">Cantidad</label>
          <input id="venta-cantidad" type="number" min="1" max={producto.stockActual || 0} step="1" className="w-full border p-2 rounded" value={form.cantidad} onChange={(e) => onChange('cantidad', e.target.value)} />
        </div>
      )}
      <div>
        <label htmlFor="venta-precio-compartido" className="block font-medium mb-1">{accessoryCreate ? 'Precio total de venta (S/)' : 'Precio de venta (S/)'}</label>
        <input
          id="venta-precio-compartido"
          type="number"
          step="0.01"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.precioVenta}
          onChange={(e) => onChange('precioVenta', e.target.value)}
        />
      </div>
      {accessoryCreate && (
        <div className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-900">Precio por unidad: <strong>{accessoryUnitPrice == null ? 'S/ --' : `S/ ${accessoryUnitPrice.toFixed(2)}`}</strong></div>
      )}
      <div>
        <label className="block font-medium mb-1">Fecha de venta</label>
        <input
          type="date"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.fechaVenta}
          onChange={(e) => onChange('fechaVenta', e.target.value)}
        />
      </div>
      <div className="border rounded-lg divide-y">
        <div className="p-3 space-y-2">
          <div className="font-semibold">Gonzalo</div>
          {requiresExchangeRate && <div>
            <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
            <input
              type="number"
              step="0.0001"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={form.tipoCambioGonzalo}
              onChange={(e) => onChange('tipoCambioGonzalo', e.target.value)}
            />
          </div>}
          <div className="text-xs text-gray-600">
            Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
          </div>
        </div>
        <div className="p-3 space-y-2">
          <div className="font-semibold">Renato</div>
          {requiresExchangeRate && <div>
            <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
            <input
              type="number"
              step="0.0001"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={form.tipoCambioRenato}
              onChange={(e) => onChange('tipoCambioRenato', e.target.value)}
            />
          </div>}
          <div className="text-xs text-gray-600">
            Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
          </div>
        </div>
      </div>
    </>
  );

  const renderSingleFields = () => (
    <>
      {accessoryLotPicker}
      {accessoryCreate && <label className="block text-sm font-medium">Precio por unidad (S/)<input type="number" min="0" step="0.01" className="w-full rounded border p-2" value={form.precioVenta === '' ? '' : Number((Number(form.precioVenta) / Math.max(1, Number(form.cantidad))).toFixed(2))} onChange={(event) => onChange('precioVenta', event.target.value === '' ? '' : String(Number((Number(event.target.value) * Number(form.cantidad || 1)).toFixed(2))))} /></label>}
      {requiresExchangeRate && <div>
        <label htmlFor="venta-tipo-cambio" className="block font-medium mb-1">Tipo de cambio</label>
        <input
          id="venta-tipo-cambio"
          type="number"
          step="0.0001"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.tipoCambio}
          onChange={(e) => onChange('tipoCambio', e.target.value)}
        />
      </div>}
      <div>
        <label htmlFor="venta-fecha" className="block font-medium mb-1">Fecha de venta</label>
        <input
          id="venta-fecha"
          type="date"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.fechaVenta}
          onChange={(e) => onChange('fechaVenta', e.target.value)}
        />
      </div>
      {!accessoryCreate && <div>
        <label htmlFor="venta-precio" className="block font-medium mb-1">Precio de venta (S/)</label>
        <input
          id="venta-precio"
          type="number"
          step="0.01"
          className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.precioVenta}
          onChange={(e) => onChange('precioVenta', e.target.value)}
        />
      </div>}
      {accessoryCreate && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
          <div><label htmlFor="venta-cantidad" className="block text-sm font-medium mb-1">Cantidad</label><input id="venta-cantidad" type="number" min="1" max={producto.stockActual || 0} step="1" className="w-full border p-2 rounded bg-white" value={form.cantidad} onChange={(e) => onChange('cantidad', e.target.value)} /></div>
          <div><label htmlFor="venta-precio" className="block text-sm font-medium mb-1">Precio total de venta (S/)</label><input id="venta-precio" type="number" min="0" step="0.01" className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" value={form.precioVenta} onChange={(e) => onChange('precioVenta', e.target.value)} /></div>
          <div className="col-span-2 rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm text-indigo-900">Precio por unidad: <strong>{accessoryUnitPrice == null ? 'S/ --' : `S/ ${accessoryUnitPrice.toFixed(2)}`}</strong></div>
          <div className="col-span-2 text-xs text-indigo-800">Stock disponible: {producto.stockActual || 0}.</div>
        </div>
      )}
      {!venta && saleExpenseOwner(form.vendedor || producto?.vendedor || presetVendedor) && (
        <div>
          <label htmlFor="venta-banco-ingreso" className="block font-medium mb-1">Banco donde ingresó la venta</label>
          <select
            id="venta-banco-ingreso"
            className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={incomeBank}
            onChange={(e) => setIncomeBank(e.target.value)}
          >
            <option value="bcp">BCP</option>
            <option value="interbank">Interbank</option>
            <option value="bbva">BBVA</option>
          </select>
          <div className="mt-1 text-xs text-gray-600">El ingreso automático se registrará en esta cuenta.</div>
        </div>
      )}
    </>
  );

  const sellerOptions = [
    { value: '', label: 'Sin vendedor' },
    { value: 'Gonzalo', label: 'Gonzalo' },
    { value: 'Renato', label: 'Renato' },
    { value: 'ambos', label: 'Ambos' },
    ...PEDIDO_CLIENTS.map((client) => ({
      value: pedidoSeller(client),
      label: pedidoSeller(client),
    })),
  ];
  const sellerSelectValue = sellerOptions.find((opt) => normalizeSeller(opt.value) === normalizeSeller(form.vendedor))?.value || '';
  const renderSellerField = () => (
    <div className="rounded-lg border p-3 bg-gray-50 space-y-3">
      <div>
        <label htmlFor="venta-vendedor" className="block font-medium mb-1">{isAccessory ? 'Comprado por' : 'Vendedor'}</label>
        <select
          id="venta-vendedor"
          className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={sellerSelectValue}
          onChange={(e) => onSellerChange(e.target.value)}
          disabled={isReadOnly || (accessoryCreate && Boolean(producto.vendedor))}
        >
          {sellerOptions.filter((opt) => !isAccessory || !opt.value || ['gonzalo', 'renato', 'ambos'].includes(normalizeSeller(opt.value))).map((opt) => (
            <option key={opt.label} value={opt.value}>
              {isAccessory && !opt.value ? 'Seleccionar comprador' : opt.label}
            </option>
          ))}
        </select>
        {accessoryCreate && producto.vendedor && <p className="mt-1 text-xs text-gray-600">La ganancia corresponde al comprador. Puedes corregirlo en Editar stock.</p>}
      </div>
      {!isAccessory && <div>
        <label htmlFor="venta-cliente-pedido" className="block text-sm font-medium mb-1">Otro cliente a pedido</label>
        <input
          id="venta-cliente-pedido"
          type="text"
          className="w-full border p-2 rounded bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          value={form.pedidoCliente}
          onChange={(e) => onPedidoClientChange(e.target.value)}
          placeholder="Nombre del cliente"
          disabled={isReadOnly}
        />
      </div>}
    </div>
  );

  const summaryMoney = (value) => value == null ? 'Pendiente' : `S/ ${Number(value).toFixed(2)}`;
  const summaryPanel = accessoryCreate && (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Resumen de ventas del accesorio">
      <h3 className="font-semibold text-slate-950">Ventas del accesorio</h3>
      {summaryLoading ? <p className="mt-3 text-sm text-slate-500">Cargando resumen...</p> : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Unidades vendidas</span><strong>{accessorySummary?.unidadesVendidas || 0}</strong></div>
            <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Disponibles</span><strong>{accessorySummary?.unidadesDisponibles ?? producto.stockActual ?? 0}</strong></div>
            <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800"><span className="block text-xs">Ingreso total</span><strong className="text-lg">{summaryMoney(accessorySummary?.ventaBruta)}</strong></div>
            <div className="rounded-lg bg-indigo-50 p-3 text-indigo-800"><span className="block text-xs">Ganancia general</span><strong className="text-lg">{summaryMoney(accessorySummary?.gananciaNeta)}</strong></div>
          </div>
          {requiresExchangeRate && <p className="mt-3 text-xs text-slate-600">Tipo de cambio promedio: <strong>{accessorySummary?.tipoCambioPromedio != null ? Number(accessorySummary.tipoCambioPromedio).toFixed(4) : '--'}</strong></p>}
          <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
            {(accessorySummary?.ventas || []).map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <div className="flex justify-between gap-2"><strong>{item.fechaVenta}</strong><span>{item.cantidad} und.</span></div>
                {onAnulada && <div className="mt-1 flex justify-end"><AnularVentaButton venta={{ ...item, productoId: producto.id }} onAnulada={onAnulada}
                  className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60" /></div>}
                <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>Cada uno: <strong>{summaryMoney(item.precioUnitario)}</strong></span>
                  <span className="text-right">Total: <strong>{summaryMoney(item.ventaBruta)}</strong></span>
                  <span>Costo: <strong>{summaryMoney(item.costo)}</strong></span>
                  <span className="text-right text-emerald-700">Ganancia: <strong>{summaryMoney(item.gananciaNeta)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );

  const content = (
      <div className={`bg-white w-full p-4 sm:p-6 relative overflow-y-auto ${embedded ? 'h-full max-h-full' : `${accessoryCreate ? 'sm:max-w-5xl' : 'sm:max-w-lg'} rounded-xl shadow-lg mx-4 max-h-[90vh]`}`}>
        {!embedded && <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          x
        </button>}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">
            {venta ? (isReadOnly ? 'Detalle de Venta' : 'Editar Venta') : 'Registrar Venta'}
          </h2>
        </div>

        <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-700 mb-4">
          {isAccessory ? 'Comprado por' : 'Vendedor del producto'}: <span className="font-medium">{sellerLabel}</span>
        </div>

        {!venta && !sellerSlug && !isAccessory && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 mb-4">
            Este producto no tiene vendedor asignado. Puedes registrar la venta, pero no aparecerá en ganancias por vendedor hasta asignarlo en el producto.
          </div>
        )}

        {!venta && (
          <div className={accessoryCreate ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]' : ''}>
            <div className="space-y-4">
              {renderSellerField()}
              {accessoryCreate && <div aria-label="Cotización del accesorio" className="rounded-lg border p-3 text-sm" aria-live="polite">
                {quotation.loading ? <p>Cotizando…</p> : quotation.error ? <p role="alert">{quotation.error}</p> : <>
                  <p>Costo total: S/ {fmtMoney(quotation.quote?.costoTotal)}</p>
                  <p>Ganancia bruta: S/ {fmtMoney(quotation.quote?.gananciaBruta)}</p>
                  <p>Margen sobre venta: {fmtPct(quotation.quote?.margenSobreVenta)}</p>
                </>}
                {minimum != null && <p>Precio mínimo: S/ {Number(minimum).toFixed(2)} por unidad</p>}
                {minimum != null && form.precioVenta !== '' && Number(form.precioVenta) / Number(form.cantidad || 1) < Number(minimum) && <p role="alert" className="text-amber-800">El precio por unidad está por debajo del precio mínimo.</p>}
              </div>}
              {splitModeActive ? renderSplitFields() : renderSingleFields()}
              <div className="text-right">
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveCreate}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
              </div>
            </div>
            {summaryPanel}
          </div>
        )}

        {venta && isReadOnly && (
          <div className="space-y-3">
            <div>
              <span className="font-medium">Fecha de venta: </span>
              <span className="text-gray-700">{venta.fechaVenta}</span>
            </div>

            {isSplitVenta ? (
              <>
                <div>
                  <span className="font-medium">Precio de venta total (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div className="border rounded-lg divide-y">
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Gonzalo</div>
                    {requiresExchangeRate && <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcG)}</div>}
                    <div className="text-xs text-gray-600">Venta: S/ {fmtMoney(mitadVentaSoles)}</div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Renato</div>
                    {requiresExchangeRate && <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcR)}</div>}
                    <div className="text-xs text-gray-600">Venta: S/ {fmtMoney(mitadVentaSoles)}</div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {requiresExchangeRate && <div>
                  <span className="font-medium">Tipo de cambio: </span>
                  <span className="text-gray-700">{Number(venta.tipoCambio).toFixed(4)}</span>
                </div>}
                <div>
                  <span className="font-medium">Precio de venta (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">% Ganancia: </span>
                  <span className="text-gray-700">{venta.costoPendiente ? 'Pendiente' : `${Number(venta.porcentajeGanancia).toFixed(3)}%`}</span>
                </div>
                <div>
                  <span className="font-medium">Ganancia comercial (S/): </span>
                  <span className="text-gray-700">{venta.costoPendiente ? 'Costo pendiente' : Number(venta.ganancia).toFixed(2)}</span>
                </div>
              </>
            )}

            <div>
              <span className="font-medium">Vendedor: </span>
              <span className="text-gray-700">{sellerLabel}</span>
            </div>

            <div className="text-right pt-2 flex items-center justify-end gap-2">
              {onAnulada && <AnularVentaButton venta={venta} onAnulada={onAnulada} />}
              <button
                className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                onClick={() => setEditMode(true)}
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {venta && !isReadOnly && (
          <div className="space-y-4">
            {renderSellerField()}
            {splitModeActive ? renderSplitFields() : renderSingleFields()}
            <div className="flex items-center justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300"
                onClick={() => setEditMode(false)}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
  );

  if (embedded) return content;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      {content}
    </div>
  );
}
