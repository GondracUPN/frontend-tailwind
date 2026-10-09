import React, { useEffect, useState } from 'react';
import api from '../api';

const LABELS = { direct: 'Directo', card: 'Tarjeta de crédito', debt: 'x500', cash: 'Efectivo' };
const BANKS = { bcp: 'BCP', interbank: 'Interbank', bbva: 'BBVA', io: 'IO', bcp_visa: 'BCP Visa', bcp_amex: 'BCP Amex', visa_qore: 'Visa Qore', saga: 'Saga' };
const cents = (value) => Math.round(Number(value || 0) * 100);

export default function ModalEditarVentaIngreso({ saleId, onClose, onSaved }) {
  const [details, setDetails] = useState(null);
  const [amount, setAmount] = useState('');
  const [soldAt, setSoldAt] = useState('');
  const [bank, setBank] = useState('');
  const [parts, setParts] = useState({});
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    api.get(`/ventas/${saleId}/cobros`).then((data) => {
      if (!alive) return;
      setDetails(data);
      setAmount(String(data.amount ?? ''));
      setSoldAt(data.soldAt || '');
      setBank(data.incomeBank || '');
      setParts(Object.fromEntries((data.parts || []).map((part) => [part.type, String(part.amount)])));
    }).catch((err) => { if (alive) setError(err.message || 'No se pudo cargar la venta.'); });
    return () => { alive = false; };
  }, [saleId]);

  const selected = Object.keys(parts);
  const available = Object.keys(LABELS).filter((type) => !selected.includes(type));
  const total = selected.reduce((sum, type) => sum + cents(parts[type]), 0);
  const payable = cents(amount) - cents(details?.advanceAmount);
  const balanceFor = (current, type) => {
    const keys = Object.keys(current);
    const partner = keys.length > 1 ? [...keys].reverse().find((item) => item !== type) : null;
    const fixed = keys.filter((item) => item !== type && item !== partner)
      .reduce((sum, item) => sum + cents(current[item]), 0);
    return { partner, maximum: Math.max(0, payable - fixed) };
  };
  const maxFor = (type) => balanceFor(parts, type).maximum;
  const changePart = (type, raw) => setParts((current) => {
    const { partner, maximum } = balanceFor(current, type);
    const requested = Number(raw);
    const value = raw !== '' && Number.isFinite(requested) && requested > maximum / 100
      ? (maximum > 0 ? String(maximum / 100) : '') : raw;
    const remainder = partner ? Math.max(0, maximum - cents(value)) : 0;
    return { ...current, [type]: value, ...(partner ? { [partner]: remainder > 0 ? String(remainder / 100) : '' } : {}) };
  });
  const save = async (event) => {
    event.preventDefault();
    const price = Number(amount);
    if (!Number.isFinite(price) || cents(price) <= 0 || cents(price) / 100 !== price || !soldAt) {
      setError('Ingresa un precio y una fecha válidos.'); return;
    }
    if (!selected.length || selected.some((type) => cents(parts[type]) <= 0) || total !== payable) {
      setError('Los cobros deben sumar el saldo de la venta después del adelanto.'); return;
    }
    if (selected.some((type) => type !== 'cash') && !bank) {
      setError('Selecciona la cuenta que recibió los pagos.'); return;
    }
    setBusy(true); setError('');
    try {
      await api.patch(`/ventas/${saleId}`, {
        precioVenta: price, fechaVenta: soldAt, incomeBank: bank,
        incomeParts: selected.map((type) => ({ type, amount: Number(parts[type]) })),
      });
      onSaved();
    } catch (err) { setError(err.message || 'No se pudo editar la venta.'); }
    finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
    <form onSubmit={save} role="dialog" aria-modal="true" aria-label="Editar venta e ingresos" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-slate-900">Editar venta e ingresos</h2><p className="text-xs text-slate-500">{details?.sku || `Venta #${saleId}`} · vínculo #{saleId}</p></div>
        <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-900">Cerrar</button>
      </div>
      {!details ? <p className="text-sm text-slate-600">Cargando venta...</p> : <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-700">Precio de venta (S/)
            <input aria-label="Precio de venta vinculado" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
          </label>
          <label className="text-xs font-medium text-slate-700">Fecha de venta
            <input aria-label="Fecha de venta vinculada" type="date" value={soldAt} onChange={(e) => setSoldAt(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" />
          </label>
        </div>
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="text-xs font-semibold text-slate-800">Formas de cobro</div>
          {selected.map((type) => <div key={type} className="flex items-center gap-2">
            <span className="flex-1 text-xs text-slate-700">{LABELS[type]}</span>
            <input aria-label={`${LABELS[type]} de venta vinculada`} type="number" min="0.01" max={(maxFor(type) / 100).toFixed(2)} step="0.01" value={parts[type]} onChange={(e) => changePart(type, e.target.value)} className="w-28 rounded-md border border-slate-300 px-2 py-1 text-right text-sm" />
            <button type="button" aria-label={`Quitar ${LABELS[type]}`} onClick={() => setParts((current) => { const next = { ...current }; delete next[type]; return next; })} className="text-slate-400 hover:text-red-700">×</button>
          </div>)}
          {available.length > 0 && (adding || !selected.length) ? <select aria-label="Agregar cobro a venta vinculada" value="" onChange={(e) => { if (e.target.value) setParts((current) => ({ ...current, [e.target.value]: selected.length && payable > total ? String((payable - total) / 100) : '' })); setAdding(false); }} className="w-full rounded-md border border-slate-300 p-1.5 text-xs"><option value="">Elegir forma de cobro...</option>{available.map((type) => <option key={type} value={type}>{LABELS[type]}</option>)}</select> : available.length > 0 && <button type="button" onClick={() => setAdding(true)} className="text-xs font-medium text-amber-800">+ Otro medio</button>}
          <p className={`text-xs ${total === payable ? 'text-emerald-700' : 'text-amber-800'}`}>S/ {(total / 100).toFixed(2)} / {(payable / 100).toFixed(2)}{Number(details.advanceAmount) > 0 ? ` · Adelanto S/ ${Number(details.advanceAmount).toFixed(2)}` : ''}</p>
        </div>
        {selected.some((type) => type !== 'cash') && <label className="block text-xs font-medium text-slate-700">Cuenta que recibió el pago
          <select aria-label="Cuenta de venta vinculada" value={bank} onChange={(e) => setBank(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"><option value="">Seleccionar</option>{bank && !BANKS[bank] && <option value={bank}>{bank}</option>}{Object.entries(BANKS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>}
        <p className="text-xs text-slate-500">Al guardar se actualizan la venta y todos sus ingresos vinculados.</p>
      </div>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancelar</button><button type="submit" disabled={!details || busy} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Guardando...' : 'Guardar cambios'}</button></div>
    </form>
  </div>;
}
