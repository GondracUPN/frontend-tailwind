// src/components/ModalGastoCredito.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { API_URL } from '../api';
import { localDateInputValue } from '../utils/dates';
import CloseX from './CloseX';

const TC_CREDITO = 3.7;

const MONEDAS = [
  { value: 'PEN', label: 'Soles' },
  { value: 'USD', label: 'Dólares' },
];

const CREDIT_CONCEPTS = [
  { value: 'Inversion', api: 'inversion' },
  { value: 'Pago envios', api: 'pago_envios' },
  { value: 'Comida', api: 'comida' },
  { value: 'Gusto', api: 'gusto', needsDetalleGusto: true },
  { value: 'Transporte', api: 'transporte' },
  { value: 'Reinicio', api: 'reinicio' },
  { value: 'Gastos mensuales', api: 'gastos_recurrentes', needsDetalleMensual: true },
  { value: 'Desgravamen', api: 'desgravamen' },
  { value: 'Deuda en cuotas', api: 'deuda_cuotas', needsCuotas: true },
  { value: 'Cashback reembolso', api: 'cashback' },
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
    reinicio: 'reinicio',
    'deuda en cuotas': 'deuda_cuotas',
    deuda_cuotas: 'deuda_cuotas',
    'gastos mensuales': 'gastos_recurrentes',
    gastos_recurrentes: 'gastos_recurrentes',
    desgravamen: 'desgravamen',
    cashback: 'cashback',
    'cashback / reembolso': 'cashback',
    'cashback reembolso': 'cashback',
  };
  return map[s] || s.replace(/\s+/g, '_');
};

const findConcept = (apiValue) => {
  const n = normConcept(apiValue);
  return CREDIT_CONCEPTS.find((c) => c.api === n);
};

const toDisplayConcept = (apiValue) => findConcept(apiValue)?.value || 'Comida';

export default function ModalGastoCredito({
  onClose,
  onSaved,
  userId,
  mode = 'create',
  initial = null,
  defaultCard = '',
  expenseConcepts = [],
  rows = [],
}) {
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const customConcepts = useMemo(
    () => (Array.isArray(expenseConcepts) ? expenseConcepts : []).filter((item) => item.appliesCredit),
    [expenseConcepts],
  );

  const [concepto, setConcepto] = useState(() => {
    if (!initial?.concepto) return CREDIT_CONCEPTS[0]?.value || 'Comida';
    const custom = customConcepts.find((item) => normConcept(item.value) === normConcept(initial.concepto));
    return custom?.label || toDisplayConcept(initial.concepto);
  });
  const defaultMoneda = (() => (normConcept(initial?.concepto) === 'inversion' ? 'USD' : 'PEN'))();
  const [moneda, setMoneda] = useState(initial?.moneda || defaultMoneda);
  const [monto, setMonto] = useState(initial?.monto != null ? String(initial.monto) : '');
  const [fecha, setFecha] = useState(initial?.fecha || localDateInputValue());
  const [nota, setNota] = useState(initial?.notas || initial?.detalleGusto || '');

  const [detalleMensual, setDetalleMensual] = useState('');
  const [monthlySelection, setMonthlySelection] = useState('__new__');
  const [monthlyVariable, setMonthlyVariable] = useState(false);
  const [tarjetaCompra, setTarjetaCompra] = useState(initial?.tarjeta || defaultCard || '');

  const monthlyOptions = useMemo(() => {
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (row?.metodoPago !== 'credito' || normConcept(row?.concepto) !== 'gastos_recurrentes') return;
      const detail = String(row?.notas || '').trim();
      if (!detail) return;
      const previous = map.get(detail);
      if (!previous || String(row?.fecha || '') > String(previous?.fecha || '')) map.set(detail, row);
    });
    return Array.from(map.values()).sort((a, b) => String(a.notas).localeCompare(String(b.notas), 'es'));
  }, [rows]);

  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const montoInputRef = useRef(null);

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';

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

  const handleConceptChange = (val) => {
    setConcepto(val);
  };

  const handleMonthlySelection = (value) => {
    setMonthlySelection(value);
    if (value === '__new__') {
      setDetalleMensual('');
      setMonthlyVariable(false);
      return;
    }
    const selected = monthlyOptions.find((item) => String(item.id) === value);
    if (!selected) return;
    const detail = String(selected.notas || '');
    setDetalleMensual(detail);
    setMonto(String(Math.abs(Number(selected.monto || 0)) || ''));
    setMoneda(selected.moneda === 'USD' ? 'USD' : 'PEN');
    if (selected.tarjeta) setTarjetaCompra(selected.tarjeta);
    try {
      const types = JSON.parse(localStorage.getItem('mensuales_types') || '{}');
      const key = ['credito', selected.moneda, selected.tarjeta || '-', detail].join('|');
      setMonthlyVariable(types[key] === 'variable');
    } catch { setMonthlyVariable(false); }
  };

  const isCompra = true;
  const conceptOptions = useMemo(() => [
    ...CREDIT_CONCEPTS,
    ...customConcepts.map((item) => ({
      value: item.label,
      api: item.value,
      metadata: item.metadata || {},
    })),
  ], [customConcepts]);
  const toApiConceptLocal = (displayValue) => {
    const n = normConcept(displayValue);
    return conceptOptions.find((c) => c.value === displayValue || c.api === n)?.api || n || 'comida';
  };
  const selectedConcept = useMemo(
    () => conceptOptions.find((c) => c.value === concepto) || conceptOptions.find((c) => c.api === normConcept(concepto)) || conceptOptions[0],
    [conceptOptions, concepto],
  );
  const isCuotas = !!selectedConcept?.needsCuotas;
  const [cuotas, setCuotas] = useState('3');
  const needDetalleGusto = !!selectedConcept?.needsDetalleGusto;
  const needDetalleMensual = !!selectedConcept?.needsDetalleMensual;

  const fechaLabel = useMemo(() => 'Fecha de compra', []);

  useEffect(() => {
    const api = selectedConcept?.api;
    setMoneda(selectedConcept?.metadata?.defaultCurrency === 'USD' || api === 'inversion' ? 'USD' : 'PEN');
  }, [concepto, selectedConcept?.api, selectedConcept?.metadata?.defaultCurrency]);

  const onSubmit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    const keepOpen = mode !== 'edit' && e?.nativeEvent?.submitter?.value === 'continue';
    setError('');
    setSuccess('');
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return setError('Monto inválido.');
    if (!fecha) return setError('Selecciona fecha.');

    const token = localStorage.getItem('token');
    if (!token) return setError('No hay sesión.');
    if (!cards.length) return setError('No tienes tarjetas registradas.');

    const conceptoApi = toApiConceptLocal(concepto);

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
    setSavingAction(keepOpen ? 'continue' : 'close');
    try {
      const url = mode === 'edit' && initial?.id ? `${API_URL}/gastos/${initial.id}` : `${API_URL}/gastos`;
      const method = mode === 'edit' && initial?.id ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const data = await res.json().catch(() => null);
      if (needDetalleMensual && data) {
        try {
          const types = JSON.parse(localStorage.getItem('mensuales_types') || '{}');
          const key = ['credito', data.moneda, data.tarjeta || '-', data.notas || '-'].join('|');
          localStorage.setItem('mensuales_types', JSON.stringify({ ...types, [key]: monthlyVariable ? 'variable' : 'fijo' }));
        } catch {}
      }
      onSaved?.(data, { keepOpen });
      if (keepOpen) {
        setMonto('');
        setNota('');
        setDetalleMensual('');
        setMonthlySelection('__new__');
        setMonthlyVariable(false);
        setSuccess('Gasto guardado. Puedes continuar con el siguiente.');
        window.setTimeout(() => montoInputRef.current?.focus(), 0);
      } else {
        onClose?.();
      }
    } catch (err) {
      console.error('[ModalGastoCredito] save error:', err);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
      setSavingAction('');
    }
  };

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleOverlay}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-3">{mode==='edit' ? 'Editar gasto (Crédito)' : 'Agregar gasto (Crédito)'}</h2>

        {error && (<div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>)}
        {success && (<div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{success}</div>)}

        {loadingCards ? (
          <div className="text-sm text-gray-600 mb-3">Cargando tus tarjetas…</div>
        ) : !cards.length ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">No tienes tarjetas registradas. Agrega una desde el panel de tarjetas.</div>
        ) : null}

        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="text-sm">
                        <span className="block text-gray-600 mb-1">Concepto</span>
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e) => handleConceptChange(e.target.value)}>
              {conceptOptions.map((c) => (<option key={c.api || c.value} value={c.value}>{c.value}</option>))}
            </select>
          </label>

          {needDetalleGusto && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Detalle del gusto</span>
              <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Ej. Ropa, juego, accesorio…" />
            </label>
          )}

          {needDetalleMensual && (
            <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Gasto mensual</span>
                <select className="w-full border rounded px-3 py-2 bg-white" value={monthlySelection} onChange={(e)=>handleMonthlySelection(e.target.value)}>
                  <option value="__new__">Nuevo gasto mensual</option>
                  {monthlyOptions.map((item) => <option key={item.id} value={String(item.id)}>{item.notas}</option>)}
                </select>
              </label>
              {monthlySelection === '__new__' && (
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Detalle del gasto mensual</span>
                  <input className="w-full border rounded px-3 py-2 bg-white" value={detalleMensual} onChange={(e) => setDetalleMensual(e.target.value)} placeholder="Ej. Netflix, Internet, Membresía" />
                </label>
              )}
              <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" className="h-4 w-4 rounded" checked={monthlyVariable} onChange={(e)=>setMonthlyVariable(e.target.checked)} />
                Es variable <span className="font-normal text-gray-500">(sin marcar es fijo)</span>
              </label>
            </div>
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
              <input ref={montoInputRef} type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={moneda === 'USD' ? '$ 0.00' : '0.00'} required />
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

          {!needDetalleGusto && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Nota (opcional)</span>
              <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Detalle adicional�" />
            </label>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <button type="button" className="w-full px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300 sm:w-auto" onClick={onClose}>Cancelar</button>
            <button type="submit" value="close" disabled={saving || !cards.length} className="w-full px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto">
              {saving && savingAction === 'close' ? (mode === 'edit' ? 'Actualizando...' : 'Guardando...') : (mode === 'edit' ? 'Actualizar' : 'Guardar')}
            </button>
            {mode !== 'edit' && (
              <button type="submit" value="continue" disabled={saving || !cards.length} className="w-full px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60 sm:w-auto">
                {saving && savingAction === 'continue' ? 'Guardando...' : 'Guardar y continuar'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}



