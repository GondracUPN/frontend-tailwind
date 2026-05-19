// src/components/ModalGastoDebito.jsx
import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';
import { convertPenToUsd, TC_FIJO } from '../utils/tipoCambio';
import { localDateInputValue } from '../utils/dates';
import CloseX from './CloseX';

const BANKS_DEBITO = [
  { value: 'bcp', label: 'BCP' },
  { value: 'interbank', label: 'Interbank' },
  { value: 'bbva', label: 'BBVA' },
];

// Mapeo de tipos de tarjeta a nombres amigables
const CARD_FRIENDLY = {
  interbank: 'Interbank',
  bcp: 'BCP',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  visa_qore: 'Visa Qore',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

const BASE_CONCEPTOS_DEBITO = [
  { value: 'comida', label: 'Comida' },
  { value: 'gustos', label: 'Gustos' },
  { value: 'ingresos', label: 'Ingresos' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'pago_envios', label: 'Pago de envios' },
  { value: 'retiro_agente', label: 'Retiro agente' },
  { value: 'cashback', label: 'Cashback / Devolucion' },
  { value: 'gastos_recurrentes', label: 'Gastos mensuales' },
  { value: 'pago_tarjeta', label: 'Pago Tarjeta' },
];

const normConcept = (raw) => {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const map = {
    comida: 'comida',
    gusto: 'gusto',
    gustos: 'gusto',
    bolsa: 'bolsa',
    inversion: 'inversion',
    ingreso: 'ingreso',
    ingresos: 'ingreso',
    transporte: 'transporte',
    'pago envios': 'pago_envios',
    pago_envios: 'pago_envios',
    'retiro agente': 'retiro_agente',
    retiro_agente: 'retiro_agente',
    'gastos mensuales': 'gastos_recurrentes',
    'gasto mensual': 'gastos_recurrentes',
    gastos_recurrentes: 'gastos_recurrentes',
    'pago tarjeta': 'pago_tarjeta',
    pago_tarjeta: 'pago_tarjeta',
    cashback: 'cashback',
    'cashback / devolucion': 'cashback',
    devolucion: 'cashback',
  };
  return map[s] || s.replace(/\s+/g, '_');
};

const isFlexibleMoneda = (c) => {
  const n = normConcept(c);
  return ['ingreso', 'bolsa', 'gasto_recurrente', 'gastos_recurrentes', 'gusto', 'cashback'].some((k) => n.startsWith(k));
};


export default function ModalGastoDebito({ onClose, onSaved, userId }) {
  const [concepto, setConcepto] = useState(BASE_CONCEPTOS_DEBITO[0]?.value || 'comida');
  const [customConcepts, setCustomConcepts] = useState([]);
  const [moneda, setMoneda] = useState('PEN');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => localDateInputValue());
  const [pagoObjetivo, setPagoObjetivo] = useState('PEN'); // 'PEN' | 'USD'
  const [banco, setBanco] = useState('bcp');

  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [tarjetaPagar, setTarjetaPagar] = useState('');
  const [cardsErr, setCardsErr] = useState('');


  const [nota, setNota] = useState('');
  const [detalleMensual, setDetalleMensual] = useState('');
  const [tcPago, setTcPago] = useState(TC_FIJO);
  const [bolsaTomarDolares, setBolsaTomarDolares] = useState(false);
  const [bolsaMontoSoles, setBolsaMontoSoles] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Cargar tarjetas del usuario objetivo
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoadingCards(true);
        setCardsErr('');
        const token = localStorage.getItem('token');
        const url = `${API_URL}/cards${userId ? `?userId=${userId}` : ''}`;
        const res = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!alive) return;
        const list = Array.isArray(data) ? data : [];
        setCards(list);
        if (list.length) setTarjetaPagar(list[0].tipo || list[0].type || '');
      } catch (e) {
        if (alive) setCardsErr('No se pudieron cargar tus tarjetas.');
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

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
        if (!alive) return;
        setCustomConcepts((Array.isArray(rows) ? rows : []).filter((item) => item.appliesDebit));
      } catch {
        if (alive) setCustomConcepts([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // En conceptos distintos a pago_tarjeta, forzar soles
  useEffect(() => {
    const custom = customConcepts.find((item) => item.value === normConcept(concepto));
    if (custom) {
      setMoneda(custom?.metadata?.defaultCurrency === 'USD' ? 'USD' : 'PEN');
      setPagoObjetivo('PEN');
      return;
    }
    if (concepto === 'bolsa') {
      setMoneda('USD');
      setPagoObjetivo('PEN');
      return;
    }
    if (concepto !== 'pago_tarjeta' && !isFlexibleMoneda(concepto)) {
      setMoneda('PEN');
      setPagoObjetivo('PEN');
    }
  }, [concepto, customConcepts]);

  // ESC para cerrar
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleConceptChange = (val) => {
    setConcepto(val);
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setError('');
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return setError('Monto inválido.');
    if (!fecha) return setError('Selecciona fecha.');
    const isBolsa = concepto === 'bolsa';

    if (concepto === 'pago_tarjeta' && !tarjetaPagar) {
      return setError('Selecciona la tarjeta a la que vas a pagar.');
    }
    const isGusto = concepto === 'gustos' || concepto === 'gusto';
    const isMensual = concepto === 'gastos_recurrentes';
    if (isGusto && !String(nota).trim()) {
      return setError('Describe el gusto.');
    }
    if (isMensual && !String(detalleMensual).trim()) {
      return setError('Ingresa el detalle del gasto mensual.');
    }

    let bodyMoneda = moneda;
    let bodyMonto = n;
    const bodyExtra = {};
    if (isBolsa) {
      if (moneda === 'PEN') {
        bodyMoneda = 'PEN';
        bodyMonto = n;
      } else if (bolsaTomarDolares) {
        bodyMoneda = 'USD';
        bodyMonto = n;
      } else {
        const soles = Number(bolsaMontoSoles);
        const tc = Number(tcPago);
        if (!isFinite(soles) || soles <= 0) return setError('Ingresa el monto en soles.');
        if (!isFinite(tc) || tc <= 0) return setError('Ingresa tipo de cambio vÃ¡lido.');
        bodyMoneda = 'PEN';
        bodyMonto = soles;
        bodyExtra.tipoCambioDia = tc;
        bodyExtra.pagoObjetivo = 'USD';
        bodyExtra.montoUsdAplicado = Number(n.toFixed(2));
      }
    }

    const body = {
      concepto,
      metodoPago: 'debito',
      moneda: bodyMoneda,
      monto: bodyMonto,
      fecha,
      notas: isMensual ? String(detalleMensual).trim() : (nota ? String(nota).trim() : null),
      tarjeta: banco,
      ...(concepto === 'pago_tarjeta' ? { tarjetaPago: tarjetaPagar } : {}),
      ...bodyExtra,
    };

    if (concepto === 'pago_tarjeta') {
      body.pagoObjetivo = pagoObjetivo;
      if (pagoObjetivo === 'USD') {
        const tc = Number(tcPago);
        if (!isFinite(tc) || tc <= 0) return setError('Ingresa tipo de cambio válido.');
        body.tipoCambioDia = tc;
        if (moneda === 'PEN') {
          const usd = convertPenToUsd(n, tc);
          if (usd != null) body.montoUsdAplicado = Number(usd.toFixed(2));
        }
      } else {
        body.moneda = 'PEN';
      }
    }

    const token = localStorage.getItem('token');
    if (!token) return setError('No hay sesión.');

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/gastos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      onSaved?.(data);
    } catch (err) {
      console.error('[ModalGastoDebito] save error:', err);
      setError('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };
  const conceptoOptions = [
    ...BASE_CONCEPTOS_DEBITO,
    ...customConcepts.map((item) => ({ value: item.value, label: item.label })),
  ];
  const selectedCustomConcept = customConcepts.find((item) => item.value === normConcept(concepto));
  const selectedCustomCategory = String(selectedCustomConcept?.metadata?.category || '').toLowerCase();
  const conceptoIsIncome = concepto === 'ingreso' || selectedCustomCategory === 'income';
  const conceptoAllowsCurrency = isFlexibleMoneda(concepto) || Boolean(selectedCustomConcept);

  const showPagoTarjeta = concepto === 'pago_tarjeta';
  const showTarjetaDestino = showPagoTarjeta;
  const showBolsa = concepto === 'bolsa';
  const pagoTarjetaUsdPreview = (() => {
    if (!showPagoTarjeta || pagoObjetivo !== 'USD' || moneda !== 'PEN') return null;
    const soles = Number(monto);
    const tc = Number(tcPago);
    if (!isFinite(soles) || soles <= 0 || !isFinite(tc) || tc <= 0) return null;
    return soles / tc;
  })();
  const bolsaUsdPreview = (() => {
    if (!showBolsa || moneda !== 'USD' || bolsaTomarDolares) return null;
    const soles = Number(bolsaMontoSoles);
    const tc = Number(tcPago);
    if (!isFinite(soles) || soles <= 0 || !isFinite(tc) || tc <= 0) return null;
    return soles / tc;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-3">Agregar gasto (Débito)</h2>

        {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

        <form className="grid gap-3" onSubmit={submit}>
          <label className="text-sm">
                        <span className="block text-gray-600 mb-1">Concepto</span>
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e)=>handleConceptChange(e.target.value)}>
              {conceptoOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </label>

          {showPagoTarjeta ? (
            <>
              <div className="flex gap-4">
                <label className="text-sm inline-flex items-center gap-2">
                  <input type="radio" name="pagoObjetivo" value="PEN" checked={pagoObjetivo==='PEN'} onChange={()=>setPagoObjetivo('PEN')} />
                  <span>Pagar soles</span>
                </label>
                <label className="text-sm inline-flex items-center gap-2">
                  <input type="radio" name="pagoObjetivo" value="USD" checked={pagoObjetivo==='USD'} onChange={()=>setPagoObjetivo('USD')} />
                  <span>Pagar dólares</span>
                </label>
              </div>

              {pagoObjetivo === 'PEN' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                  <div></div>
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Monto</span>
                    <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Moneda del pago</span>
                    <select className="w-full border rounded px-3 py-2" value={moneda} onChange={(e)=>setMoneda(e.target.value)}>
                      <option value="PEN">Soles</option>
                      <option value="USD">Dólares</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Monto</span>
                    <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" />
                    {pagoTarjetaUsdPreview != null && (
                      <div className="mt-1 text-xs text-gray-500">
                        Equivale a $ {pagoTarjetaUsdPreview.toFixed(2)}
                      </div>
                    )}
                  </label>
                  {moneda === 'PEN' && (
                    <label className="text-sm">
                      <span className="block text-gray-600 mb-1">Tipo de cambio</span>
                      <input type="number" step="0.0001" min="0" className="w-full border rounded px-3 py-2" value={tcPago} onChange={(e)=>setTcPago(e.target.value)} placeholder={String(TC_FIJO)} />
                    </label>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {(concepto === 'gustos' || concepto === 'gusto') && (
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Detalle del gusto</span>
                  <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e)=>setNota(e.target.value)} placeholder="Ej. ropa, juego, accesorio" />
                </label>
              )}

              {concepto === 'gastos_recurrentes' && (
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Detalle del gasto mensual</span>
                  <input className="w-full border rounded px-3 py-2" value={detalleMensual} onChange={(e)=>setDetalleMensual(e.target.value)} placeholder="Ej. Internet, Netflix, Membresía" />
                </label>
              )}
              {showBolsa ? (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-emerald-950">Bolsa</div>
                      <div className="text-xs text-emerald-700">
                        En dolares descuenta soles por defecto; tambien puedes tomar del saldo USD.
                      </div>
                    </div>
                    {moneda === 'USD' && (
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500"
                          checked={bolsaTomarDolares}
                          onChange={(e) => setBolsaTomarDolares(e.target.checked)}
                        />
                        Tomar de dolares
                      </label>
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/70 p-1">
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${moneda === 'PEN' ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-800 hover:bg-emerald-100'}`}
                      onClick={() => {
                        setMoneda('PEN');
                        setBolsaTomarDolares(false);
                      }}
                    >
                      Soles
                    </button>
                    <button
                      type="button"
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${moneda === 'USD' ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-800 hover:bg-emerald-100'}`}
                      onClick={() => setMoneda('USD')}
                    >
                      Dolares
                    </button>
                  </div>

                  <div className={`mt-3 grid grid-cols-1 gap-3 ${moneda === 'USD' && !bolsaTomarDolares ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
                    <label className="text-sm">
                      <span className="block text-gray-600 mb-1">
                        {moneda === 'USD' ? 'Monto bolsa ($)' : 'Monto bolsa (S/)'}
                      </span>
                      <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" />
                    </label>
                    {moneda === 'USD' && !bolsaTomarDolares && (
                      <>
                        <label className="text-sm">
                          <span className="block text-gray-600 mb-1">Monto en soles</span>
                          <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={bolsaMontoSoles} onChange={(e)=>setBolsaMontoSoles(e.target.value)} placeholder="0.00" />
                          {bolsaUsdPreview != null && (
                            <div className="mt-1 text-xs text-gray-500">
                              Equivale a $ {bolsaUsdPreview.toFixed(2)}
                            </div>
                          )}
                        </label>
                        <label className="text-sm">
                          <span className="block text-gray-600 mb-1">Tipo de cambio</span>
                          <input type="number" step="0.0001" min="0" className="w-full border rounded px-3 py-2" value={tcPago} onChange={(e)=>setTcPago(e.target.value)} placeholder={String(TC_FIJO)} />
                        </label>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    {conceptoAllowsCurrency && (
                      <label className="text-sm">
                        <span className="block text-gray-600 mb-1">Moneda</span>
                        <select className="w-full border rounded px-3 py-2" value={moneda} onChange={(e)=>setMoneda(e.target.value)}>
                          <option value="PEN">Soles (PEN)</option>
                          <option value="USD">Dolares (USD)</option>
                        </select>
                      </label>
                    )}
                  </div>
                  <label className="text-sm">
                    <span className="block text-gray-600 mb-1">Monto</span>
                    <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" />
                  </label>
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">{conceptoIsIncome ? 'Fecha de ingreso' : (concepto === 'pago_tarjeta' ? 'Fecha de pago' : 'Fecha de compra')}</span>
              <input type="date" className="w-full border rounded px-3 py-2" value={fecha} onChange={(e)=>setFecha(e.target.value)} />
            </label>

            <label className="text-sm">
              <span className="block text-gray-600 mb-1">{concepto === 'ingreso' ? 'Tarjeta (banco)' : 'Débito (banco)'}</span>
              <select className="w-full border rounded px-3 py-2" value={banco} onChange={(e)=>setBanco(e.target.value)}>
                {BANKS_DEBITO.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </label>
          </div>

          {showTarjetaDestino && (
            <>
              {cardsErr && <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">{cardsErr}</div>}
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Tarjeta a la que paga</span>
                <select className="w-full border rounded px-3 py-2" value={tarjetaPagar} onChange={(e)=>setTarjetaPagar(e.target.value)} disabled={loadingCards || !cards.length}>
                  {cards.map(c => {
                    const type = c.tipo || c.type;
                    const label = c.label || c.name || CARD_FRIENDLY[type] || type;
                    return <option key={c.id} value={type}>{label}</option>;
                  })}
                </select>
                {!cards.length && (
                  <div className="mt-1 text-xs text-amber-700">No tienes tarjetas registradas. Agrega una en “Ingresar línea de crédito / Tarjeta”.</div>
                )}
              </label>
            </>
          )}

          {concepto !== 'gastos_recurrentes' && normConcept(concepto) !== 'gusto' && (
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">Nota (opcional)</span>
              <input className="w-full border rounded px-3 py-2" value={nota} onChange={(e)=>setNota(e.target.value)} placeholder=""/>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={saving || (concepto==='pago_tarjeta' && !cards.length)} className="px-5 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


