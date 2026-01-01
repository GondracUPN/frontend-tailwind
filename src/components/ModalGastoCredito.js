// src/components/ModalGastoCredito.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import CloseX from './CloseX';

const TC_CREDITO = 3.7;

const MONEDAS = [
  { value: 'PEN', label: 'Soles' },
  { value: 'USD', label: 'Dólares' },
];

const CREDIT_CONCEPTS = [
  { value: 'Comida', api: 'comida' },
  { value: 'Gusto', api: 'gusto', needsDetalleGusto: true },
  { value: 'Inversion', api: 'inversion' },
  { value: 'Pago Envios', api: 'pago_envios' },
  { value: 'Transporte', api: 'transporte' },
  { value: 'Deuda en cuotas', api: 'deuda_cuotas', needsCuotas: true },
  { value: 'Gastos mensuales', api: 'gastos_recurrentes', needsDetalleMensual: true },
  { value: 'Desgravamen', api: 'desgravamen' },
  { value: 'Cashback / Reembolso', api: 'cashback' },
];

const normConcept = (raw) => {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const map = {
    comida: 'comida',
    gusto: 'gusto',
    inversion: 'inversion',
    'pago envios': 'pago_envios',
    pago_envios: 'pago_envios',
    transporte: 'transporte',
    'deuda en cuotas': 'deuda_cuotas',
    deuda_cuotas: 'deuda_cuotas',
    'gastos mensuales': 'gastos_recurrentes',
    gastos_recurrentes: 'gastos_recurrentes',
    desgravamen: 'desgravamen',
    cashback: 'cashback',
    'cashback / reembolso': 'cashback',
  };
  return map[s] || s.replace(/\s+/g, '_');
};

const findConcept = (apiValue) => {
  const n = normConcept(apiValue);
  return CREDIT_CONCEPTS.find((c) => c.api === n);
};

const toDisplayConcept = (apiValue) => findConcept(apiValue)?.value || 'Comida';
const toApiConcept = (displayValue) => findConcept(displayValue)?.api || 'comida';

const orderByFrequency = (options, stats, cardKey) => {
  const baseIndex = new Map(options.map((o, idx) => [o.value, idx]));
  const cardStats = stats?.byCard?.[String(cardKey || 'default').toLowerCase()] || {};
  const globalStats = stats?.global || {};
  return [...options].sort((a, b) => {
    const na = a.api;
    const nb = b.api;
    const ca = cardStats[na] ?? globalStats[na] ?? 0;
    const cb = cardStats[nb] ?? globalStats[nb] ?? 0;
    if (ca !== cb) return cb - ca;
    return (baseIndex.get(a.value) ?? 0) - (baseIndex.get(b.value) ?? 0);
  });
};

const today = () => new Date().toISOString().slice(0, 10);

export default function ModalGastoCredito({ onClose, onSaved, userId, mode = 'create', initial = null, defaultCard = '' }) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);

  const [concepto, setConcepto] = useState(toDisplayConcept(initial?.concepto) || 'Comida');
  const defaultMoneda = (() => (normConcept(initial?.concepto) === 'inversion' ? 'USD' : 'PEN'))();
  const [moneda, setMoneda] = useState(initial?.moneda || defaultMoneda);
  const [monto, setMonto] = useState(initial?.monto != null ? String(initial.monto) : '');
  const [fecha, setFecha] = useState(initial?.fecha || today());
  const [nota, setNota] = useState(initial?.notas || initial?.detalleGusto || '');

  const [detalleMensual, setDetalleMensual] = useState('');
  const [tarjetaCompra, setTarjetaCompra] = useState(initial?.tarjeta || defaultCard || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conceptStats, setConceptStats] = useState({ global: {}, byCard: {} });
  const [conceptFromAuto, setConceptFromAuto] = useState(!initial?.concepto);

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
      const first = initial?.tarjeta || defaultCard || arr[0]?.tipo || arr[0]?.type || '';
      setTarjetaCompra((prev) => prev || first);
      } catch {
        if (alive) setCards([]);
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [userId, initial, defaultCard]);

  // Historial para ordenar conceptos segun frecuencia por tarjeta
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const url = userId ? `${API_URL}/gastos/all?userId=${userId}` : `${API_URL}/gastos`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error('historial');
        const data = await res.json();
        const stats = { global: {}, byCard: {} };
        (Array.isArray(data) ? data : []).forEach((g) => {
          if (g.metodoPago !== 'credito') return;
          const c = normConcept(g.concepto);
          const card = String(g.tarjeta || '').toLowerCase() || 'default';
          stats.global[c] = (stats.global[c] || 0) + 1;
          stats.byCard[card] = stats.byCard[card] || {};
          stats.byCard[card][c] = (stats.byCard[card][c] || 0) + 1;
        });
        if (alive) setConceptStats(stats);
      } catch {
        /* ignore */
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';

  const selectedConcept = useMemo(
    () => CREDIT_CONCEPTS.find((c) => c.value === concepto) || CREDIT_CONCEPTS.find((c) => c.api === normConcept(concepto)) || CREDIT_CONCEPTS[0],
    [concepto],
  );

  const conceptosOrdenados = useMemo(
    () => orderByFrequency(CREDIT_CONCEPTS, conceptStats, tarjetaCompra),
    [conceptStats, tarjetaCompra],
  );

  useEffect(() => {
    const first = conceptosOrdenados[0]?.value;
    if (!first) return;
    const exists = conceptosOrdenados.some((c) => c.value === concepto);
    if (!exists || conceptFromAuto) {
      setConcepto(first);
      setConceptFromAuto(true);
    }
  }, [tarjetaCompra, conceptosOrdenados, concepto, conceptFromAuto]);

  const handleConceptChange = (val) => {
    setConceptFromAuto(false);
    setConcepto(val);
  };

  const isCompra = true;
  const isCuotas = !!selectedConcept?.needsCuotas;
  const [cuotas, setCuotas] = useState('3');
  const needDetalleGusto = !!selectedConcept?.needsDetalleGusto;
  const needDetalleMensual = !!selectedConcept?.needsDetalleMensual;

  const fechaLabel = useMemo(() => 'Fecha de compra', []);

  useEffect(() => {
    const api = selectedConcept?.api;
    setMoneda(api === 'inversion' ? 'USD' : 'PEN');
  }, [concepto, selectedConcept?.api]);

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

    const conceptoApi = toApiConcept(concepto);

    const body = {
      concepto: conceptoApi,
      metodoPago: 'credito',
      moneda,
      monto: n,
      fecha,
      notas: nota?.trim() || null,
    };

    if (isCompra) {
      if (!tarjetaCompra) return setError('Selecciona una tarjeta.');
      body.tarjeta = tarjetaCompra;
      if (needDetalleGusto && !nota.trim()) return setError('Describe el gusto.');
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
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e) => handleConceptChange(e.target.value)}>
              {conceptosOrdenados.map((c) => (<option key={c.value} value={c.value}>{c.value}</option>))}
            </select>
          </label>

          {needDetalleGusto && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Detalle del gusto</span>
              <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Ropa, juego, accesorio…" />
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
              <select className="w-full border rounded px-3 py-2" value={tarjetaCompra} onChange={(e) => { setConceptFromAuto(true); setTarjetaCompra(e.target.value); }} disabled={!cards.length}>
                {cards.map((c) => (<option key={cardValue(c)} value={cardValue(c)}>{cardLabel(c)}</option>))}
              </select>
            </label>
          )}

          {!needDetalleGusto && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Nota (opcional)</span>
              <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle adicional�" />
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || !cards.length} className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">{saving ? (mode==='edit' ? 'Actualizando…' : 'Guardando…') : (mode==='edit' ? 'Actualizar' : 'Guardar')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
