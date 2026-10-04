import React, { useEffect, useState } from 'react';
import api from '../api';
import { formatPending500, getPending500 } from '../utils/pending500';

export default function ModalCobroVenta({ gasto, onClose, onSaved }) {
  const isDebt = gasto.salePaymentType === 'debt';
  const received = Number(gasto.saleReceivedAmount || 0);
  const [count, setCount] = useState(String(Math.floor(received / 500)));
  const [partial, setPartial] = useState(String(+(received % 500).toFixed(2)));
  const [cardReceived, setCardReceived] = useState(String(received));
  const [paidAt, setPaidAt] = useState(gasto.salePaidAt || '');
  const [exchangeRate, setExchangeRate] = useState('');
  const [savedRate, setSavedRate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    api.get(`/ventas/${gasto.saleId}`).then((sale) => {
      if (!active) return;
      const value = Number(sale?.tipoCambio);
      if (Number.isFinite(value) && value > 0) {
        setExchangeRate((current) => current || String(value));
        setSavedRate(String(value));
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [gasto.saleId]);

  const amount = Number(gasto.monto);
  const countNumber = Number(count);
  const partialNumber = Number(partial);
  const receivedPreview = isDebt ? countNumber * 500 + partialNumber : Number(cardReceived);
  const pending = getPending500(amount, isDebt ? countNumber : 0, isDebt ? partialNumber : receivedPreview);

  const save = async (event) => {
    event.preventDefault();
    setError('');
    if (isDebt && (!Number.isInteger(countNumber) || countNumber < 0 || !Number.isFinite(partialNumber) || partialNumber < 0 || partialNumber >= 500 || Math.abs(Math.round(partialNumber * 100) - partialNumber * 100) > 0.000001)) {
      setError('Ingresa una cantidad válida de pagos de S/ 500 y un último monto menor de S/ 500.');
      return;
    }
    if (!Number.isFinite(receivedPreview) || receivedPreview < 0 || receivedPreview > amount || Math.abs(Math.round(receivedPreview * 100) - receivedPreview * 100) > 0.000001) {
      setError('Lo recibido no puede superar el monto de la venta.');
      return;
    }
    if (!isDebt && receivedPreview > 0 && !paidAt) {
      setError('Indica la fecha del pago con tarjeta.');
      return;
    }
    if (receivedPreview === 0 && paidAt) {
      setError('Registra un monto recibido antes de indicar la fecha.');
      return;
    }
    const rate = Number(exchangeRate);
    if (exchangeRate && (!Number.isFinite(rate) || rate <= 0)) {
      setError('Ingresa un tipo de cambio válido.');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/gastos/sale-income/${gasto.id}`, {
        receivedAmount: +receivedPreview.toFixed(2),
        paidAt: paidAt || null,
        ...(exchangeRate && exchangeRate !== savedRate ? { exchangeRate: rate } : {}),
      });
      onSaved?.();
    } catch (err) {
      setError(err?.message || 'No se pudo guardar el cobro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Cobro de venta ${gasto.saleSku || gasto.saleId}`}>
      <form onSubmit={save} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">Cobro de venta</h2><p className="text-sm text-slate-600">SKU: {gasto.saleSku || `Venta #${gasto.saleId}`}</p></div><button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl text-slate-500">×</button></div>
        <p className="text-sm">Total: <strong>S/ {amount.toFixed(2)}</strong> · Recibido: <strong>S/ {receivedPreview.toFixed(2)}</strong></p>
        {isDebt ? <>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm">Pagos de S/ 500 recibidos<input type="number" min="0" step="1" value={count} onChange={(e) => setCount(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
            <label className="text-sm">Último monto recibido<input type="number" min="0" max="499.99" step="0.01" value={partial} onChange={(e) => setPartial(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
          </div>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Faltante: S/ {pending.amount.toFixed(2)}<br />{formatPending500(pending)}</p>
          <label className="block text-sm">Fecha del último pago recibido<input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
        </> : <>
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Deuda: S/ {pending.amount.toFixed(2)}</p>
          <label className="block text-sm">Monto recibido hasta ahora<input type="number" min="0" max={amount} step="0.01" value={cardReceived} onChange={(e) => setCardReceived(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
          <label className="block text-sm">Fecha en que pagó con tarjeta<input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" /></label>
        </>}
        <label className="block text-sm">Tipo de cambio de la venta<input type="number" min="0.0001" step="0.0001" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder="3.7" className="mt-1 w-full rounded border px-3 py-2" /></label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded border px-4 py-2">Cancelar</button><button type="submit" disabled={saving} className="rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar cobro'}</button></div>
      </form>
    </div>
  );
}
