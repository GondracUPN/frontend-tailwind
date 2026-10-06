// src/components/ModalEditarGasto.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import { localDateInputValue } from '../utils/dates';
import { isTechnicalExpenseNote, visibleExpenseNotes } from '../utils/expenseConcepts';
import CloseX from './CloseX';
import { formatPending500, getPending500 } from '../utils/pending500';

const BANKS_DEBITO = [
  { value: 'bcp', label: 'BCP' },
  { value: 'interbank', label: 'Interbank' },
  { value: 'bbva', label: 'BBVA' },
];

const normalizeEditConcept = (g, isCredito) => (
  !isCredito && String(g?.concepto || '').toLowerCase() === 'inversion'
    ? 'bolsa'
    : (g?.concepto || '')
);

export default function ModalEditarGasto({ gasto, onClose, onSaved }) {
  const isCredito = gasto?.metodoPago === 'credito';
  const [monto, setMonto] = useState(String(Math.abs(Number(gasto?.monto ?? 0)) || ''));
  const [cantidad500, setCantidad500] = useState(gasto?.cantidad500 ? String(gasto.cantidad500) : '');
  const [ingresoEn500, setIngresoEn500] = useState(Boolean(gasto?.cantidad500));
  const [destinatario500, setDestinatario500] = useState(gasto?.destinatario500 || '');
  const [fecha, setFecha] = useState(gasto?.fecha || localDateInputValue());
  const [notas, setNotas] = useState(visibleExpenseNotes(gasto?.notas, ''));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [concepto, setConcepto] = useState(() => normalizeEditConcept(gasto, isCredito));
  const [tarjeta, setTarjeta] = useState(gasto?.tarjeta || '');
  const [tarjetaPago, setTarjetaPago] = useState(gasto?.tarjetaPago || '');
  const [moneda, setMoneda] = useState(gasto?.moneda || 'PEN');
  const [tipoCambio, setTipoCambio] = useState(gasto?.tasaUsdPen ? String(Number(gasto.tasaUsdPen)) : '');
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [customConcepts, setCustomConcepts] = useState([]);

  const titulo = isCredito ? 'Editar gasto (Crédito)' : 'Editar gasto (Débito)';

  const conceptoOptions = useMemo(() => {
    const base = isCredito
      ? [
        { value: 'inversion', label: 'Inversion' },
        { value: 'pago_envios', label: 'Pago envios' },
        { value: 'comida', label: 'Comida' },
        { value: 'gusto', label: 'Gusto' },
        { value: 'transporte', label: 'Transporte' },
        { value: 'reinicio', label: 'Reinicio' },
        { value: 'gastos_recurrentes', label: 'Gastos mensuales' },
        { value: 'desgravamen', label: 'Desgravamen' },
        { value: 'deuda_cuotas', label: 'Deuda en cuotas' },
        { value: 'cashback', label: 'Cashback reembolso' },
      ]
      : [
      { value: 'comida', label: 'Comida' },
      { value: 'gustos', label: 'Gustos' },
      { value: 'ingresos', label: 'Ingresos' },
      { value: 'itf', label: 'ITF' },
      { value: 'bolsa', label: 'Bolsa' },
      { value: 'retiro_agente', label: 'Retiro agente' },
      { value: 'transporte', label: 'Transporte' },
      { value: 'gastos_recurrentes', label: 'Gastos mensuales' },
      { value: 'pago_tarjeta', label: 'Pago Tarjeta' },
    ];
    const custom = customConcepts
      .filter((item) => (isCredito ? item.appliesCredit : item.appliesDebit))
      .map((item) => ({ value: item.value, label: item.label }));
    const merged = [...base];
    custom.forEach((item) => {
      if (!merged.some((option) => option.value === item.value)) merged.push(item);
    });
    const current = normalizeEditConcept(gasto, isCredito);
    if (current && !merged.some((option) => option.value === current)) {
      merged.push({ value: current, label: String(current).replace(/_/g, ' ') });
    }
    return merged;
  }, [customConcepts, gasto, isCredito]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/catalog/expense-concepts`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('catalog');
        const rows = await res.json();
        if (alive) setCustomConcepts(Array.isArray(rows) ? rows : []);
      } catch {
        if (alive) setCustomConcepts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    setConcepto(normalizeEditConcept(gasto, isCredito));
    setTarjeta(gasto.tarjeta || '');
    setTarjetaPago(gasto.tarjetaPago || '');
    setMoneda(gasto.moneda || 'PEN');
    setTipoCambio(gasto.tasaUsdPen ? String(Number(gasto.tasaUsdPen)) : '');
    setMonto(String(Math.abs(Number(gasto.monto || 0)) || ''));
    setIngresoEn500(Boolean(gasto.cantidad500));
    setCantidad500(gasto.cantidad500 ? String(gasto.cantidad500) : '');
    setDestinatario500(gasto.destinatario500 || '');
    setNotas(visibleExpenseNotes(gasto.notas, ''));
  }, [gasto, isCredito]);

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
    const isIngresoEn500 = !isCredito && ['ingreso', 'ingresos'].includes(concepto) && moneda === 'PEN' && ingresoEn500;
    if (isIngresoEn500 && (!Number.isInteger(Number(cantidad500)) || Number(cantidad500) < 1 || Number(cantidad500) * 500 > n)) {
      return setErr('La cantidad x500 no puede superar el monto del ingreso.');
    }
    if (isIngresoEn500 && !destinatario500) {
      return setErr('Indica si los depósitos se dieron a ti o a Renato.');
    }
    if (!fecha) return setErr('Selecciona fecha.');
    const isDebitCardPayment = !isCredito && concepto === 'pago_tarjeta' && moneda === 'PEN';
    const rate = tipoCambio.trim() ? Number(tipoCambio) : null;
    if (isDebitCardPayment && (rate != null || gasto.tasaUsdPen != null) && (!Number.isFinite(rate) || rate <= 0)) {
      return setErr('Ingresa un tipo de cambio válido para este pago.');
    }
    const token = localStorage.getItem('token');
    if (!token) return setErr('No hay sesión.');
    setSaving(true);
    try {
      const notesToSave = isTechnicalExpenseNote(gasto.notas) && !notas.trim()
        ? gasto.notas
        : (notas || null);
      const body = { monto: Math.abs(n), fecha, notas: notesToSave, moneda };
      body.cantidad500 = isIngresoEn500 ? Number(cantidad500) : null;
      body.destinatario500 = isIngresoEn500 ? destinatario500 : null;
      if (concepto) body.concepto = concepto;
      if (isCredito) {
        if (tarjeta) body.tarjeta = tarjeta;
      } else {
        if (tarjeta) body.tarjeta = tarjeta; // banco
        if (concepto === 'pago_tarjeta') body.tarjetaPago = tarjetaPago || null;
      }
      if (isDebitCardPayment && rate != null) {
        body.tipoCambioDia = rate;
        body.pagoObjetivo = 'USD';
        body.montoUsdAplicado = Number((n / rate).toFixed(2));
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

  const handleOverlay = (e) => { if (e.target === e.currentTarget) onClose?.(); };

  if (!gasto) return null;

  const pending500 = getPending500(monto, cantidad500);
  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleOverlay}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-3">{titulo}</h2>

        {err && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>}

        <div className="mb-2 text-xs text-gray-600">
          <div>Concepto: <b className="capitalize">{String(gasto.concepto || '').toLowerCase() === 'bolsa' || (!isCredito && String(gasto.concepto || '').toLowerCase() === 'inversion') ? 'Bolsa' : String(gasto.concepto || '').replace(/_/g,' ')}</b></div>
          <div>Método: <b className="capitalize">{gasto.metodoPago}</b> • Moneda: <b>{gasto.moneda}</b> • Tarjeta/Banco: <b>{gasto.tarjeta || '-'}</b></div>
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
                  <option key={c.id || c.tipo || c.type} value={c.tipo || c.type}>{c.label || c.name || c.tipo || c.type}</option>
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
                  <option key={c.id || c.tipo || c.type} value={c.tipo || c.type}>{c.label || c.name || c.tipo || c.type}</option>
                ))}
              </select>
            </label>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Moneda</span>
              <select className="w-full border rounded px-3 py-2" value={moneda} onChange={(e)=>setMoneda(e.target.value)}>
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Monto ({moneda === 'USD' ? '$' : 'S/'})</span>
              <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" required />
            </label>
          </div>

          {!isCredito && concepto === 'pago_tarjeta' && moneda === 'PEN' && <label className="text-sm">
            <span className="block text-gray-600 mb-1">Tipo de cambio (S/ por $)</span>
            <input aria-label="Tipo de cambio (S/ por $)" type="number" min="0.0001" step="0.0001" className="w-full border rounded px-3 py-2" value={tipoCambio} onChange={(event) => setTipoCambio(event.target.value)} placeholder="Opcional" />
            {Number(tipoCambio) > 0 && Number(monto) > 0 && <span className="block mt-1 text-xs text-gray-600">Equivale a $ {(Number(monto) / Number(tipoCambio)).toFixed(2)}</span>}
          </label>}

          {!isCredito && ['ingreso', 'ingresos'].includes(concepto) && moneda === 'PEN' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 font-medium text-emerald-900"><input type="checkbox" checked={ingresoEn500} onChange={(event) => setIngresoEn500(event.target.checked)} />x500</label>
                {ingresoEn500 && <span className="font-semibold text-amber-800">Faltante: S/ {pending500.amount.toFixed(2)}</span>}
              </div>
              {ingresoEn500 && <div className="mt-1 text-xs text-amber-800">{formatPending500(pending500)}</div>}
              {ingresoEn500 && <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">Cantidad de 500<input type="number" min="1" step="1" value={cantidad500} onChange={(event) => setCantidad500(event.target.value)} className="mt-1 w-full rounded border border-emerald-300 px-3 py-2" required /></label>
                <label className="block">¿A quién se le dio?<select value={destinatario500} onChange={(event) => setDestinatario500(event.target.value)} className="mt-1 w-full rounded border border-emerald-300 px-3 py-2" required><option value="">Seleccionar</option><option value="yo">Yo</option><option value="renato">Renato</option></select></label>
              </div>}
            </div>
          )}

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

