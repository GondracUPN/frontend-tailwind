// src/components/ModalTarjetas.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

const CARD_OPTIONS = [
  { value: 'interbank', label: 'Interbank' },
  { value: 'bcp_amex',  label: 'BCP Amex'  },
  { value: 'bcp_visa',  label: 'BCP Visa'  },
  { value: 'bbva',      label: 'BBVA'      },
  { value: 'io',        label: 'IO'        },
  { value: 'saga',      label: 'Saga'      },
];

export default function ModalTarjetas({ onClose, onSaved, userId }) { // 👈 recibe userId
  const [tab, setTab] = useState('add'); // add | line
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const token = localStorage.getItem('token');

  // Add
  const [tipo, setTipo]   = useState('interbank');
  const [linea, setLinea] = useState('');

  // Update
  const [cardId, setCardId]     = useState('');
  const [newLinea, setNewLinea] = useState('');

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Cargar tarjetas del usuario objetivo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setErr('');
        const url = `${API_URL}/cards${userId ? `?userId=${userId}` : ''}`; // 👈 filtra por user
        const res = await fetch(url, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        if (alive) {
          const list = Array.isArray(data) ? data : [];
          setCards(list);
          if (list.length && !cardId) {
            setCardId(String(list[0].id));
            setNewLinea(String(Number(list[0].creditLine ?? 0)));
          }
        }
      } catch (e) {
        console.error('[ModalTarjetas] load:', e);
        if (alive) setErr('No se pudieron cargar las tarjetas.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [token, userId]); // 👈 se recarga si cambia userId

  const existingTypes = useMemo(
    () => new Set(cards.map(c => String(c.tipo || c.type || '').toLowerCase())),
    [cards]
  );
  const duplicatedType = existingTypes.has(String(tipo).toLowerCase());

  const add = async (e) => {
    e.preventDefault();
    if (saving) return;
    setErr('');

    const n = Number(linea);
    if (!isFinite(n) || n <= 0) return setErr('Línea inválida.');
    if (duplicatedType) return setErr('Ya tienes una tarjeta de ese tipo.');

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tipo,
          creditLine: n,
          ...(userId ? { userId } : {}), // 👈 para que el backend cree para ese user si eres admin
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error('[ModalTarjetas] add:', e);
      setErr('No se pudo agregar la tarjeta.');
    } finally {
      setSaving(false);
    }
  };

  const updateLine = async (e) => {
    e.preventDefault();
    if (saving) return;
    setErr('');

    const id = Number(cardId);
    const n = Number(newLinea);
    if (!id) return setErr('Selecciona una tarjeta.');
    if (!isFinite(n) || n <= 0) return setErr('Línea inválida.');

    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ creditLine: n }),
      });
      if (!res.ok) throw new Error(await res.text());
      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error('[ModalTarjetas] patch:', e);
      setErr('No se pudo actualizar la línea.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-lg p-6 relative"
        onClick={(e)=>e.stopPropagation()}
      >
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          ✖
        </button>

        <h2 className="text-lg font-semibold mb-3">Tarjetas de crédito</h2>

        <div className="flex gap-2 mb-4">
          <button
            className={`px-3 py-1.5 rounded ${tab==='add'?'bg-indigo-600 text-white':'bg-gray-100'}`}
            onClick={()=>setTab('add')}
          >
            Agregar tarjeta
          </button>
          <button
            className={`px-3 py-1.5 rounded ${tab==='line'?'bg-indigo-600 text-white':'bg-gray-100'}`}
            onClick={()=>setTab('line')}
            disabled={loading || cards.length === 0}
            title={cards.length===0 ? 'Primero agrega una tarjeta' : ''}
          >
            Cambiar línea
          </button>
        </div>

        {err && (
          <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {err}
          </div>
        )}

        {tab === 'add' ? (
          <form className="grid gap-3" onSubmit={add}>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tarjeta</span>
              <select
                className="w-full border rounded px-3 py-2"
                value={tipo}
                onChange={(e)=>setTipo(e.target.value)}
                disabled={saving}
              >
                {CARD_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>
                    {c.label}{existingTypes.has(c.value) ? ' (ya registrada)' : ''}
                  </option>
                ))}
              </select>
              {duplicatedType && (
                <div className="mt-1 text-xs text-amber-700">
                  Ya tienes una {CARD_OPTIONS.find(x=>x.value===tipo)?.label}. Elige otra o usa “Cambiar línea”.
                </div>
              )}
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Línea de crédito (S/)</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                step="0.01"
                min="0"
                value={linea}
                onChange={(e)=>setLinea(e.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" disabled={saving || duplicatedType} className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        ) : (
          <form className="grid gap-3" onSubmit={updateLine}>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Tarjeta</span>
              <select
                className="w-full border rounded px-3 py-2"
                value={cardId}
                onChange={(e)=>setCardId(e.target.value)}
                disabled={saving || loading}
              >
                <option value="">— Seleccionar —</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>
                    {(CARD_OPTIONS.find(o=>o.value===c.tipo)?.label || c.tipo)} — Línea actual: S/ {Number(c.creditLine||0).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Nueva línea (S/)</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                step="0.01"
                min="0"
                value={newLinea}
                onChange={(e)=>setNewLinea(e.target.value)}
                placeholder="0.00"
                required
                disabled={saving}
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" disabled={saving || !cardId} className="px-5 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60">
                {saving ? 'Actualizando…' : 'Actualizar'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
