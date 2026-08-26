const normalize = (value) => String(value || '').trim().toLowerCase().replace(/\s+/g, '_');

export const isMonthlyExpense = (row) => (
  ['gastos_recurrentes', 'gastos_mensuales'].includes(normalize(row?.concepto))
);

export const monthlyExpenseKey = (row) => [
  row?.metodoPago || '',
  row?.moneda || '',
  row?.tarjeta || row?.tarjetaPago || '-',
  String(row?.notas || '').trim() || '-',
].join('|');

const browserStorage = () => (typeof window !== 'undefined' ? window.localStorage : null);

export const readHiddenMonthlyExpenseKeys = (storage) => {
  try {
    const parsed = JSON.parse((storage || browserStorage())?.getItem('mensuales_hidden') || '[]');
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
};

const writeHiddenMonthlyExpenseKeys = (keys, storage) => {
  try {
    (storage || browserStorage())?.setItem('mensuales_hidden', JSON.stringify(Array.from(keys)));
  } catch {
    // Las preferencias del selector no deben impedir guardar o borrar un gasto.
  }
  return keys;
};

export const hideMonthlyExpense = (row, storage) => {
  if (!isMonthlyExpense(row)) return readHiddenMonthlyExpenseKeys(storage);
  const keys = readHiddenMonthlyExpenseKeys(storage);
  keys.add(monthlyExpenseKey(row));
  return writeHiddenMonthlyExpenseKeys(keys, storage);
};

export const restoreMonthlyExpense = (row, storage) => {
  if (!isMonthlyExpense(row)) return readHiddenMonthlyExpenseKeys(storage);
  const keys = readHiddenMonthlyExpenseKeys(storage);
  keys.delete(monthlyExpenseKey(row));
  return writeHiddenMonthlyExpenseKeys(keys, storage);
};

export const hasActiveMonthlySchedule = (row, schedules) => {
  const amount = Number(row?.monto || 0).toFixed(2);
  const paymentMethod = String(row?.metodoPago || '');
  const currency = String(row?.moneda || '');
  const card = String(row?.tarjeta || '');

  return (Array.isArray(schedules) ? schedules : []).some((schedule) => {
    if (schedule?.active === false) return false;
    if (normalize(schedule?.tipo) !== 'recurrente') return false;
    if (!['gastos_recurrentes', 'gastos_mensuales'].includes(normalize(schedule?.concepto))) return false;
    if (String(schedule?.metodoPago || '') !== paymentMethod) return false;
    if (String(schedule?.moneda || '') !== currency) return false;
    if (Number(schedule?.monto || 0).toFixed(2) !== amount) return false;
    // Si el último movimiento que originó la programación fue borrado, no se
    // debe retroceder a otro pago histórico de meses anteriores.
    if (schedule?.lastDate && String(schedule.lastDate) !== String(row?.fecha || '')) return false;
    // Las programaciones de débito antiguas no guardaban el banco de origen.
    return paymentMethod !== 'credito' || String(schedule?.tarjeta || '') === card;
  });
};

export const currentMonthlyExpenseRows = (rows, paymentMethod, storage, schedules) => {
  const hiddenKeys = readHiddenMonthlyExpenseKeys(storage);
  const byDetail = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row?.metodoPago !== paymentMethod || !isMonthlyExpense(row)) return;
    if (Array.isArray(schedules) && !hasActiveMonthlySchedule(row, schedules)) return;
    if (hiddenKeys.has(monthlyExpenseKey(row))) return;
    const detail = String(row?.notas || '').trim();
    if (!detail) return;
    const previous = byDetail.get(detail);
    if (!previous || String(row?.fecha || '') > String(previous?.fecha || '')) byDetail.set(detail, row);
  });

  return Array.from(byDetail.values()).sort((a, b) => (
    String(a.notas).localeCompare(String(b.notas), 'es')
  ));
};
