// src/components/ModalGastoCredito.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import CloseX from './CloseX';

const TC_CREDITO = 3.7;

const MONEDAS = [
  { value: 'PEN', label: 'Soles' },
  { value: 'USD', label: 'Dólares' },
];

const CONCEPTOS = [
  'Comida',
  'Gusto',
  'Inversion',
  'Pago Envios',
  'Transporte',
  'Deuda en cuotas',
  'Gastos mensuales',
  'Desgravamen',
];

const today = () => new Date().toISOString().slice(0, 10);

export default function ModalGastoCredito({ onClose, onSaved, userId, mode = 'create', initial = null }) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  const [concepto, setConcepto] = useState(initial?.concepto || 'Comida');
  const defaultMoneda = (() => (String(initial?.concepto || 'Comida').toLowerCase() === 'inversion' ? 'USD' : 'PEN'))();
  const [moneda, setMoneda] = useState(initial?.moneda || defaultMoneda);
  const [monto, setMonto] = useState(initial?.monto != null ? String(initial.monto) : '');
  const [fecha, setFecha] = useState(initial?.fecha || today());
  const [nota, setNota] = useState(initial?.notas || '');

  const [detalleGusto, setDetalleGusto] = useState(initial?.detalleGusto || '');
  const [detalleMensual, setDetalleMensual] = useState('');
  const [tarjetaCompra, setTarjetaCompra] = useState(initial?.tarjeta || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const url = `${API_URL}/cards${userId ? `?userId=${userId}` : ''}`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setCards(arr);
        const first = initial?.tarjeta || arr[0]?.tipo || arr[0]?.type || '';
        setTarjetaCompra((prev) => prev || first);
      } catch {
        if (alive) setCards([]);
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, initial]);

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';

  const isCompra = ['Comida', 'Gusto', 'Inversion', 'Pago Envios', 'Transporte', 'Deuda en cuotas', 'Gastos mensuales', 'Desgravamen'].includes(concepto);
  const isCuotas = concepto === 'Deuda en cuotas';
  const [cuotas, setCuotas] = useState('3');
  const needDetalleGusto = concepto === 'Gusto';
  const needDetalleMensual = concepto === 'Gastos mensuales';

  const fechaLabel = useMemo(() => 'Fecha de compra', []);

  useEffect(() => {
    const c = String(concepto || '').toLowerCase();
    setMoneda(c === 'inversion' ? 'USD' : 'PEN');
  }, [concepto]);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setError('');
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return setError('Monto inválido.');
    if (!fecha) return setError('Selecciona fecha.');

    const token = localStorage.getItem('token');
    if (!token) return setError('No hay sesión.');
    if (!cards.length) return setError('No tienes tarjetas registradas.');

    const body = {
      concepto,
      metodoPago: 'credito',
      moneda,
      monto: n,
      fecha,
      notas: nota?.trim() || null,
    };

    if (isCompra) {
      if (!tarjetaCompra) return setError('Selecciona una tarjeta.');
      body.tarjeta = tarjetaCompra;
      if (needDetalleGusto && !detalleGusto.trim()) return setError('Describe el gusto.');
      if (needDetalleGusto) body.detalleGusto = detalleGusto.trim();
      if (needDetalleMensual && !String(detalleMensual).trim()) return setError('Ingresa el detalle del gasto mensual.');
      if (needDetalleMensual) body.notas = String(detalleMensual).trim();
      if (isCuotas) body.cuotasMeses = Number(cuotas);
    }

    setSaving(true);
    try {
      const url = mode === 'edit' && initial?.id ? `${API_URL}/gastos/${initial.id}` : `${API_URL}/gastos`;
      const method = mode === 'edit' && initial?.id ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json().catch(() => null);
      onSaved?.(data);
      onClose?.();
    } catch (err) {
      console.error('[ModalGastoCredito] save error:', err);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleOverlay}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-3">{mode==='edit' ? 'Editar gasto (Crédito)' : 'Agregar gasto (Crédito)'}</h2>

        {error && (<div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>)}

        {loadingCards ? (
          <div className="text-sm text-gray-600 mb-3">Cargando tus tarjetas…</div>
        ) : !cards.length ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">No tienes tarjetas registradas. Agrega una desde el panel de tarjetas.</div>
        ) : null}

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Concepto</span>
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e) => setConcepto(e.target.value)}>
              {CONCEPTOS.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
          </label>

          {needDetalleGusto && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Detalle del gusto</span>
              <input className="w-full border rounded px-3 py-2" value={detalleGusto} onChange={(e) => setDetalleGusto(e.target.value)} placeholder="Ej. Ropa, juego, accesorio…" />
            </label>
          )}

          {needDetalleMensual && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Detalle del gasto mensual</span>
              <input className="w-full border rounded px-3 py-2" value={detalleMensual} onChange={(e) => setDetalleMensual(e.target.value)} placeholder="Ej. Netflix, Internet, Membresía" />
            </label>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Moneda</span>
              <select className="w-full border rounded px-3 py-2" value={moneda} onChange={(e) => setMoneda(e.target.value)}>
                {MONEDAS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Monto</span>
              <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={moneda === 'USD' ? '$ 0.00' : '0.00'} required />
              <div className="mt-1 text-xs text-gray-500 min-h-[1rem]">{moneda === 'USD' ? (<span>≈ S/ {Number((Number(monto || 0) * TC_CREDITO).toFixed(2))} (TC {TC_CREDITO})</span>) : null}</div>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">{fechaLabel}</span>
              <input type="date" className="w-full border rounded px-3 py-2" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              <div className="mt-1 text-xs text-gray-500">TC usado: {TC_CREDITO}</div>
            </label>
          </div>

          {isCuotas && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Cuotas</span>
              <select className="w-full border rounded px-3 py-2" value={cuotas} onChange={(e)=>setCuotas(e.target.value)}>
                {['3','4','5','6','12','24','36'].map(n => (<option key={n} value={n}>{n} cuotas</option>))}
              </select>
            </label>
          )}

          {(isCompra) && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tarjeta</span>
              <select className="w-full border rounded px-3 py-2" value={tarjetaCompra} onChange={(e) => setTarjetaCompra(e.target.value)} disabled={!cards.length}>
                {cards.map((c) => (<option key={cardValue(c)} value={cardValue(c)}>{cardLabel(c)}</option>))}
              </select>
            </label>
          )}

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Nota (opcional)</span>
            <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle adicional…" />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !cards.length} className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">{saving ? (mode==='edit' ? 'Actualizando…' : 'Guardando…') : (mode==='edit' ? 'Actualizar' : 'Guardar')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
