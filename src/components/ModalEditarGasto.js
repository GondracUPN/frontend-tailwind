// src/components/ModalEditarGasto.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

const BANKS_DEBITO = [
  { value: 'interbank', label: 'Interbank' },
  { value: 'bcp', label: 'BCP' },
  { value: 'bbva', label: 'BBVA' },
];

export default function ModalEditarGasto({ gasto, onClose, onSaved }) {
  const [monto, setMonto] = useState(String(gasto?.monto ?? ''));
  const [fecha, setFecha] = useState(gasto?.fecha || new Date().toISOString().slice(0,10));
  const [notas, setNotas] = useState(gasto?.notas || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // Estados adicionales para edición completa
  const [concepto, setConcepto] = useState(gasto?.concepto || '');
  const [tarjeta, setTarjeta] = useState(gasto?.tarjeta || '');
  const [tarjetaPago, setTarjetaPago] = useState(gasto?.tarjetaPago || '');
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);

  // Derivados
  const isCredito = gasto?.metodoPago === 'credito';
  const titulo = isCredito ? 'Editar gasto (Crédito)' : 'Editar gasto (Débito)';

  const conceptoOptions = useMemo(() => {
    if (isCredito) {
      return [
        { value: 'comida', label: 'Comida' },
        { value: 'gusto', label: 'Gusto' },
        { value: 'inversion', label: 'Inversión' },
        { value: 'pago_envios', label: 'Pago envíos' },
        { value: 'deuda_cuotas', label: 'Deuda en cuotas' },
        { value: 'gastos_recurrentes', label: 'Gastos recurrentes' },
      ];
    }
    return [
      { value: 'comida', label: 'Comida' },
      { value: 'gustos', label: 'Gustos' },
      { value: 'ingresos', label: 'Ingresos' },
      { value: 'retiro_agente', label: 'Retiro agente' },
      { value: 'gastos_recurrentes', label: 'Gastos recurrentes' },
      { value: 'pago_tarjeta', label: 'Pago Tarjeta' },
    ];
  }, [isCredito]);

  useEffect(() => {
    setConcepto(gasto.concepto || '');
    setTarjeta(gasto.tarjeta || '');
    setTarjetaPago(gasto.tarjetaPago || '');
  }, [gasto]);

  useEffect(() => {
    const needCards = isCredito || (!isCredito && (concepto === 'pago_tarjeta'));
    if (!needCards) return;
    let alive = true;
    (async () => {
      try {
        setLoadingCards(true);
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/cards`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!alive) return;
        setCards(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setCards([]);
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [isCredito, concepto]);
  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setErr('');
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return setErr('Monto inválido.');
    if (!fecha) return setErr('Selecciona fecha.');
    const token = localStorage.getItem('token');
    if (!token) return setErr('No hay sesión.');
    setSaving(true);
    try {
      const body = { monto: n, fecha, notas: notas || null };
      if (concepto) body.concepto = concepto;
      if (isCredito) {
        if (tarjeta) body.tarjeta = tarjeta;
      } else {
        if (tarjeta) body.tarjeta = tarjeta; // banco
        if (concepto === 'pago_tarjeta') body.tarjetaPago = tarjetaPago || null;
      }
      const res = await fetch(`${API_URL}/gastos/${gasto.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSaved?.(data);
    } catch (e) {
      console.error('[ModalEditarGasto] patch:', e);
      setErr('No se pudo actualizar.');
    } finally {
      setSaving(false);
    }
  };

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose?.(); }

  if (!gasto) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleOverlay}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>×</button>
        <h2 className="text-lg font-semibold mb-3">{titulo}</h2>

        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

        <div className="mb-2 text-xs text-gray-600">
          <div>Concepto: <b className="capitalize">{String(gasto.concepto || '').replace(/_/g,' ')}</b></div>
          <div>Método: <b className="capitalize">{gasto.metodoPago}</b> · Moneda: <b>{gasto.moneda}</b> · Tarjeta/Banco: <b>{gasto.tarjeta || '-'}</b></div>
        </div>

        <form className="grid gap-3" onSubmit={submit}>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Concepto</span>
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e)=>setConcepto(e.target.value)}>
              {conceptoOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>

          {isCredito ? (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tarjeta</span>
              <select className="w-full border rounded px-3 py-2" value={tarjeta} onChange={(e)=>setTarjeta(e.target.value)} disabled={loadingCards || !cards.length}>
                {cards.map(c => (
                  <option key={c.id} value={c.tipo || c.type}>{c.label || c.name || c.tipo || c.type}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Débito (banco)</span>
              <select className="w-full border rounded px-3 py-2" value={tarjeta} onChange={(e)=>setTarjeta(e.target.value)}>
                {BANKS_DEBITO.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          )}

          {!isCredito && concepto === 'pago_tarjeta' && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tarjeta a la que paga</span>
              <select className="w-full border rounded px-3 py-2" value={tarjetaPago} onChange={(e)=>setTarjetaPago(e.target.value)} disabled={loadingCards || !cards.length}>
                {cards.map(c => (
                  <option key={c.id} value={c.tipo || c.type}>{c.label || c.name || c.tipo || c.type}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Monto ({gasto.moneda === 'USD' ? '$' : 'S/'})</span>
            <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" required />
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Fecha</span>
            <input type="date" className="w-full border rounded px-3 py-2" value={fecha} onChange={(e)=>setFecha(e.target.value)} required />
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Notas</span>
            <input className="w-full border rounded px-3 py-2" value={notas} onChange={(e)=>setNotas(e.target.value)} placeholder="Opcional" />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}