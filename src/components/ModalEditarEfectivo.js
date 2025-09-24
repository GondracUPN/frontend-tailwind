import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';

export default function ModalEditarEfectivo({ onClose, onSaved, current }) {
  const [pen, setPen] = useState(String(current?.efectivoPen ?? '0'));
  const [usd, setUsd] = useState(String(current?.efectivoUsd ?? '0'));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    const nPen = Number(pen), nUsd = Number(usd);
    if (!isFinite(nPen) || nPen < 0) return setErr('Efectivo PEN inválido.');
    if (!isFinite(nUsd) || nUsd < 0) return setErr('Efectivo USD inválido.');

    const token = localStorage.getItem('token');
    if (!token) return setErr('No hay sesión.');

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/wallet`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ efectivoPen: nPen, efectivoUsd: nUsd }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSaved?.(data);
    } catch (e) {
      console.error('[ModalEditarEfectivo] put:', e);
      setErr('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 relative" onClick={(e)=>e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>✖</button>
        <h2 className="text-lg font-semibold mb-3">Editar efectivo</h2>

        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

        <form className="grid gap-3" onSubmit={submit}>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Efectivo (S/)</span>
            <input className="w-full border rounded px-3 py-2" type="number" step="0.01" min="0" value={pen} onChange={(e)=>setPen(e.target.value)} />
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Efectivo ($)</span>
            <input className="w-full border rounded px-3 py-2" type="number" step="0.01" min="0" value={usd} onChange={(e)=>setUsd(e.target.value)} />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving} className="px-5 py-2 rounded bg-gray-900 text-white hover:bg-black disabled:opacity-60">
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
