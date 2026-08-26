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

export const currentMonthlyExpenseRows = (rows, paymentMethod, storage) => {
  const hiddenKeys = readHiddenMonthlyExpenseKeys(storage);
  const byDetail = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (row?.metodoPago !== paymentMethod || !isMonthlyExpense(row)) return;
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
