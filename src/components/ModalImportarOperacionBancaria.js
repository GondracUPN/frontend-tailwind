import React, { useMemo, useState } from 'react';
import { API_URL } from '../api';
import { parseBankOperations } from '../utils/bankOperationParser';
import CloseX from './CloseX';
import { createExpenseWithDuplicateCheck, ExpenseDuplicateCancelledError } from '../utils/createExpense';

const CARD_LABEL = { interbank: 'Interbank', bcp_amex: 'BCP Amex', bcp_visa: 'BCP Visa', visa_qore: 'Visa Qore', bbva: 'BBVA', io: 'IO', saga: 'Saga' };
const cardLabelForOwner = (type, ownerName) => type === 'bcp_visa'
  ? (String(ownerName || '').toLowerCase().includes('renato') ? 'BCP Visa (Visa Light)' : 'BCP Visa (Sapphire)')
  : (CARD_LABEL[type] || type);
const operationKey = (op, index) => op.operationNumber
  ? `${op.sourceBank}:${op.operationNumber}`
  : `${op.date}:${op.cardType}:${op.chargedCurrency}:${op.chargedAmount}:${index}`;

export default function ModalImportarOperacionBancaria({ userId, ownerName, cards = [], rows = [], onClose, onSaved }) {
  const [rawText, setRawText] = useState('');
  const [items, setItems] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const availableCards = useMemo(() => (Array.isArray(cards) ? cards : []).map((card) => String(card.tipo || '')).filter(Boolean), [cards]);

  const findDuplicate = (op) => op?.operationNumber ? rows.find((row) =>
    String(row.notas || '').includes(`Operación ${op.operationNumber}`)
      || String(row.notas || '').includes(`Operacion ${op.operationNumber}`)
      || String(row.notas || '').includes(`__BANK_IMPORT__:BCP:${op.operationNumber}`)) : null;
  const updateItem = (id, changes) => setItems((current) => current.map((item) => item.id === id ? { ...item, ...changes } : item));

  const analyze = (value = rawText) => {
    setError('');
    const parsed = parseBankOperations(value);
    const seen = new Set();
    const repeated = [];
    const nextItems = parsed.operations.reduce((result, operation, index) => {
      const key = operationKey(operation, index);
      if (seen.has(key)) {
        repeated.push({ error: `La operación ${operation.operationNumber || index + 1} está repetida en el texto y se omitió.` });
        return result;
      }
      seen.add(key);
      result.push({ id: `${key}:${index}`, operation, paymentTarget: operation.currency, exchangeRate: operation.exchangeRate ? String(operation.exchangeRate) : '3.7', status: 'ready', saveError: '' });
      return result;
    }, []);
    setItems(nextItems);
    setParseErrors([...parsed.errors, ...repeated]);
    if (!nextItems.length) setError(parsed.errors[0]?.error || 'No se encontraron operaciones bancarias reconocibles.');
  };

  const pasteClipboard = async () => {
    setError('');
    try {
      const value = await navigator.clipboard.readText();
      setRawText(value);
      analyze(value);
    } catch {
      setError('No se pudo leer el portapapeles. Pega los correos en el cuadro de texto.');
    }
  };

  const loadFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = '';
    if (!files.length) return;
    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      const value = contents.map((content, index) => `===== OPERACIÓN BANCARIA ${index + 1} =====\n\n${content}`).join('\n\n');
      setRawText(value);
      analyze(value);
    } catch {
      setError('No se pudieron leer los archivos seleccionados.');
    }
  };

  const expenseBody = ({ operation, paymentTarget, exchangeRate }) => {
    const rate = Number(exchangeRate);
    const body = {
      concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: operation.chargedCurrency,
      monto: Number(operation.chargedAmount), fecha: operation.date, tarjeta: operation.sourceBank,
      tarjetaPago: operation.cardType, pagoObjetivo: paymentTarget,
      notas: operation.operationNumber ? `__BANK_IMPORT__:BCP:${operation.operationNumber}` : '__BANK_IMPORT__:BCP',
    };
    if (paymentTarget === 'USD' && operation.chargedCurrency === 'PEN') {
      body.tipoCambioDia = rate;
      body.montoUsdAplicado = operation.currency === 'USD' ? Number(operation.amount) : Number((operation.chargedAmount / rate).toFixed(2));
    }
    return body;
  };

  const saveAll = async () => {
    if (saving) return;
    const pending = items.filter((item) => item.status !== 'saved');
    const invalid = pending.find((item) => {
      const rate = Number(item.exchangeRate);
      return !availableCards.includes(item.operation.cardType)
        || (item.paymentTarget === 'USD' && item.operation.chargedCurrency === 'PEN' && (!Number.isFinite(rate) || rate <= 0));
    });
    if (invalid) {
      setError(!availableCards.includes(invalid.operation.cardType)
        ? `Primero registra la tarjeta ${cardLabelForOwner(invalid.operation.cardType, ownerName)} para ${ownerName}.`
        : 'Revisa los tipos de cambio antes de importar.');
      return;
    }
    setSaving(true);
    setError('');
    let failures = 0;
    for (const item of pending) {
      updateItem(item.id, { status: 'saving', saveError: '' });
      try {
        const duplicate = findDuplicate(item.operation);
        let saved;
        if (duplicate) {
          const token = localStorage.getItem('token');
          const response = await fetch(`${API_URL}/gastos/${duplicate.id}`, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(expenseBody(item)),
          });
          if (!response.ok) throw new Error(await response.text());
          saved = await response.json();
        } else saved = await createExpenseWithDuplicateCheck(expenseBody(item), { userId });
        updateItem(item.id, { status: 'saved', saveError: '' });
        onSaved?.(saved);
      } catch (err) {
        failures += 1;
        updateItem(item.id, { status: 'error', saveError: err instanceof ExpenseDuplicateCancelledError ? 'Importación cancelada al revisar el posible duplicado.' : 'No se pudo guardar esta operación.' });
        console.error('[ImportarOperacionBancaria]', err);
      }
    }
    setSaving(false);
    if (!failures) onClose?.();
    else setError(`${failures} operación${failures === 1 ? '' : 'es'} no se pudo importar. Las demás sí quedaron guardadas.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div><h3 className="text-xl font-semibold">Importar operaciones bancarias</h3><p className="mt-1 text-sm text-gray-600">Puedes pegar varios correos juntos. Se guardarán en el panel de <strong>{ownerName || 'este usuario'}</strong>.</p></div>
          <CloseX onClick={onClose} />
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" onClick={pasteClipboard} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-700">Pegar lote del portapapeles</button>
          <label className="cursor-pointer rounded-lg border border-indigo-300 px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">Cargar archivos .txt o .eml<input type="file" multiple accept=".txt,.eml,text/plain,message/rfc822" onChange={loadFiles} className="hidden" /></label>
          {items.length > 0 && <span className="self-center text-sm font-semibold text-emerald-700">{items.length} operación{items.length === 1 ? '' : 'es'} reconocida{items.length === 1 ? '' : 's'}</span>}
        </div>
        <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} placeholder="Pega aquí uno o varios correos del banco..." className="min-h-[150px] w-full rounded-xl border border-gray-300 p-3 text-sm" />
        <button type="button" onClick={() => analyze()} disabled={!rawText.trim() || saving} className="mt-2 rounded-lg border border-indigo-300 px-4 py-2 text-sm text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">Analizar lote</button>
        {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {parseErrors.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{parseErrors.map((entry, index) => <div key={index}>Correo {Number.isInteger(entry.sourceIndex) ? entry.sourceIndex + 1 : index + 1}: {entry.error}</div>)}</div>}

        <div className="mt-4 grid gap-3">
          {items.map((item, index) => {
            const op = item.operation;
            const mappedCardExists = availableCards.includes(op.cardType);
            const duplicate = findDuplicate(op);
            return (
              <div key={item.id} className={`rounded-xl border p-4 ${item.status === 'saved' ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-gray-50'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-gray-900">#{index + 1} · {cardLabelForOwner(op.cardType, ownerName)} · {op.date}</div>
                  <div className="flex items-center gap-2">{item.status === 'saved' && <span className="text-sm font-semibold text-emerald-700">Guardada</span>}{item.status === 'saving' && <span className="text-sm font-semibold text-indigo-700">Guardando...</span>}{!saving && item.status !== 'saved' && <button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))} className="text-xs text-red-600 hover:underline">Quitar</button>}</div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
                  <div><span className="block text-xs text-gray-500">Aplicado</span><strong>{op.currency === 'USD' ? '$' : 'S/'} {op.amount.toFixed(2)}</strong></div>
                  <div><span className="block text-xs text-gray-500">Cobrado</span><strong>{op.chargedCurrency === 'USD' ? '$' : 'S/'} {op.chargedAmount.toFixed(2)}</strong></div>
                  <div><span className="block text-xs text-gray-500">Cuenta origen</span><strong>BCP {op.sourceLast4 ? `•••• ${op.sourceLast4}` : ''}</strong></div>
                  <div><span className="block text-xs text-gray-500">Operación</span><strong>{op.operationNumber || 'Sin número'}</strong></div>
                </div>
                {!mappedCardExists && <div className="mt-2 text-sm text-amber-800">La tarjeta detectada todavía no está registrada para {ownerName}.</div>}
                {duplicate && <div className="mt-2 text-sm text-amber-800">Ya existe: al importar se corregirá con los datos del correo.</div>}
                {item.saveError && <div className="mt-2 text-sm text-red-700">{item.saveError}</div>}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm text-gray-700">La deuda pagada era en<select disabled={saving || item.status === 'saved'} value={item.paymentTarget} onChange={(event) => updateItem(item.id, { paymentTarget: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 disabled:opacity-60"><option value="PEN">Soles</option><option value="USD">Dólares</option></select></label>
                  {item.paymentTarget === 'USD' && op.chargedCurrency === 'PEN' && <label className="text-sm text-gray-700">Tipo de cambio<input disabled={saving || item.status === 'saved'} type="number" min="0.01" step="0.0001" value={item.exchangeRate} onChange={(event) => updateItem(item.id, { exchangeRate: event.target.value })} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 disabled:opacity-60" /></label>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border px-4 py-2 disabled:opacity-50">Cerrar</button>
          <button type="button" onClick={saveAll} disabled={!items.some((item) => item.status !== 'saved') || saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Importando lote...' : `Importar ${items.filter((item) => item.status !== 'saved').length} operación${items.filter((item) => item.status !== 'saved').length === 1 ? '' : 'es'}`}</button>
        </div>
      </div>
    </div>
  );
}
