import React, { useMemo, useState } from 'react';
import { API_URL } from '../api';
import { parseBankOperation } from '../utils/bankOperationParser';
import CloseX from './CloseX';
import { createExpenseWithDuplicateCheck, ExpenseDuplicateCancelledError } from '../utils/createExpense';

const CARD_LABEL = {
  interbank: 'Interbank',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  visa_qore: 'Visa Qore',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

const cardLabelForOwner = (type, ownerName) => {
  if (type === 'bcp_visa') {
    return String(ownerName || '').toLowerCase().includes('renato')
      ? 'BCP Visa (Visa Light)'
      : 'BCP Visa (Sapphire)';
  }
  return CARD_LABEL[type] || type;
};

export default function ModalImportarOperacionBancaria({
  userId,
  ownerName,
  cards = [],
  rows = [],
  onClose,
  onSaved,
}) {
  const [rawText, setRawText] = useState('');
  const [operation, setOperation] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState('PEN');
  const [exchangeRate, setExchangeRate] = useState('3.7');

  const availableCards = useMemo(
    () => (Array.isArray(cards) ? cards : []).map((card) => String(card.tipo || '')).filter(Boolean),
    [cards],
  );
  const duplicateRow = operation?.operationNumber ? rows.find((row) =>
    String(row.notas || '').includes(`Operación ${operation.operationNumber}`)
      || String(row.notas || '').includes(`Operacion ${operation.operationNumber}`)
      || String(row.notas || '').includes(`__BANK_IMPORT__:BCP:${operation.operationNumber}`)) : null;
  const isDuplicate = Boolean(duplicateRow);
  const mappedCardExists = operation ? availableCards.includes(operation.cardType) : true;

  const analyze = (value = rawText) => {
    setError('');
    const parsed = parseBankOperation(value);
    if (!parsed.ok) {
      setOperation(null);
      setError(parsed.error);
      return;
    }
    setOperation(parsed.operation);
    setPaymentTarget(parsed.operation.currency);
    setExchangeRate(parsed.operation.exchangeRate ? String(parsed.operation.exchangeRate) : '3.7');
  };

  const pasteClipboard = async () => {
    setError('');
    try {
      const value = await navigator.clipboard.readText();
      setRawText(value);
      analyze(value);
    } catch {
      setError('No se pudo leer el portapapeles. Pega el correo en el cuadro de texto.');
    }
  };

  const save = async () => {
    if (!operation || saving) return;
    if (!mappedCardExists) return setError(`Primero registra la tarjeta ${cardLabelForOwner(operation.cardType, ownerName)} para ${ownerName}.`);
    const rate = Number(exchangeRate);
    if (paymentTarget === 'USD' && operation.chargedCurrency === 'PEN' && (!Number.isFinite(rate) || rate <= 0)) {
      return setError('Ingresa un tipo de cambio válido.');
    }

    const internalReference = operation.operationNumber
      ? `__BANK_IMPORT__:BCP:${operation.operationNumber}`
      : '__BANK_IMPORT__:BCP';
    const body = {
      concepto: 'pago_tarjeta',
      metodoPago: 'debito',
      moneda: operation.chargedCurrency,
      monto: Number(operation.chargedAmount),
      fecha: operation.date,
      tarjeta: operation.sourceBank,
      tarjetaPago: operation.cardType,
      pagoObjetivo: paymentTarget,
      notas: internalReference,
    };
    if (paymentTarget === 'USD' && operation.chargedCurrency === 'PEN') {
      body.tipoCambioDia = rate;
      body.montoUsdAplicado = operation.currency === 'USD'
        ? Number(operation.amount)
        : Number((operation.chargedAmount / rate).toFixed(2));
    }

    setSaving(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      let saved;
      if (duplicateRow) {
        const response = await fetch(`${API_URL}/gastos/${duplicateRow.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(await response.text());
        saved = await response.json();
      } else {
        saved = await createExpenseWithDuplicateCheck(body, { userId });
      }
      onSaved?.(saved);
      onClose?.();
    } catch (err) {
      if (err instanceof ExpenseDuplicateCancelledError) return;
      console.error('[ImportarOperacionBancaria]', err);
      setError('No se pudo guardar la operación. Revisa los datos e inténtalo nuevamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold">Importar operación bancaria</h3>
            <p className="mt-1 text-sm text-gray-600">Se guardará en el panel de <strong>{ownerName || 'este usuario'}</strong>.</p>
          </div>
          <CloseX onClick={onClose} />
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={pasteClipboard} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700">Pegar del portapapeles</button>
        </div>

        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          placeholder="Pega aquí el contenido del correo del banco..."
          className="min-h-[180px] w-full rounded-xl border border-gray-300 p-3 text-sm"
        />
        <button type="button" onClick={() => analyze()} disabled={!rawText.trim()} className="mt-2 rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">Analizar operación</button>

        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        {operation && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="font-semibold text-emerald-900">Pago de tarjeta reconocido</div>
            <dl className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-gray-500">Propietario</dt><dd className="font-semibold">{ownerName}</dd></div>
              <div><dt className="text-gray-500">Fecha</dt><dd className="font-semibold">{operation.date}</dd></div>
              <div><dt className="text-gray-500">Aplicado a la tarjeta</dt><dd className="font-semibold">{operation.currency === 'USD' ? '$' : 'S/'} {operation.amount.toFixed(2)}</dd></div>
              <div><dt className="text-gray-500">Cobrado de la cuenta</dt><dd className="font-semibold">{operation.chargedCurrency === 'USD' ? '$' : 'S/'} {operation.chargedAmount.toFixed(2)}</dd></div>
              {operation.exchangeRate && <div><dt className="text-gray-500">Tipo de cambio del banco</dt><dd className="font-semibold">S/ {operation.exchangeRate.toFixed(4)}</dd></div>}
              <div><dt className="text-gray-500">Desde</dt><dd className="font-semibold">BCP {operation.sourceLast4 ? `•••• ${operation.sourceLast4}` : ''}</dd></div>
              <div><dt className="text-gray-500">Tarjeta detectada</dt><dd className="font-semibold">{cardLabelForOwner(operation.cardType, ownerName)} {operation.cardLast4 ? `•••• ${operation.cardLast4}` : ''}</dd></div>
              <div><dt className="text-gray-500">Operación</dt><dd className="font-semibold">{operation.operationNumber || 'Sin número'}</dd></div>
            </dl>

            {!mappedCardExists && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">La tarjeta detectada todavía no está registrada para {ownerName}.</div>}
            {isDuplicate && <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Esta operación ya existe. Al confirmar se corregirá con los valores detectados en el correo.</div>}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm text-gray-700">La deuda pagada era en
                <select value={paymentTarget} onChange={(event) => setPaymentTarget(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                  <option value="PEN">Soles</option>
                  <option value="USD">Dólares</option>
                </select>
              </label>
              {paymentTarget === 'USD' && operation.chargedCurrency === 'PEN' && (
                <label className="text-sm text-gray-700">Tipo de cambio
                  <input type="number" min="0.01" step="0.0001" value={exchangeRate} onChange={(event) => setExchangeRate(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
                  {Number(exchangeRate) > 0 && <span className="mt-1 block text-xs text-gray-600">Aplicará $ {operation.currency === 'USD' ? operation.amount.toFixed(2) : (operation.chargedAmount / Number(exchangeRate)).toFixed(2)}</span>}
                </label>
              )}
            </div>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancelar</button>
          <button type="button" onClick={save} disabled={!operation || saving || !mappedCardExists} className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Guardando...' : (isDuplicate ? 'Corregir operación' : 'Confirmar e importar')}</button>
        </div>
      </div>
    </div>
  );
}
