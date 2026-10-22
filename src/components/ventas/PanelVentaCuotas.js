import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api';
import { btnCls, btnPrimaryCls, Campo, Cifra, hoy, inputCls, money } from '../finanzas/ui';
import { notifyGastosChanged } from '../../utils/gastosSync';
import { notifySalesChanged } from '../../utils/salesSync';

const cents = (value) => Math.round(Number(value || 0) * 100);
const bancoEditable = (value) => ['bcp', 'interbank', 'bbva'].includes(value) ? value : 'bcp';
const fecha = (value) => value ? new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : 'Sin fecha';
const button = `${btnCls} min-h-[44px] focus-visible:ring-2 focus-visible:ring-slate-500`;
const primary = `${btnPrimaryCls} min-h-[44px] focus-visible:ring-2 focus-visible:ring-slate-500`;
const field = `${inputCls} min-h-[44px]`;

export default function PanelVentaCuotas({ adelantoId, onClose, onChanged, iniciarPago = false, initialIndex = null }) {
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const [confirmacion, setConfirmacion] = useState(null);
  const dialog = useRef(null);
  const title = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const mounted = useRef(true);

  const cargar = useCallback(async () => {
    const data = await api.get(`/ventas/adelanto/${adelantoId}`);
    if (mounted.current) setResumen(data);
    return data;
  }, [adelantoId]);

  useEffect(() => {
    mounted.current = true;
    const opener = document.activeElement;
    title.current?.focus();
    cargar().then((data) => {
      if (!mounted.current) return;
      const pago = data.pagos.find((item) => item.index === initialIndex && item.editable);
      if (pago) setForm({ mode: 'edit', index: pago.index, monto: String(pago.monto), fecha: String(pago.fecha).slice(0, 10), banco: bancoEditable(pago.banco), tipoPago: pago.tipoPago });
      else if (iniciarPago && data.estado === 'reservado') setForm({ mode: 'pay', monto: String(data.falta), fecha: hoy(), banco: 'bcp', tipoPago: 'direct', cerrar: true, fechaVenta: hoy(), tipoCambio: '' });
    }).catch((err) => { if (mounted.current) setError(err.message); });
    const keyboard = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab') return;
      const items = [...(dialog.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])];
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === title.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', keyboard);
    return () => { mounted.current = false; document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', keyboard); if (opener?.isConnected) opener.focus(); };
  }, [cargar, initialIndex, iniciarPago]);

  const openForm = (mode, pago) => {
    setError(''); setSuccess(''); setConfirmacion(null);
    setForm(pago ? { mode: 'edit', index: pago.index, monto: String(pago.monto), fecha: String(pago.fecha).slice(0, 10), banco: bancoEditable(pago.banco), tipoPago: pago.tipoPago }
      : { mode, monto: resumen.estado === 'vendido' ? '' : String(resumen.falta), fecha: hoy(), banco: 'bcp', tipoPago: 'direct', cerrar: true, fechaVenta: hoy(), tipoCambio: '' });
  };
  const change = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(''); };
  const mutate = async (action, message) => {
    setBusy(true); setError('');
    let changed = false;
    try {
      await action(); changed = true;
      setForm(null); setConfirmacion(null);
      const data = await cargar();
      setSuccess(message);
      await onChanged?.(data);
    } catch (err) { setError(err.message || 'No se pudo completar el cambio. Intenta otra vez.'); }
    finally {
      if (changed) {
        try { localStorage.removeItem('ganancias:cache:v2'); } catch {}
        notifyGastosChanged({ action: 'advance-update', adelantoId });
        notifySalesChanged({ action: 'update', adelantoId, productoId: resumen?.productoId });
      }
      setBusy(false);
    }
  };
  const cierre = resumen?.pagos.find((pago) => pago.origen === 'cierre');
  // En una venta cerrada se puede registrar otro pago tomando parte del cobro al cerrar.
  const puedeAgregar = resumen && (resumen.estado === 'reservado'
    || (resumen.estado === 'vendido' && cierre?.editable && cents(cierre.monto) > 0));
  const submit = (event) => {
    event.preventDefault();
    const monto = Number(form.monto);
    const original = resumen.pagos.find((pago) => pago.index === form.index);
    const max = (resumen.estado === 'vendido' ? cents(cierre?.monto) : cents(resumen.falta)) + (form.mode === 'edit' ? cents(original?.monto) : 0);
    const closing = form.mode === 'close' || (form.mode === 'pay' && form.cerrar && cents(monto) === cents(resumen.falta));
    if (form.mode !== 'close' && (!Number.isFinite(monto) || monto <= 0 || Math.abs(cents(monto) / 100 - monto) > 0.000001)) {
      setError('Ingresa un monto mayor a cero con hasta dos decimales.'); return;
    }
    if (form.mode === 'pay' && cents(monto) > max) {
      setError(resumen.estado === 'vendido'
        ? `El pago no puede superar el cobro al cerrar (${money(max / 100)}); ese cobro se reduce en lo que registres.`
        : `El pago supera lo que falta (${money(resumen.falta)}).`);
      return;
    }
    if (closing && (!form.fechaVenta || !Number.isFinite(Number(form.tipoCambio)) || Number(form.tipoCambio) <= 0)) { setError('Indica la fecha de venta y un tipo de cambio mayor a cero.'); return; }
    if (form.mode !== 'close' && !form.fecha) { setError('Selecciona la fecha del pago.'); return; }
    const payload = { montoCuota: monto, fechaCuota: form.fecha, incomeBank: form.banco, incomePaymentType: form.tipoPago };
    if (form.mode === 'close') return mutate(() => api.post(`/ventas/adelanto/${adelantoId}/completar`, { fechaVenta: form.fechaVenta, tipoCambio: Number(form.tipoCambio) }), 'Venta cerrada.');
    if (form.mode === 'edit' && form.index === -1) return mutate(() => api.patch(`/ventas/${resumen.ventaId}`, {
      precioVenta: (cents(resumen.precio) - cents(original.monto) + cents(monto)) / 100, fechaVenta: form.fecha,
      incomeBank: form.banco, incomeParts: [{ type: form.tipoPago, amount: monto }],
    }), 'Cobro al cerrar corregido.');
    if (closing) payload.cerrarVenta = { fechaVenta: form.fechaVenta, tipoCambio: Number(form.tipoCambio) };
    return mutate(() => form.mode === 'edit' ? api.patch(`/ventas/adelanto/${adelantoId}/cuotas/${form.index}`, payload) : api.post(`/ventas/adelanto/${adelantoId}/cuotas`, payload), form.mode === 'edit' ? 'Pago corregido.' : closing ? 'Pago registrado y venta cerrada.' : 'Pago registrado.');
  };

  const renderForm = () => <form onSubmit={submit} noValidate className="space-y-3 border-y border-slate-200 py-4">
    <h3 className="font-medium">{form.mode === 'edit' ? 'Corregir pago' : form.mode === 'close' ? 'Cerrar venta' : 'Registrar pago'}</h3>
    {form.mode !== 'close' && <>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Monto (S/)"><input name="monto" autoComplete="off" className={field} inputMode="decimal" type="number" step="0.01" value={form.monto} onChange={(event) => change('monto', event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? 'cuotas-error' : undefined} /></Campo>
        <Campo label="Fecha del pago"><input name="fecha" className={field} type="date" value={form.fecha} onChange={(event) => change('fecha', event.target.value)} /></Campo>
        <Campo label="Forma de pago"><select name="tipoPago" className={field} value={form.tipoPago} onChange={(event) => change('tipoPago', event.target.value)}><option value="direct">Directo</option><option value="card">Tarjeta</option>{['cash', 'debt'].includes(form.tipoPago) && <option value={form.tipoPago}>{form.tipoPago === 'cash' ? 'Efectivo' : 'x500'}</option>}</select></Campo>
        <Campo label="Cuenta"><select name="banco" className={field} value={form.banco} onChange={(event) => change('banco', event.target.value)}><option value="bcp">BCP</option><option value="interbank">Interbank</option><option value="bbva">BBVA</option></select></Campo>
      </div>
    </>}
    {form.mode === 'pay' && cents(form.monto) === cents(resumen.falta) && <Campo label="Cerrar la venta con este pago"><input name="cerrar" type="checkbox" className="h-5 w-5" checked={form.cerrar} onChange={(event) => change('cerrar', event.target.checked)} /></Campo>}
    {(form.mode === 'close' || (form.mode === 'pay' && form.cerrar && cents(form.monto) === cents(resumen.falta))) && <div className="grid grid-cols-2 gap-3">
      <Campo label="Fecha de venta"><input name="fechaVenta" className={field} type="date" value={form.fechaVenta} onChange={(event) => change('fechaVenta', event.target.value)} /></Campo>
      <Campo label="Tipo de cambio"><input name="tipoCambio" autoComplete="off" className={field} type="number" step="0.0001" inputMode="decimal" value={form.tipoCambio} onChange={(event) => change('tipoCambio', event.target.value)} /></Campo>
    </div>}
    {error && <p id="cuotas-error" className="text-sm text-red-700" aria-live="polite">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">
      {form.mode === 'edit' && form.index >= 0 && <button type="button" className={`${button} mr-auto text-red-700`} onClick={() => setConfirmacion({ type: 'remove', pago: resumen.pagos.find((item) => item.index === form.index) })}>Quitar pago</button>}
      <button type="button" className={button} onClick={() => { setForm(null); setError(''); }}>Volver</button>
      <button type="submit" disabled={busy} className={primary}>{busy ? 'Guardando…' : form.mode === 'edit' ? 'Corregir pago' : form.mode === 'close' ? 'Cerrar venta' : 'Registrar pago'}</button>
    </div>
  </form>;

  return <div className="fixed inset-0 z-[70] bg-slate-950/40">
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="venta-cuotas-title" className="fixed inset-y-0 right-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain bg-white px-4 pb-8 pt-4 text-slate-900 sm:w-[480px] sm:border-l sm:border-slate-200">
      <header className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div className="min-w-0"><h2 id="venta-cuotas-title" tabIndex={-1} ref={title} className="break-words text-lg font-semibold focus-visible:ring-2">{resumen ? `${resumen.producto.nombre} · ${resumen.producto.codigo}` : 'Venta en cuotas'}</h2>
          {resumen && <p className="mt-1 text-sm text-slate-500">{resumen.producto.vendedor} · {resumen.estado === 'vendido' ? `Vendido el ${fecha(resumen.fechaVenta)}` : { reservado: 'Reservado', pagado: 'Pagado — falta cerrar', cancelado: 'Cancelado' }[resumen.estado]}</p>}
        </div><button type="button" className={button} onClick={onClose} aria-label="Cerrar venta en cuotas">Cerrar</button>
      </header>
      {!resumen ? <p className="py-6" aria-live="polite">{error || 'Cargando pagos…'}</p> : <>
        <div className="my-4 grid grid-cols-3 gap-2 [&_strong]:text-[13px] [&_strong]:tracking-tight sm:[&_strong]:text-lg sm:[&_strong]:tracking-normal"><Cifra label="Precio" value={money(resumen.precio)} /><Cifra label="Cobrado" value={money(resumen.cobrado)} tone="good" /><div className="[&_strong]:text-amber-800"><Cifra label="Falta" value={money(resumen.falta)} /></div></div>
        <div className="mb-5 h-1 overflow-hidden bg-slate-100" role="progressbar" aria-label="Cobrado del precio pactado" aria-valuemin={0} aria-valuemax={resumen.precio} aria-valuenow={resumen.cobrado}><div className="h-1 bg-emerald-600" style={{ width: `${Math.min(100, resumen.precio > 0 ? resumen.cobrado / resumen.precio * 100 : 0)}%` }} /></div>
        <table className="w-full table-fixed text-left text-xs sm:text-sm"><caption className="pb-2 text-left font-semibold">Pagos</caption><thead className="border-b border-slate-200 text-slate-500"><tr><th className="w-[23%] py-2 font-medium">Fecha</th><th className="w-[27%] font-medium">Forma y cuenta</th><th className="w-[24%] text-right font-medium">Monto</th><th className="w-[26%] pl-2 font-medium">Acción</th></tr></thead><tbody>
          {resumen.pagos.map((pago) => <React.Fragment key={pago.index}><tr className="border-b border-slate-100"><td className="py-3 align-top">{fecha(pago.fecha)}</td><td className="break-words py-3 align-top">{{ direct: 'Directo', card: 'Tarjeta', cash: 'Efectivo', debt: 'x500' }[pago.tipoPago]}<span className="block text-slate-500">{String(pago.banco).toUpperCase()}</span></td><td className="py-3 text-right align-top tabular-nums">{money(pago.monto)}</td><td className="pl-2 align-top">{pago.editable ? <button type="button" className="min-h-[44px] text-slate-700 underline focus-visible:ring-2" aria-label={`Corregir pago ${pago.index < 0 ? 'de cierre' : pago.index + 1}`} onClick={() => openForm('edit', pago)}>Corregir</button> : <span className="block py-3 text-xs text-slate-500">{pago.origen === 'finanzas' ? 'Registrado en Finanzas' : pago.origen === 'cierre' ? 'Cobro al cerrar' : 'Cancelado'}</span>}</td></tr>
            {form?.mode === 'edit' && form.index === pago.index && <tr><td colSpan={4}>{renderForm()}</td></tr>}
          </React.Fragment>)}
        </tbody></table>
        {form && form.mode !== 'edit' && <div className="mt-4">{renderForm()}</div>}
        {confirmacion && <div className="mt-4 border-y border-red-200 py-3" role="group" aria-label="Confirmar acción">
          <p className="text-sm">{confirmacion.type === 'remove' ? `¿Quitar el pago de ${money(confirmacion.pago.monto)}? También se quita de Gastos.` : `¿Cancelar la reserva y devolver ${money(resumen.cobrado)}? También se quitan sus ingresos de Gastos y la devolución queda en el libro de pagos.`}</p>
          <div className="mt-2 flex flex-wrap gap-2"><button type="button" className={button} onClick={() => setConfirmacion(null)}>Conservar</button><button type="button" disabled={busy} className={`${button} text-red-700`} onClick={() => mutate(() => confirmacion.type === 'remove' ? api.del(`/ventas/adelanto/${adelantoId}/cuotas/${confirmacion.pago.index}`) : api.del(`/ventas/adelanto/${adelantoId}`), confirmacion.type === 'remove' ? 'Pago quitado.' : 'Reserva cancelada.')}>{busy ? 'Guardando…' : confirmacion.type === 'remove' ? 'Quitar pago' : 'Cancelar reserva'}</button></div>
        </div>}
        {(!form || form.mode === 'edit') && !confirmacion && <footer className="mt-5 flex flex-wrap items-center justify-between gap-3">
          {!form && ['reservado', 'pagado'].includes(resumen.estado) && <button type="button" className={`${button} border-transparent text-red-700`} onClick={() => setConfirmacion({ type: 'cancel' })}>Cancelar reserva</button>}
          {!form && resumen.estado === 'pagado' && <button type="button" className={`${primary} ml-auto`} onClick={() => openForm('close')}>Cerrar venta</button>}
          {puedeAgregar && <button type="button" className={`${form ? button : primary} ml-auto`} onClick={() => openForm('pay')}>{form ? 'Registrar otro pago' : 'Registrar pago'}</button>}
        </footer>}
        {form?.mode === 'pay' && resumen.estado === 'vendido' && <p className="mt-2 text-xs text-slate-500">La venta ya está cerrada: este pago se descuenta del cobro al cerrar ({money(cierre?.monto)}), así el total sigue siendo {money(resumen.precio)}.</p>}
        <div aria-live="polite" className="mt-3 text-sm">{!form && error && <p className="text-red-700">{error}</p>}{success && <p className="text-emerald-700">{success}</p>}</div>
      </>}
    </section>
  </div>;
}
