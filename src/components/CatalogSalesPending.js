import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import { notifySalesChanged } from '../utils/salesSync';

const eventLabel = (event) => event.eventType === 'sale.cancelled' ? 'Anulación' : 'Venta';
const statusLabel = (status) => ({
  pending_confirmation: 'Pendiente de confirmar',
  pending_cancellation_confirmation: 'Anulación pendiente',
  failed: 'Requiere revisión',
}[status] || status);
const DEBIT_CARD_LABEL = { bcp: 'BCP', interbank: 'Interbank', bbva: 'BBVA' };
const PAYMENT_LABELS = { direct: 'Pago directo', card: 'Tarjeta de crédito', debt: 'x500', cash: 'Efectivo' };
const PAYMENT_TYPES = Object.keys(PAYMENT_LABELS);
const toCents = (value) => Math.round(Number(value || 0) * 100);
const selectedParts = (values) => PAYMENT_TYPES.filter((type) => String(values?.[type] ?? '') !== '')
  .map((type) => ({ type, amount: Number(values[type]) }));
const validParts = (parts, total) => parts.length > 0
  && parts.every((part) => Number.isFinite(part.amount) && part.amount > 0 && Math.abs(toCents(part.amount) / 100 - part.amount) < 0.000001)
  && parts.reduce((sum, part) => sum + toCents(part.amount), 0) === toCents(total);

function PaymentParts({ sku, values, selectedTypes, onSelect, onRemove, onChange, total, bankControl }) {
  const parts = selectedParts(values);
  const allocated = parts.reduce((sum, part) => sum + (Number.isFinite(part.amount) ? toCents(part.amount) : 0), 0);
  const balanceFor = (type) => {
    const partner = selectedTypes.length > 1 ? [...selectedTypes].reverse().find((selected) => selected !== type) : null;
    const fixed = selectedTypes.filter((selected) => selected !== type && selected !== partner)
      .reduce((sum, selected) => sum + (Number.isFinite(Number(values?.[selected])) ? toCents(values?.[selected]) : 0), 0);
    return { partner, maximum: Math.max(0, toCents(total) - fixed) };
  };
  const changeAmount = (type, raw) => {
    const { partner, maximum } = balanceFor(type);
    const requested = Number(raw);
    const value = raw !== '' && Number.isFinite(requested) && requested > maximum / 100
      ? (maximum > 0 ? String(maximum / 100) : '') : raw;
    const remainder = partner ? Math.max(0, maximum - toCents(value)) : 0;
    onChange(type, value, partner, partner && remainder > 0 ? String(remainder / 100) : '');
  };
  const maxFor = (type) => balanceFor(type).maximum;
  const [adding, setAdding] = useState(false);
  const available = PAYMENT_TYPES.filter((type) => !selectedTypes.includes(type));
  const showChoices = selectedTypes.length === 0 || (adding && selectedTypes.length < 4);
  return <div className="min-w-52 space-y-1.5">
    {selectedTypes.map((type) => <div key={type} className="flex items-center gap-1">
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700" title={PAYMENT_LABELS[type]}>{PAYMENT_LABELS[type]}</span>
      <input aria-label={`${PAYMENT_LABELS[type]} para ${sku}`} type="number" min="0.01" max={(maxFor(type) / 100).toFixed(2)} step="0.01" placeholder="S/ 0.00"
        value={values?.[type] ?? ''} onChange={(event) => changeAmount(type, event.target.value)}
        className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-xs focus:border-amber-600 focus:outline-none" />
      <button type="button" aria-label={`Quitar ${PAYMENT_LABELS[type]} para ${sku}`} title="Quitar" onClick={() => onRemove(type)}
        className="rounded px-1 text-sm text-slate-400 hover:text-red-700">×</button>
    </div>)}
    {showChoices && <select aria-label={`Agregar forma de cobro para ${sku}`} value=""
      onChange={(event) => { if (event.target.value) onSelect(event.target.value, selectedTypes.length ? Math.max(0, toCents(total) - allocated) / 100 : null); setAdding(false); }}
      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700">
      <option value="">{selectedTypes.length ? 'Elegir otra forma...' : 'Elegir forma de cobro...'}</option>
      {available.map((type) => <option key={type} value={type}>{PAYMENT_LABELS[type]}</option>)}
    </select>}
    {selectedTypes.length > 0 && <>
      {selectedTypes.length < 4 && !adding && <button type="button" onClick={() => setAdding(true)}
        className="text-xs font-medium text-amber-800 hover:underline">+ Otro medio</button>}
      {bankControl && selectedTypes.some((type) => type !== 'cash') && bankControl}
      <p className={`text-xs ${allocated === toCents(total) && parts.length === selectedTypes.length ? 'text-emerald-700' : 'text-amber-800'}`}>
        S/ {(allocated / 100).toFixed(2)} / {Number(total || 0).toFixed(2)}
      </p>
    </>}
  </div>;
}

export default function CatalogSalesPending() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState(() => new Set());
  const busyIdsRef = useRef(new Set());
  const rateTimersRef = useRef(new Map());
  const submittedRatesRef = useRef(new Map());
  const rateSavesRef = useRef(new Map());
  const [error, setError] = useState('');
  const [exchangeRates, setExchangeRates] = useState({});
  const [paymentOptions, setPaymentOptions] = useState({});
  const [incomeBanks, setIncomeBanks] = useState({});
  const [payments, setPayments] = useState({});
  const [paymentSelections, setPaymentSelections] = useState({});
  const [showManual, setShowManual] = useState(false);
  const [manualProducts, setManualProducts] = useState([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSaving, setManualSaving] = useState(false);
  const [manual, setManual] = useState({ productId: '', seller: '', amount: '', exchangeRate: '3.7', soldAt: '', incomeBank: 'bcp' });
  const [manualPayments, setManualPayments] = useState({});
  const [manualSelection, setManualSelection] = useState([]);

  const refresh = useCallback(async () => {
    try {
      const rows = await api.get('/integrations/catalog-sales/pending');
      const list = Array.isArray(rows) ? rows : [];
      setItems(list);
      const created = list.filter((event) => event.eventType === 'sale.created');
      const optionEntries = await Promise.all(created.map(async (event) => {
        try {
          return [event.id, await api.get(`/integrations/catalog-sales/${event.id}/payment-options`)];
        } catch {
          return [event.id, { owner: null, seller: null, cards: [] }];
        }
      }));
      const optionMap = Object.fromEntries(optionEntries);
      setPaymentOptions(optionMap);
      setIncomeBanks((current) => {
        const next = { ...current };
        optionEntries.forEach(([id, options]) => {
          const available = Array.isArray(options?.cards) ? options.cards : [];
          if (!available.some((card) => card.tipo === next[id])) next[id] = available[0]?.tipo || '';
        });
        return next;
      });
      setExchangeRates((current) => {
        const next = { ...current };
        for (const event of Array.isArray(rows) ? rows : []) {
          if (next[event.id] === undefined) {
            const received = Number(event.exchangeRate);
            next[event.id] = Number.isFinite(received) && received > 0 ? String(received) : '3.7';
          }
        }
        return next;
      });
      setError('');
    } catch (err) {
      setError('No se pudieron consultar las ventas enviadas por el catálogo.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    const rateTimers = rateTimersRef.current;
    return () => {
      window.clearInterval(timer);
      rateTimers.forEach((pending) => window.clearTimeout(pending));
    };
  }, [refresh]);

  const startBusy = (eventId) => {
    if (busyIdsRef.current.has(eventId)) return false;
    busyIdsRef.current = new Set(busyIdsRef.current).add(eventId);
    setBusyIds(new Set(busyIdsRef.current));
    return true;
  };

  const finishBusy = (eventId) => {
    const next = new Set(busyIdsRef.current);
    next.delete(eventId);
    busyIdsRef.current = next;
    setBusyIds(new Set(next));
  };

  const act = async (event, action) => {
    if (busyIdsRef.current.has(event.id)) return;
    const isCancellation = event.eventType === 'sale.cancelled';
    const exchangeRate = Number(exchangeRates[event.id]);
    const incomeBank = incomeBanks[event.id];
    const incomeParts = selectedParts(payments[event.id]);
    if (action === 'confirm' && !isCancellation && (!Number.isFinite(exchangeRate) || exchangeRate <= 0)) {
      alert('Ingresa un tipo de cambio válido.');
      return;
    }
    if (action === 'confirm' && !isCancellation && incomeParts.some((part) => part.type !== 'cash') && !incomeBank) {
      alert('Selecciona la tarjeta de débito donde se recibió el pago.');
      return;
    }
    if (action === 'confirm' && !isCancellation && (incomeParts.length !== (paymentSelections[event.id] || []).length || !validParts(incomeParts, event.amount))) {
      alert('Distribuye el precio completo entre las formas de cobro seleccionadas.');
      return;
    }
    const message = action === 'confirm'
      ? isCancellation
        ? `¿Confirmar la anulación de la venta ${event.sku}? Esto eliminará la venta de Servicios y restaurará su stock.`
        : `¿Confirmar la venta ${event.sku} por S/ ${Number(event.amount).toFixed(2)} con tipo de cambio ${exchangeRate.toFixed(4)}?`
      : `¿Rechazar esta ${isCancellation ? 'anulación' : 'venta'}?`;
    if (!window.confirm(message)) return;
    if (!startBusy(event.id)) return;
    try {
      await api.post(
        `/integrations/catalog-sales/${event.id}/${action}`,
        action === 'confirm' && !isCancellation ? { exchangeRate, incomeBank, incomeParts } : {},
      );
      await refresh();
      notifySalesChanged({ source: 'catalog-sync', action, sku: event.sku });
      window.dispatchEvent(new Event('productos-updated'));
    } catch (err) {
      alert(err?.message || 'No se pudo completar la operación.');
      await refresh();
    } finally {
      finishBusy(event.id);
    }
  };

  const saveExchangeRate = async (event, value = exchangeRates[event.id]) => {
    const exchangeRate = Number(value);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate === Number(event.exchangeRate) || submittedRatesRef.current.get(event.id) === exchangeRate) return;
    submittedRatesRef.current.set(event.id, exchangeRate);
    const previous = rateSavesRef.current.get(event.id) || Promise.resolve();
    const save = previous.catch(() => {}).then(() => api.post(`/integrations/catalog-sales/${event.id}/exchange-rate`, { exchangeRate }));
    rateSavesRef.current.set(event.id, save);
    try {
      await save;
    } catch (err) {
      if (submittedRatesRef.current.get(event.id) === exchangeRate) submittedRatesRef.current.delete(event.id);
      setError(err?.message || 'No se pudo guardar el tipo de cambio.');
    }
  };

  const scheduleExchangeRate = (event, value) => {
    window.clearTimeout(rateTimersRef.current.get(event.id));
    rateTimersRef.current.set(event.id, window.setTimeout(() => {
      rateTimersRef.current.delete(event.id);
      saveExchangeRate(event, value);
    }, 800));
  };

  const openManual = async () => {
    setShowManual(true);
    setManualLoading(true);
    try {
      const products = await api.get('/productos');
      const productList = Array.isArray(products) ? products : (Array.isArray(products?.items) ? products.items : []);
      const available = productList.filter((product) => !product.catalogoEnviado && Number(product.stockActual ?? 1) > 0);
      const ids = available.map((product) => product.id);
      const sales = ids.length ? await api.get(`/ventas/ultimas?ids=${ids.join(',')}`) : [];
      const soldIds = new Set((Array.isArray(sales) ? sales : []).map((sale) => Number(sale.productoId)));
      setManualProducts(available.filter((product) => String(product.tipo || '').toLowerCase() === 'accesorios' || !soldIds.has(Number(product.id))));
    } catch (err) {
      setError(err?.message || 'No se pudieron cargar los productos.');
    } finally {
      setManualLoading(false);
    }
  };

  const saveManual = async (event) => {
    event.preventDefault();
    const product = manualProducts.find((item) => String(item.id) === manual.productId);
    const amount = Number(manual.amount);
    const exchangeRate = Number(manual.exchangeRate);
    const incomeParts = selectedParts(manualPayments);
    if (!product || !manual.seller || !manual.soldAt || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      setError('Completa el producto, vendedor, fecha, precio y tipo de cambio de la venta.');
      return;
    }
    if (incomeParts.length !== manualSelection.length || !validParts(incomeParts, amount)) {
      setError('Distribuye el precio completo entre las formas de cobro seleccionadas.');
      return;
    }
    if (incomeParts.some((part) => part.type !== 'cash') && !manual.incomeBank) {
      setError('Selecciona la cuenta de débito para el cobro.');
      return;
    }
    if (!window.confirm(`¿Registrar la venta de ${product.codigoInventario || product.id} por S/ ${amount.toFixed(2)}?`)) return;
    setManualSaving(true);
    setError('');
    try {
      await api.post('/ventas', {
        productoId: product.id, fechaVenta: manual.soldAt, precioVenta: amount, tipoCambio: exchangeRate,
        vendedor: manual.seller, incomeBank: manual.incomeBank, incomeParts,
        incomeSku: `MS-${product.codigoInventario || product.id}`,
      });
      setShowManual(false);
      setManualPayments({});
      setManualSelection([]);
      setManual({ productId: '', seller: '', amount: '', exchangeRate: '3.7', soldAt: '', incomeBank: 'bcp' });
      notifySalesChanged({ source: 'manual-catalog-sale', action: 'create', productoId: product.id });
      window.dispatchEvent(new Event('productos-updated'));
      await refresh();
    } catch (err) {
      setError(err?.message || 'No se pudo registrar la venta.');
    } finally {
      setManualSaving(false);
    }
  };



  return (
    <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-amber-950">Ventas recibidas del catálogo</h3>
          <p className="text-sm text-amber-800">Nada se registra ni se anula en Servicios hasta que lo confirmes aquí.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openManual} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white">Venta que no pasó a catálogo</button>
          <button type="button" onClick={refresh} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-900 transition active:translate-y-px active:scale-[0.98] active:bg-amber-100">Actualizar</button>
        </div>
      </div>

      {showManual && <form onSubmit={saveManual} className="mt-4 space-y-3 rounded-xl border border-amber-300 bg-white p-4">
        <div className="flex items-center justify-between"><h4 className="font-semibold">Registrar venta sin catálogo</h4><button type="button" onClick={() => setShowManual(false)}>Cerrar</button></div>
        {manualLoading ? <p>Cargando productos...</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Producto
            <select aria-label="Producto sin catálogo" value={manual.productId} onChange={(event) => {
              const product = manualProducts.find((item) => String(item.id) === event.target.value);
              setManual((current) => ({ ...current, productId: event.target.value, seller: product?.vendedor || '' }));
            }} className="mt-1 w-full rounded border p-2" required>
              <option value="">Seleccionar</option>
              {manualProducts.map((product) => <option key={product.id} value={product.id}>{product.codigoInventario || product.id} · {product.nombre || product.modelo || product.tipo || 'Producto'}</option>)}
            </select>
          </label>
          <label className="text-sm">Vendedor
            <select aria-label="Vendedor de venta manual" value={manual.seller} onChange={(event) => setManual((current) => ({ ...current, seller: event.target.value }))} className="mt-1 w-full rounded border p-2" required>
              <option value="">Seleccionar</option>
              {manual.seller && !['Gonzalo', 'Renato', 'Ambos'].includes(manual.seller) && <option value={manual.seller}>{manual.seller}</option>}
              <option value="Gonzalo">Gonzalo</option><option value="Renato">Renato</option><option value="Ambos">Ambos</option>
            </select>
          </label>
          <label className="text-sm">Fecha de venta<input aria-label="Fecha de venta manual" type="date" value={manual.soldAt} onChange={(event) => setManual((current) => ({ ...current, soldAt: event.target.value }))} className="mt-1 w-full rounded border p-2" required /></label>
          <label className="text-sm">Precio de venta S/<input aria-label="Precio de venta manual" type="number" min="0.01" step="0.01" value={manual.amount} onChange={(event) => setManual((current) => ({ ...current, amount: event.target.value }))} className="mt-1 w-full rounded border p-2" required /></label>
          <label className="text-sm">Tipo de cambio<input aria-label="Tipo de cambio manual" type="number" min="0.0001" step="0.0001" value={manual.exchangeRate} onChange={(event) => setManual((current) => ({ ...current, exchangeRate: event.target.value }))} className="mt-1 w-full rounded border p-2" required /></label>
        </div>}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
          <h5 className="mb-2 text-sm font-semibold text-amber-950">Forma de cobro</h5>
          <PaymentParts sku="venta manual" values={manualPayments} selectedTypes={manualSelection} total={manual.amount}
            onSelect={(type, remainder) => { setManualSelection((current) => [...current, type]); if (remainder > 0) setManualPayments((current) => ({ ...current, [type]: String(remainder) })); }}
            onRemove={(type) => { setManualSelection((current) => current.filter((item) => item !== type)); setManualPayments((current) => ({ ...current, [type]: '' })); }}
            onChange={(type, value, partner, partnerValue) => setManualPayments((current) => ({ ...current, [type]: value, ...(partner ? { [partner]: partnerValue } : {}) }))}
            bankControl={<label className="block text-xs font-medium text-slate-700">Cuenta que recibió el pago
              <select aria-label="Cuenta de débito para venta manual" value={manual.incomeBank} onChange={(event) => setManual((current) => ({ ...current, incomeBank: event.target.value }))} className="mt-1 block w-full rounded-lg border border-amber-300 bg-white p-2 text-sm">
                {Object.entries(DEBIT_CARD_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>} />
        </div>
        <button type="submit" disabled={manualSaving || manualLoading} className="rounded bg-emerald-700 px-4 py-2 font-medium text-white disabled:opacity-50">{manualSaving ? 'Registrando...' : 'Registrar venta'}</button>
      </form>}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {loading ? (
        <p className="mt-3 text-sm text-amber-800">Consultando pendientes...</p>
      ) : items.length > 0 ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-amber-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-amber-100/70 text-left text-amber-950">
              <tr>
                <th className="p-3">Precio de costo</th>
                <th className="p-3">Operación</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Monto</th>
                <th className="p-3">Forma de cobro</th>
                <th className="p-3">T. cambio</th>
                <th className="p-3">Fecha</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((event) => (
                <tr key={event.id} className="border-t border-amber-100">
                  <td className="p-3 font-semibold text-slate-900">
                    {event.costUsd == null ? '-' : `$ ${Number(event.costUsd).toFixed(2)}`}
                  </td>
                  <td className="p-3 font-medium">{eventLabel(event)}</td>
                  <td className="p-3">{event.sku}</td>
                  <td className="p-3">S/ {Number(event.amount).toFixed(2)}</td>
                  <td className="p-3 align-top">{event.eventType === 'sale.created' ? <PaymentParts sku={event.sku} values={payments[event.id]}
                    selectedTypes={paymentSelections[event.id] || []} total={event.amount}
                    onSelect={(type, remainder) => { setPaymentSelections((current) => ({ ...current, [event.id]: [...(current[event.id] || []), type] })); if (remainder > 0) setPayments((current) => ({ ...current, [event.id]: { ...current[event.id], [type]: String(remainder) } })); }}
                    onRemove={(type) => { setPaymentSelections((current) => ({ ...current, [event.id]: (current[event.id] || []).filter((item) => item !== type) })); setPayments((current) => ({ ...current, [event.id]: { ...current[event.id], [type]: '' } })); }}
                    onChange={(type, value, partner, partnerValue) => setPayments((current) => ({ ...current, [event.id]: { ...current[event.id], [type]: value, ...(partner ? { [partner]: partnerValue } : {}) } }))}
                    bankControl={<label className="block text-xs font-medium text-slate-700">Recibido en (débito)
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">Venta de {paymentOptions[event.id]?.seller || 'vendedor sin asignar'}</span>
                      <select aria-label={`Tarjeta de débito receptora para ${event.sku}`} value={incomeBanks[event.id] || ''}
                        onChange={(e) => setIncomeBanks((current) => ({ ...current, [event.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm">
                        {!paymentOptions[event.id]?.cards?.length && <option value="">Sin tarjetas de débito</option>}
                        {(paymentOptions[event.id]?.cards || []).map((card) => <option key={card.tipo} value={card.tipo}>{DEBIT_CARD_LABEL[card.tipo] || card.tipo}</option>)}
                      </select>
                    </label>} /> : '-'}</td>
                  <td className="p-3">
                    {event.eventType === 'sale.created' ? (
                      <input
                        aria-label={`Tipo de cambio para ${event.sku}`}
                        type="number"
                        min="0.0001"
                        step="0.0001"
                        value={exchangeRates[event.id] ?? ''}
                        onChange={(changeEvent) => {
                          const value = changeEvent.target.value;
                          setExchangeRates((current) => ({ ...current, [event.id]: value }));
                          scheduleExchangeRate(event, value);
                        }}
                        onBlur={() => {
                          window.clearTimeout(rateTimersRef.current.get(event.id));
                          rateTimersRef.current.delete(event.id);
                          saveExchangeRate(event);
                        }}
                        className="w-28 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-slate-900"
                        placeholder="Ej: 3.75"
                      />
                    ) : '-'}
                  </td>
                  <td className="p-3">{new Date(event.soldAt).toLocaleDateString('es-PE')}</td>
                  <td className="p-3" title={event.error || ''}>{statusLabel(event.status)}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={busyIds.has(event.id)}
                        onClick={() => act(event, 'confirm')}
                        className={`rounded-lg px-3 py-1.5 font-medium text-white shadow-sm transition active:translate-y-px active:scale-[0.97] disabled:cursor-wait disabled:opacity-50 ${event.eventType === 'sale.cancelled' ? 'bg-red-600 active:bg-red-800' : 'bg-emerald-600 active:bg-emerald-800'}`}
                      >
                        {busyIds.has(event.id) ? 'Procesando...' : event.eventType === 'sale.cancelled' ? 'Confirmar anulación' : 'Confirmar venta'}
                      </button>
                      {event.eventType !== 'sale.cancelled' && (
                        <>
                          <button
                            type="button"
                            disabled={busyIds.has(event.id)}
                            onClick={() => act(event, 'reject')}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 font-medium text-slate-700 shadow-sm transition active:translate-y-px active:scale-[0.97] active:bg-slate-200 disabled:cursor-wait disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
