// src/components/ModalEditarGasto.jsx
import React, { useState } from 'react';
import { API_URL } from '../api';

export default function ModalEditarGasto({ gasto, onClose, onSaved }) {
  const [monto, setMonto] = useState(String(gasto?.monto ?? ''));
  const [fecha, setFecha] = useState(gasto?.fecha || new Date().toISOString().slice(0,10));
  const [notas, setNotas] = useState(gasto?.notas || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  if (!gasto) return null;
  const isCredito = gasto.metodoPago === 'credito';
  const titulo = isCredito ? 'Editar gasto (Crédito)' : 'Editar gasto (Débito)';

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

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleOverlay}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 relative" onClick={(e)=>e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>×</button>
        <h2 className="text-lg font-semibold mb-3">{titulo}</h2>

        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

        <div className="mb-2 text-xs text-gray-600">
          <div>Concepto: <b className="capitalize">{String(gasto.concepto || '').replace(/_/g,' ')}</b></div>
          <div>Método: <b className="capitalize">{gasto.metodoPago}</b> · Moneda: <b>{gasto.moneda}</b> · Tarjeta/Banco: <b>{gasto.tarjeta || '-'}</b></div>
        </div>

        <form className="grid gap-3" onSubmit={submit}>
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

