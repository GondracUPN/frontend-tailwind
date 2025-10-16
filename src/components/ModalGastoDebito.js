// src/components/ModalGastoDebito.jsx
import React, { useEffect, useState } from 'react';
import { API_URL } from '../api';
import { convertPenToUsd, TC_FIJO } from '../utils/tipoCambio';
import CloseX from './CloseX';

const BANKS_DEBITO = [
  { value: 'interbank', label: 'Interbank' },
  { value: 'bcp', label: 'BCP' },
  { value: 'bbva', label: 'BBVA' },
];

// Mapeo de tipos de tarjeta a nombres amigables
const CARD_FRIENDLY = {
  interbank: 'Interbank',
  bcp: 'BCP',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

export default function ModalGastoDebito({ onClose, onSaved, userId }) {
  const [concepto, setConcepto] = useState('comida');
  const [moneda, setMoneda] = useState('PEN');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [pagoObjetivo, setPagoObjetivo] = useState('PEN'); // 'PEN' | 'USD'
  const [banco, setBanco] = useState('interbank');

  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [tarjetaPagar, setTarjetaPagar] = useState('');
  const [cardsErr, setCardsErr] = useState('');

  const [nota, setNota] = useState('');
  const [detalleMensual, setDetalleMensual] = useState('');
  const [detalleGusto, setDetalleGusto] = useState('');
  const [tcPago, setTcPago] = useState(TC_FIJO);
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

  // En conceptos distintos a pago_tarjeta, forzar soles
  useEffect(() => {
    if (concepto !== 'pago_tarjeta') {
      setMoneda('PEN');
      setPagoObjetivo('PEN');
    }
  }, [concepto]);

  // ESC para cerrar
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setError('');
    const n = Number(monto);
    if (!isFinite(n) || n <= 0) return setError('Monto inválido.');
    if (!fecha) return setError('Selecciona fecha.');

    if (concepto === 'pago_tarjeta' && !tarjetaPagar) {
      return setError('Selecciona la tarjeta a la que vas a pagar.');
    }
    const isGusto = concepto === 'gustos' || concepto === 'gusto';
    const isMensual = concepto === 'gastos_recurrentes';
    if (isGusto && !String(detalleGusto).trim()) {
      return setError('Describe el gusto.');
    }
    if (isMensual && !String(detalleMensual).trim()) {
      return setError('Ingresa el detalle del gasto mensual.');
    }

    const body = {
      concepto,
      metodoPago: 'debito',
      moneda,
      monto: n,
      fecha,
      notas: isMensual ? String(detalleMensual).trim() : (nota || null),
      tarjeta: banco,
      ...(concepto === 'pago_tarjeta' ? { tarjetaPago: tarjetaPagar } : {}),
      ...(isGusto ? { detalleGusto: String(detalleGusto).trim() } : {}),
    };

    if (concepto === 'pago_tarjeta') {
      body.pagoObjetivo = pagoObjetivo;
      if (pagoObjetivo === 'USD') {
        body.tipoCambioDia = Number(tcPago);
        if (moneda === 'PEN') {
          const usd = convertPenToUsd(n, Number(tcPago));
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
      const res = await fetch(`${API_URL}/gastos`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
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

  const showPagoTarjeta = concepto === 'pago_tarjeta';
  const showTarjetaDestino = showPagoTarjeta;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto" onClick={(e)=>e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-3">Agregar gasto (Débito)</h2>

        {error && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

        <form className="grid gap-3" onSubmit={submit}>
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Concepto</span>
            <select className="w-full border rounded px-3 py-2" value={concepto} onChange={(e)=>setConcepto(e.target.value)}>
              <option value="comida">Comida</option>
              <option value="gustos">Gustos</option>
              <option value="ingresos">Ingresos</option>
              <option value="transporte">Transporte</option>
              <option value="pago_envios">Pago de envíos</option>
              <option value="retiro_agente">Retiro agente</option>
              <option value="gastos_recurrentes">Gastos mensuales</option>
              <option value="pago_tarjeta">Pago Tarjeta</option>
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
                  <input className="w-full border rounded px-3 py-2" value={detalleGusto} onChange={(e)=>setDetalleGusto(e.target.value)} placeholder="Ej. ropa, juego, accesorio" />
                </label>
              )}

              {concepto === 'gastos_recurrentes' && (
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Detalle del gasto mensual</span>
                  <input className="w-full border rounded px-3 py-2" value={detalleMensual} onChange={(e)=>setDetalleMensual(e.target.value)} placeholder="Ej. Internet, Netflix, Membresía" />
                </label>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div></div>
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Monto</span>
                  <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={monto} onChange={(e)=>setMonto(e.target.value)} placeholder="0.00" />
                </label>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block text-gray-600 mb-1">{concepto === 'ingreso' ? 'Fecha de ingreso' : (concepto === 'pago_tarjeta' ? 'Fecha de pago' : 'Fecha de compra')}</span>
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

          {concepto !== 'gastos_recurrentes' && (
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
