import { API_URL } from '../api';

const CARD_LABELS = {
  interbank: 'Interbank',
  bcp: 'BCP',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  visa_qore: 'Visa Qore',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

export class ExpenseDuplicateCancelledError extends Error {
  constructor() {
    super('Creación cancelada al revisar posibles duplicados.');
    this.name = 'ExpenseDuplicateCancelledError';
    this.code = 'DUPLICATE_CANCELLED';
  }
}

const duplicateLine = (row) => {
  const concept = String(row.concepto || '-').replace(/_/g, ' ');
  const card = row.tarjetaPago || row.tarjeta || '-';
  const symbol = row.moneda === 'USD' ? '$' : 'S/';
  const amount = Math.abs(Number(row.monto || 0)).toFixed(2);
  return `${row.fecha || '-'} | ${concept} | ${CARD_LABELS[card] || card} | ${symbol} ${amount}`;
};

const confirmDuplicates = (duplicates) => {
  const rows = (Array.isArray(duplicates) ? duplicates : []).map(duplicateLine).join('\n');
  return window.confirm(
    `Posible gasto o pago duplicado\n\nFecha | Concepto | Tarjeta | Monto\n${rows}\n\nLas notas y detalles no se comparan.\n\n¿Confirmas que es un movimiento nuevo?`,
  );
};

export async function createExpenseWithDuplicateCheck(body, { userId } = {}) {
  const token = localStorage.getItem('token');
  const query = userId ? `?userId=${encodeURIComponent(String(userId))}` : '';
  const send = async (payload) => {
    const response = await fetch(`${API_URL}/gastos${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    return { response, data };
  };

  let result = await send(body);
  if (result.response.status === 409 && result.data?.code === 'DUPLICATE_GASTO') {
    if (!confirmDuplicates(result.data.duplicates)) throw new ExpenseDuplicateCancelledError();
    result = await send({ ...body, allowDuplicate: true });
  }
  if (!result.response.ok) {
    const message = result.data?.message || result.data?.error || `HTTP ${result.response.status}`;
    throw new Error(Array.isArray(message) ? message.join(' | ') : String(message));
  }
  return result.data;
}

