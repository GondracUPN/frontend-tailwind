import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import CloseX from './CloseX';

const CREDIT_CONCEPTS = [
  'comida',
  'gusto',
  'inversion',
  'pago_envios',
  'deuda_cuotas',
  'gastos_recurrentes',
  'desgravamen',
  'transporte',
  'cashback',
];

const CONCEPT_ALIASES = {
  comida: 'comida',
  gusto: 'gusto',
  inversion: 'inversion',
  'pago envios': 'pago_envios',
  pago_envios: 'pago_envios',
  'deuda en cuotas': 'deuda_cuotas',
  deuda_cuotas: 'deuda_cuotas',
  deuda_en_cuotas: 'deuda_cuotas',
  'gastos mensuales': 'gastos_recurrentes',
  gastos_recurrentes: 'gastos_recurrentes',
  desgravamen: 'desgravamen',
  transporte: 'transporte',
  cashback: 'cashback',
  'cashback reembolso': 'cashback',
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const toConceptApi = (raw) => {
  const key = normalizeText(raw);
  const mapped = CONCEPT_ALIASES[key] || key.replace(/\s+/g, '_');
  return CREDIT_CONCEPTS.includes(mapped) ? mapped : null;
};

const toMoneda = (raw) => {
  const key = normalizeText(raw).replace(/\./g, '');
  if (['pen', 'sol', 'soles', 's/', 's'].includes(key)) return 'PEN';
  if (['usd', 'dolar', 'dolares', '$'].includes(key)) return 'USD';
  return null;
};

const toAmount = (raw) => {
  let s = String(raw || '').trim().replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/,/g, '.');
  }
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return null;
  return n;
};

const toIsoDate = (raw) => {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() + 1 !== mm ||
    dt.getDate() !== dd
  ) return null;
  return iso;
};

const parseBulkRows = (text) => {
  const lines = String(text || '').split(/\r?\n/);
  const rows = [];
  const errors = [];

  lines.forEach((lineRaw, idx) => {
    const line = String(lineRaw || '').trim();
    if (!line) return;

    const parts = line.split('|').map((x) => String(x || '').trim());
    if (parts.length < 4 || parts.length > 5) {
      errors.push(`Linea ${idx + 1}: usa exactamente "concepto | moneda | monto | fecha | nota(opcional)".`);
      return;
    }

    const concept = toConceptApi(parts[0]);
    if (!concept) {
      errors.push(`Linea ${idx + 1}: concepto invalido "${parts[0]}".`);
      return;
    }

    const moneda = toMoneda(parts[1]);
    if (!moneda) {
      errors.push(`Linea ${idx + 1}: moneda invalida "${parts[1]}". Usa PEN o USD.`);
      return;
    }

    const monto = toAmount(parts[2]);
    if (!monto) {
      errors.push(`Linea ${idx + 1}: monto invalido "${parts[2]}".`);
      return;
    }

    const fecha = toIsoDate(parts[3]);
    if (!fecha) {
      errors.push(`Linea ${idx + 1}: fecha invalida "${parts[3]}". Formato requerido: dd/mm/yyyy.`);
      return;
    }

    const notas = parts[4] ? parts[4].trim() : null;
    if (concept === 'gusto' && !notas) {
      errors.push(`Linea ${idx + 1}: para concepto "gusto" la nota es obligatoria.`);
      return;
    }

    rows.push({
      lineNumber: idx + 1,
      body: {
        concepto: concept,
        metodoPago: 'credito',
        moneda,
        monto,
        fecha,
        notas,
      },
    });
  });

  return { rows, errors };
};

export default function ModalGastoCreditoMasivo({ onClose, onSaved }) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [tarjeta, setTarjeta] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/cards`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setCards(arr);
        setTarjeta(arr[0]?.tipo || arr[0]?.type || '');
      } catch {
        if (alive) setCards([]);
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const preview = useMemo(() => parseBulkRows(bulkText), [bulkText]);

  const submitBulk = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setError('');
    setSuccessMsg('');

    if (!cards.length) return setError('No tienes tarjetas registradas.');
    if (!tarjeta) return setError('Selecciona una tarjeta.');

    const token = localStorage.getItem('token');
    if (!token) return setError('No hay sesion.');

    const parsed = parseBulkRows(bulkText);
    if (!parsed.rows.length) return setError('No hay lineas validas para guardar.');
    if (parsed.errors.length) {
      setError(parsed.errors.slice(0, 8).join('\n'));
      return;
    }

    setSaving(true);
    const created = [];
    const failed = [];

    try {
      for (const item of parsed.rows) {
        const body = { ...item.body, tarjeta };
        const res = await fetch(`${API_URL}/gastos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const detail = await res.text().catch(() => `HTTP ${res.status}`);
          failed.push(`Linea ${item.lineNumber}: ${detail}`);
          continue;
        }
        const row = await res.json().catch(() => null);
        if (row) created.push(row);
      }

      if (created.length) {
        onSaved?.(created);
      }

      if (failed.length) {
        setError(`Se guardaron ${created.length} gastos y fallaron ${failed.length}.\n${failed.slice(0, 6).join('\n')}`);
        return;
      }

      setSuccessMsg(`Se guardaron ${created.length} gastos correctamente.`);
      setBulkText('');
      onClose?.();
    } catch (err) {
      console.error('[ModalGastoCreditoMasivo] save error:', err);
      setError('No se pudo completar el guardado masivo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-2">Agregar gastos masivos (Credito)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Patron por linea: <code>concepto | moneda | monto | fecha(dd/mm/yyyy) | nota(opcional)</code>.
          Cada linea crea un solo gasto.
        </p>

        {error && (
          <div className="mb-3 text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            {successMsg}
          </div>
        )}

        {loadingCards ? (
          <div className="text-sm text-gray-600 mb-3">Cargando tarjetas...</div>
        ) : !cards.length ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            No tienes tarjetas registradas. Agrega una desde el panel de tarjetas.
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={submitBulk}>
          <label className="text-sm max-w-sm">
            <span className="block text-gray-600 mb-1">Tarjeta para todas las lineas</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={tarjeta}
              onChange={(e) => setTarjeta(e.target.value)}
              disabled={!cards.length}
            >
              {cards.map((c) => (
                <option key={cardValue(c)} value={cardValue(c)}>{cardLabel(c)}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <label className="text-sm text-gray-600">Lineas de gastos</label>
            <textarea
              className="w-full min-h-[220px] border rounded px-3 py-2 font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={[
                'comida | PEN | 35.50 | 18/02/2026 | almuerzo oficina',
                'transporte | PEN | 12 | 18/02/2026 | taxi',
                'inversion | USD | 120.00 | 17/02/2026 | iphone lote 2',
              ].join('\n')}
            />
            <div className="text-xs text-gray-500">
              Conceptos permitidos: {CREDIT_CONCEPTS.join(', ')}.
            </div>
          </div>

          {!!bulkText.trim() && (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-sm font-medium mb-2">Vista previa</div>
              <div className="text-xs text-gray-600 mb-2">
                Lineas validas: {preview.rows.length} | Errores: {preview.errors.length}
              </div>
              <div className="overflow-auto max-h-44">
                <table className="min-w-[680px] w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left py-1">Linea</th>
                      <th className="text-left py-1">Concepto</th>
                      <th className="text-left py-1">Moneda</th>
                      <th className="text-left py-1">Monto</th>
                      <th className="text-left py-1">Fecha</th>
                      <th className="text-left py-1">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={`preview-${r.lineNumber}`} className="border-t">
                        <td className="py-1">{r.lineNumber}</td>
                        <td className="py-1">{r.body.concepto}</td>
                        <td className="py-1">{r.body.moneda}</td>
                        <td className="py-1">{r.body.monto}</td>
                        <td className="py-1">{r.body.fecha}</td>
                        <td className="py-1">{r.body.notas || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !cards.length}
              className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar masivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
