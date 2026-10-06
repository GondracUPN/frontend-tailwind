import React, { useState } from 'react';
import api from '../api';

const money = (value) => `S/ ${Number(value || 0).toFixed(2)}`;

export default function ModalCobroVenta({ gasto, onClose, onSaved }) {
  const isX500 = gasto.salePaymentType === 'debt';
  const total = Number(gasto.monto || 0);
  const received = Number(gasto.saleReceivedAmount || 0);
  const remaining = Math.max(0, Math.round((total - received) * 100) / 100);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentCount, setPaymentCount] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [exchangeRate, setExchangeRate] = useState(gasto.saleExchangeRate ? String(Number(gasto.saleExchangeRate)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const history = Array.isArray(gasto.salePaymentHistory) && gasto.salePaymentHistory.length
    ? gasto.salePaymentHistory
    : received > 0 ? [{ amount: received, paidAt: gasto.salePaidAt || '', legacy: true }] : [];
  const useCount = isX500 && remaining >= 500;
  const hasPaymentInput = useCount ? paymentCount !== '' : paymentAmount !== '';
  const previewPayment = useCount ? Number(paymentCount || 0) * 500 : Number(paymentAmount || 0);
  const rateChanged = exchangeRate !== '' && Number(exchangeRate) !== Number(gasto.saleExchangeRate || 0);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    const rate = Number(exchangeRate);
    if (exchangeRate && (!Number.isFinite(rate) || rate <= 0)) return setError('Ingresa un tipo de cambio válido.');
    if (!hasPaymentInput && !rateChanged) return setError('Indica un pago o cambia el tipo de cambio.');
    if (hasPaymentInput) {
      if (!paidAt) return setError('Indica la fecha del pago.');
      if (useCount && (!Number.isInteger(Number(paymentCount)) || Number(paymentCount) < 1)) return setError('Indica cuántos pagos de S/ 500 recibiste.');
      if (!useCount && (!Number.isFinite(previewPayment) || previewPayment <= 0 || Math.round(previewPayment * 100) !== previewPayment * 100)) return setError('Ingresa un monto válido.');
      if (previewPayment > remaining) return setError(`El pago no puede superar ${money(remaining)}.`);
    }
    setSaving(true);
    try {
      const updated = await api.patch(`/gastos/sale-income/${gasto.id}`, {
        ...(hasPaymentInput ? (useCount ? { paymentCount: Number(paymentCount) } : { paymentAmount: previewPayment }) : {}),
        ...(hasPaymentInput ? { paidAt } : {}),
        ...(rateChanged ? { exchangeRate: rate } : {}),
      });
      onSaved?.(updated);
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el cobro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Cobro de venta ${gasto.saleSku || gasto.saleId}`}>
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{isX500 ? 'Cobros x500' : 'Cobro de deuda'}</h2><p className="text-sm text-slate-600">SKU: {gasto.saleSku || `Venta #${gasto.saleId}`}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl text-slate-500">×</button>
        </div>
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs text-slate-600">
          <div>Total<strong className="block text-sm text-slate-900">{money(total)}</strong></div>
          <div>Recibido<strong className="block text-sm text-emerald-700">{money(received)}</strong></div>
          <div>Pendiente<strong className="block text-sm text-amber-800">{money(remaining)}</strong></div>
        </div>
        {history.length > 0 && <div className="rounded-xl border border-slate-200 p-3">
          <h3 className="mb-2 text-sm font-semibold">Pagos registrados</h3>
          <ul className="space-y-1 text-sm text-slate-700">
            {history.map((payment, index) => <li key={index} className="flex justify-between gap-3">
              <span>{payment.paidAt || 'Fecha anterior no registrada'}{payment.units500 ? ` · ${payment.units500} × 500` : ''}{payment.legacy ? ' · registro anterior' : ''}</span>
              <strong className="whitespace-nowrap">{money(payment.amount)}</strong>
            </li>)}
          </ul>
        </div>}
        {remaining === 0 && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">✓ {isX500 ? 'Cobros x500 completos' : 'Deuda pagada'}</p>}
        {remaining > 0 && <>
          {useCount
            ? <label className="block text-sm">Pagos de S/ 500 que vas a registrar
              <input type="number" min="1" max={Math.floor(remaining / 500)} step="1" value={paymentCount} onChange={(event) => setPaymentCount(event.target.value)} placeholder="Cantidad, por ejemplo 1 o 3" className="mt-1 w-full rounded border px-3 py-2" />
              <span className="mt-1 block text-xs text-slate-500">Puedes registrar uno o varios con la misma fecha. Máximo {Math.floor(remaining / 500)}.</span>
            </label>
            : <label className="block text-sm">{isX500 ? 'Último monto recibido' : 'Nuevo pago recibido'}
              <input type="number" min="0.01" max={remaining} step="0.01" value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder={`Máximo ${money(remaining)}`} className="mt-1 w-full rounded border px-3 py-2" />
            </label>}
          <label className="block text-sm">Fecha del pago
            <input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
        </>}
        <label className="block text-sm">Tipo de cambio (opcional)
          <input aria-label="Tipo de cambio (opcional)" type="number" min="0.0001" step="0.0001" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} placeholder="Ej. 3.7" className="mt-1 w-full rounded border px-3 py-2" />
          <span className="mt-1 block text-xs text-slate-500">Se conserva para los próximos pagos. Al completar el saldo se aplica a la venta; después puedes corregirlo aquí.</span>
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded border px-4 py-2">Cancelar</button>
          <button type="submit" disabled={saving} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : hasPaymentInput ? 'Registrar pago' : 'Guardar cambio'}</button>
        </div>
      </form>
    </div>
  );
}
