import { accessoryLotAvailable, consumedAccessoryLots } from '../utils/accessorySales';
import { isSimpleAccessory } from '../utils/accessoryCost';
import useAccessoryQuote from '../hooks/useAccessoryQuote';
// src/components/ModalCalculadora.js
// Calculadora simple: sugiere precios minimos/medios y permite probar un precio personalizado.
import React, { useMemo, useState } from 'react';
import { TC_FIJO } from '../utils/tipoCambio';
import api from '../api';
import { formatAppleWatchName } from '../utils/productName';

const fmtSoles = (v) => {
  const amount = Number(v);
  if (!Number.isFinite(amount)) return '-';
  return `S/ ${(Math.round((amount + Math.sign(amount || 1) * 1e-9) * 100) / 100).toFixed(2)}`;
};
const fmtDate = (value) => {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : '—';
};
const roundUp10 = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return NaN;
  return Math.ceil(x / 10) * 10;
};
const roundUp50 = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return NaN;
  return Math.ceil(x / 50) * 50;
};

const clean = (value) => String(value ?? '').trim();
const buildProductName = (product) => {
  const detail = product?.detalle || {};
  const type = clean(product?.tipo).toLowerCase();
  if (type === 'iphone') return ['iPhone', detail.numero, detail.modelo].map(clean).filter(Boolean).join(' ');
  if (type === 'ipad') return ['iPad', detail.gama === 'Normal' ? '' : detail.gama].map(clean).filter(Boolean).join(' ');
  if (type === 'watch') return formatAppleWatchName(detail);
  if (type === 'otro') return clean(detail.descripcionOtro) || 'Otro producto';
  if (type === 'accesorios') return clean(detail.modelo || detail.gama || detail.descripcionOtro) || 'Accesorio';
  const typeLabel = type === 'macbook' ? 'MacBook' : clean(product?.tipo);
  return [typeLabel, detail.gama].map(clean).filter(Boolean).join(' ');
};
const compactNumber = (value) => {
  const raw = clean(value);
  if (!raw) return '';
  const amount = raw.match(/\d+(?:[.,]\d+)?/)?.[0]?.replace(',', '.');
  return amount || raw;
};
const formatScreen = (value) => {
  const amount = compactNumber(value);
  return amount ? `${amount}"` : '';
};
const buildCalculatorProductSummary = (product) => {
  const detail = product?.detalle || {};
  const type = clean(product?.tipo).toLowerCase();
  const values = [buildProductName(product)];
  const add = (value, numeric = false) => {
    const normalized = numeric ? compactNumber(value) : clean(value);
    if (normalized) values.push(normalized);
  };

  if (type === 'iphone') {
    add(detail.almacenamiento, true);
  } else if (type === 'watch') {
    add(detail.tamano, true);
    add(detail.conexion);
  } else {
    add(detail.procesador);
    add(formatScreen(detail.tamano));
    add(detail.ram, true);
    add(detail.almacenamiento, true);
  }
  return values.filter(Boolean).join(' · ');
};
const buildSoldSpecs = (product) => {
  const detail = product?.detalle || {};
  const type = clean(product?.tipo).toLowerCase();
  const specs = [];
  const add = (label, value) => {
    const normalized = clean(value);
    if (normalized) specs.push({ label, value: normalized });
  };

  if (type === 'iphone') {
    add('Almacenamiento', detail.almacenamiento);
  } else if (type === 'watch') {
    add('Serie', detail.generacion);
    add('Tamaño', detail.tamano);
    add('Conexión', detail.conexion);
  } else {
    add('Procesador', detail.procesador);
    add('Pantalla', formatScreen(detail.tamano));
    add('RAM', detail.ram);
    add(type === 'macbook' ? 'SSD' : 'Almacenamiento', detail.almacenamiento);
  }
  add('Estado', product?.estado);
  return specs;
};

export default function ModalCalculadora({ producto, onClose, embedded = false }) {
  const isAccessory = clean(producto?.tipo).toLowerCase() === 'accesorios';
  const accessoryLots = useMemo(() => {
    const source = Array.isArray(producto?.__lots) && producto.__lots.length
      ? producto.__lots
      : [producto];
    return source.filter((lot) => lot && (!isAccessory || accessoryLotAvailable(lot))).sort((a, b) => {
      const aPurchase = Date.parse(a?.valor?.fechaCompra || '');
      const bPurchase = Date.parse(b?.valor?.fechaCompra || '');
      const aTime = Number.isFinite(aPurchase) ? aPurchase : Number(a?.id || 0);
      const bTime = Number.isFinite(bPurchase) ? bPurchase : Number(b?.id || 0);
      return aTime - bTime || Number(a?.id || 0) - Number(b?.id || 0);
    });
  }, [producto, isAccessory]);
  const [selectedLotId, setSelectedLotId] = useState(() => String(accessoryLots[0]?.id || ''));
  const [cantidad, setCantidad] = useState('1');
  const selectedLot = accessoryLots.find((lot) => String(lot.id) === selectedLotId) || accessoryLots[0] || producto;
  // Valores base del producto
  const selectedValue = selectedLot?.valor || {};
  const simpleAccessory = isSimpleAccessory(selectedLot);
  const purchaseInSoles = simpleAccessory && String(selectedValue.monedaCompra || 'USD').toUpperCase() === 'PEN';
  const selectedShipping = Number(selectedValue.costoEnvioProrrateado ?? selectedValue.costoEnvio ?? 0);
  const selectedStoredCost = Number(selectedValue.costoTotalProrrateado ?? selectedValue.costoTotal ?? 0);
  const selectedTotalCost = selectedStoredCost > 0
    ? selectedStoredCost
    : Number(selectedValue.valorSoles || 0) + selectedShipping;
  const selectedUnits = Math.max(1, Number(selectedLot?.stockInicial || 1));
  const storedCostBase = isAccessory ? selectedTotalCost / selectedUnits : selectedTotalCost;
  const valorUSD = Number(selectedValue.valorProducto ?? 0) / (isAccessory ? selectedUnits : 1);
  const envioSoles = selectedShipping / (isAccessory ? selectedUnits : 1);

  const [precioCustom, setPrecioCustom] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [similarSales, setSimilarSales] = useState([]);

  const quotation = useAccessoryQuote({ enabled: isAccessory, productoId: producto?.id,
    cantidad: Number(cantidad), comprador: producto?.vendedor, loteInicialId: selectedLot?.id, precioUnitario: precioCustom });
  const costoTotalBase = isAccessory ? (quotation.quote?.costoTotal == null ? NaN : quotation.quote.costoTotal / Math.max(1, Number(cantidad))) : storedCostBase;

  // costo usado: si hay TC valido, (valorUSD * TC) + envio; si no, costoBase
  const costoUsado = useMemo(() => {
    const tc = Number(tipoCambio);
    if (isAccessory) {
      if (!Number.isFinite(tc) || tc <= 0 || !quotation.quote) return costoTotalBase;
      const parts = quotation.quote.lotes || consumedAccessoryLots(accessoryLots, selectedLot?.id, cantidad)
        .map(({ lot, quantity }) => ({ productoId: lot.id, cantidad: quantity }));
      const total = parts.reduce((sum, part) => {
        const lot = accessoryLots.find((item) => Number(item.id) === Number(part.productoId));
        const value = lot?.valor || {};
        const units = Math.max(1, Number(lot?.stockInicial || 1));
        const shipping = Number(value.costoEnvioProrrateado ?? value.costoEnvio ?? 0) / units;
        const unitCost = String(value.monedaCompra || 'USD').toUpperCase() === 'PEN'
          ? Number(part.costoUnitario ?? Number(value.valorProducto || 0) / units + shipping)
          : Number(value.valorProducto || 0) / units * tc + shipping;
        return sum + unitCost * Number(part.cantidad);
      }, 0);
      return total / Math.max(1, Number(cantidad));
    }
    if (isFinite(tc) && tc > 0) return valorUSD * tc + envioSoles;
    return costoTotalBase;
  }, [tipoCambio, valorUSD, envioSoles, costoTotalBase, isAccessory, quotation.quote, accessoryLots, selectedLot?.id, cantidad]);

  // Sugerencias basadas en el costo recalculado con el TC ingresado.
  const { pvMin, pvMed } = useMemo(() => {
    const pvMinRounded = simpleAccessory ? Math.ceil(costoUsado * 1.3 * 2 - 1e-9) / 2
      : isAccessory ? (quotation.quote?.precioMinimo ?? Math.ceil(costoUsado * 1.2 * 100) / 100) : roundUp10(costoUsado * 1.2);
    const pvMedRounded = simpleAccessory ? Math.ceil(costoUsado * 1.5 * 2 - 1e-9) / 2
      : isAccessory ? (quotation.quote?.precioUnitarioSugerido ?? Math.ceil(costoUsado * 1.3 * 100) / 100) : roundUp50(costoUsado * 1.3);
    return { pvMin: pvMinRounded, pvMed: pvMedRounded };
  }, [costoUsado, isAccessory, simpleAccessory, quotation.quote?.precioMinimo, quotation.quote?.precioUnitarioSugerido]);

  // Personalizado con redondeo a 10 hacia arriba
  const customOut = useMemo(() => {
    const pcRaw = Number(precioCustom);
    const pc = isNaN(pcRaw) ? NaN : (isAccessory ? pcRaw : roundUp10(pcRaw));
    const units = isAccessory ? Math.max(1, Number(cantidad || 1)) : 1;
    const ganancia = isNaN(pc) ? 0 : (pc - costoUsado) * units;
    const totalCost = costoUsado * units;
    const pct = !isNaN(pc) && totalCost > 0 ? (ganancia / totalCost) * 100 : 0;
    return { precio: pc, ganancia, pct, totalVenta: pc * units, totalCost };
  }, [precioCustom, costoUsado, cantidad, isAccessory]);

  const gananciaMin = pvMin - costoUsado;
  const gananciaMed = pvMed - costoUsado;
  const gananciaPorcentajeExacto = costoUsado * (simpleAccessory ? 0.5 : 0.3);
  const precioCotizado = precioCustom === '' ? pvMed : Number(precioCustom);
  const margenCotizado = precioCotizado > 0 && Number.isFinite(costoUsado)
    ? (precioCotizado - costoUsado) / precioCotizado * 100 : null;

  const toggleHistory = async () => {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    if (!nextOpen || historyLoaded || historyLoading || !producto?.id) return;
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await api.get(`/ventas/similares?productoId=${producto.id}&limit=8`);
      setSimilarSales(Array.isArray(data) ? data : [...(data?.coincidenciaExacta || []).map((sale) => ({ ...sale, __group: 'Coincidencia exacta' })), ...(data?.mismaFamilia || []).map((sale) => ({ ...sale, __group: 'Misma familia' }))]);
      setHistoryLoaded(true);
    } catch (error) {
      setHistoryError('No se pudieron cargar los últimos vendidos.');
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className={embedded ? 'w-full' : 'fixed inset-0 z-50 flex items-center justify-center bg-black/40'}>
      <div className={`relative w-full bg-white p-4 transition-all duration-300 sm:p-6 ${embedded ? '' : `mx-4 max-h-[90vh] overflow-y-auto rounded-xl shadow-lg ${historyOpen ? 'sm:max-w-5xl' : 'sm:max-w-lg'}`}`}>
        {/* Cerrar */}
        {!embedded && (
          <button
            className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            onClick={onClose}
            aria-label="Cerrar"
          >
            &times;
          </button>
        )}

        <div className="pr-10 sm:flex sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-1">Calculadora rapida</h2>
            <p className="text-sm text-gray-600 mb-4">
              Producto: <span className="font-medium">{buildCalculatorProductSummary(producto) || producto?.tipo}</span> - {isAccessory ? 'Costo unitario del lote' : 'Costo total base'}:{' '}
              <span className="font-semibold">{fmtSoles(costoTotalBase)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={toggleHistory}
            aria-expanded={historyOpen}
            className="mb-4 shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            {historyOpen ? 'Ocultar vendidos ←' : 'Últimos vendidos →'}
          </button>
        </div>

        <div className={historyOpen ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,0.8fr)]' : ''}>
          <div>
            {isAccessory && (
              <div className="mb-4 grid gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="calculadora-lote" className="block text-sm font-medium mb-2">Lote de compra</label>
                  <select id="calculadora-lote" value={selectedLotId} onChange={(event) => setSelectedLotId(event.target.value)} className="w-full rounded-lg border bg-white p-2">
                    {accessoryLots.map((lot) => {
                      const pickup = (lot.tracking || []).map((row) => row.fechaRecogido).filter(Boolean).sort()[0];
                      const purchase = String(lot?.valor?.fechaCompra || '').slice(0, 10);
                      return <option key={lot.id} value={lot.id}>{`Lote ${lot.id} · compra ${fmtDate(purchase)} · recojo ${fmtDate(pickup)} · ${lot.stockActual || 0} disponibles`}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label htmlFor="calculadora-cantidad" className="block text-sm font-medium mb-2">Unidades a vender</label>
                  <input id="calculadora-cantidad" type="number" min="1" max={quotation.quote?.disponible ?? producto.stockActual ?? 1} step="1" value={cantidad} onChange={(event) => setCantidad(event.target.value)} className="w-full rounded-lg border bg-white p-2" />
                </div>
                <p className="sm:col-span-2 text-xs text-indigo-800">Se usa primero el lote elegido y se completa con las siguientes compras. El costo total incluye todos los lotes necesarios.</p>
              </div>
            )}
            {/* Sugerencias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm text-gray-500 mb-1">{simpleAccessory ? 'Precio mínimo (+30%)' : isAccessory ? 'Precio mínimo' : 'Precio minimo (+20%)'}</div>
                <div className="text-2xl font-semibold">{fmtSoles(pvMin)}</div>
                <div className="text-sm text-gray-700 mt-1">
                  Ganancia: <strong>{fmtSoles(gananciaMin)}</strong>
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-gray-50">
                <div className="text-sm text-gray-500 mb-1">{simpleAccessory ? 'Precio sugerido (+50%)' : isAccessory ? 'Precio sugerido' : 'Precio medio (+30%)'}</div>
                <div className="text-2xl font-semibold">{fmtSoles(pvMed)}</div>
                <div className="text-sm text-gray-700 mt-1">
                  {simpleAccessory ? 'Ganancia unitaria al costo +50%:' : isAccessory ? 'Ganancia unitaria al costo +30%:' : '30% exacto:'} <strong>{fmtSoles(gananciaPorcentajeExacto)}</strong>
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {isAccessory ? 'Ganancia unitaria sugerida:' : 'Ganancia redondeada:'} <strong>{fmtSoles(gananciaMed)}</strong>
                </div>
              </div>
            </div>

            {isAccessory && <div aria-live="polite">{quotation.loading ? 'Cotizando…' : quotation.error ? <p role="alert">{quotation.error}</p> : <p>Margen sobre venta: {margenCotizado == null ? '—' : margenCotizado.toFixed(2) + '%'}</p>}</div>}
            {/* Personalizado con Tipo de Cambio */}
            <div className="border rounded-lg p-4">
              <div className={`grid grid-cols-1 ${purchaseInSoles ? '' : 'sm:grid-cols-2'} gap-3`}>
                <div>
                  <label htmlFor="calculadora-precio-personalizado" className="block text-sm font-medium mb-2">{isAccessory ? 'Precio unitario de venta (S/)' : 'Precio personalizado (S/)'}</label>
                  <input
                    id="calculadora-precio-personalizado"
                    type="number"
                    inputMode="decimal"
                    className="w-full border rounded-lg p-2"
                    placeholder="Ingresa un precio en soles"
                    value={precioCustom}
                    onChange={(e) => setPrecioCustom(e.target.value)}
                  />
                </div>
                {!purchaseInSoles && <div>
                  <label htmlFor="calculadora-tipo-cambio" className="block text-sm font-medium mb-2">Tipo de cambio (US$ a S/)</label>
                  <input
                    id="calculadora-tipo-cambio"
                    type="number"
                    inputMode="decimal"
                    className="w-full border rounded-lg p-2"
                    placeholder={`Opcional: p.ej. ${TC_FIJO}`}
                    value={tipoCambio}
                    onChange={(e) => setTipoCambio(e.target.value)}
                  />
                  <div className="text-xs text-gray-600 mt-1">
                    {isAccessory ? 'Simula el costo con el tipo de cambio ingresado; la compra guardada no se modifica.' : 'Si ingresas TC, costo = (valor US$ x TC) + envio.'}
                  </div>
                </div>}
              </div>

              <div className="text-sm text-gray-700 mt-3 space-y-1">
                {!purchaseInSoles && <div className="flex justify-between"><span>Valor (US$):</span><strong>{isNaN(valorUSD) ? '-' : `$ ${valorUSD.toFixed(2)}`}</strong></div>}
                {(!simpleAccessory || envioSoles > 0) && <div className="flex justify-between"><span>Envio (S/):</span><strong>{fmtSoles(envioSoles)}</strong></div>}
                <div className="flex justify-between"><span>{purchaseInSoles ? 'Costo unitario de compra (S/):' : isAccessory ? 'Costo unitario usado:' : 'Costo usado:'}</span><strong>{fmtSoles(costoUsado)}</strong></div>
                <div className="flex justify-between pt-1"><span>{isAccessory ? 'Precio unitario aplicado:' : 'Precio aplicado (x10 arriba):'}</span><strong>{isNaN(customOut.precio) ? '-' : fmtSoles(customOut.precio)}</strong></div>
                {isAccessory && <div className="flex justify-between"><span>Venta total:</span><strong>{isNaN(customOut.totalVenta) ? '-' : fmtSoles(customOut.totalVenta)}</strong></div>}
                {isAccessory && (!simpleAccessory || Number(cantidad) > 1) && <div className="flex justify-between"><span>Costo total:</span><strong>{fmtSoles(customOut.totalCost)}</strong></div>}
                <div className="flex justify-between"><span>Ganancia estimada:</span><strong>{fmtSoles(customOut.ganancia)}</strong></div>
                <div className="flex justify-between"><span>Margen sobre costo:</span><strong>{isNaN(customOut.pct) ? '-' : `${customOut.pct.toFixed(2)} %`}</strong></div>
              </div>
            </div>
          </div>

          {historyOpen && (
            <aside className="border-t border-slate-200 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0" aria-label="Últimos equipos vendidos similares">
              <h3 className="text-base font-semibold text-slate-950">Últimos vendidos similares</h3>
              <p className="mt-1 text-xs text-slate-500">{isAccessory ? 'Primero la misma variante y estado; después otras variantes de la familia.' : 'Mismo producto, procesador y tamaño de pantalla.'}</p>
              {historyLoading ? (
                <div className="py-8 text-center text-sm text-slate-500">Cargando...</div>
              ) : historyError ? (
                <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{historyError}</div>
              ) : similarSales.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">No hay vendidos similares.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {similarSales.map((sale, index) => {
                    const soldProduct = sale?.producto || {};
                    const soldSpecs = buildSoldSpecs(soldProduct);
                    return (
                      <React.Fragment key={sale.id}>
                      {sale.__group && (index === 0 || sale.__group !== similarSales[index - 1].__group) && <h4 className="font-semibold">{sale.__group}</h4>}
                      <article className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <strong className="text-sm text-slate-950">{buildProductName(soldProduct) || 'Producto'}</strong>
                          <strong className="whitespace-nowrap text-sm text-emerald-700">{isAccessory ? fmtSoles(sale.precioUnitario) + ' / unidad' : fmtSoles(sale.precioVenta)}</strong>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                          {soldSpecs.map((spec) => <span key={spec.label}>{spec.label}: <b>{spec.value}</b></span>)}
                          <span>Cantidad: <b>{sale.cantidad ?? 1}</b></span>
                          <span>Precio por unidad: <b>{fmtSoles(sale.precioUnitario ?? Number(sale.precioVenta || 0) / Math.max(1, Number(sale.cantidad || 1)))}</b></span>
                          <span>Total: <b>{fmtSoles(sale.total ?? sale.precioVenta)}</b></span>
                          <span>Fecha venta: <b>{fmtDate(sale.fechaVenta)}</b></span>
                          <span>Días hasta venta: <b>{sale.diasHastaVenta != null ? `${sale.diasHastaVenta} días` : '—'}</b></span>
                        </div>
                      </article>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
