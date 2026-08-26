import {
  currentMonthlyExpenseRows,
  hasActiveMonthlySchedule,
  hideMonthlyExpense,
  monthlyExpenseKey,
  readHiddenMonthlyExpenseKeys,
  restoreMonthlyExpense,
} from './monthlyExpenses';

const storageWith = (value) => ({ getItem: jest.fn(() => value) });
const writableStorageWith = (value) => {
  let current = value;
  return {
    getItem: jest.fn(() => current),
    setItem: jest.fn((key, next) => { current = next; }),
  };
};

test('excluye del selector los gastos mensuales retirados aunque conserven historial', () => {
  const active = { id: 1, concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', tarjeta: 'visa', notas: 'Spotify', fecha: '2026-08-01' };
  const removed = { id: 2, concepto: 'Gastos mensuales', metodoPago: 'credito', moneda: 'PEN', tarjeta: 'visa', notas: 'Amazon', fecha: '2026-07-01' };
  const storage = storageWith(JSON.stringify([monthlyExpenseKey(removed)]));

  expect(currentMonthlyExpenseRows([removed, active], 'credito', storage)).toEqual([active]);
});

test('conserva solo el pago más reciente de cada gasto mensual vigente', () => {
  const oldRow = { id: 1, concepto: 'gastos_recurrentes', metodoPago: 'debito', moneda: 'PEN', notas: 'Internet', fecha: '2026-06-01' };
  const recentRow = { ...oldRow, id: 2, fecha: '2026-07-01' };

  expect(currentMonthlyExpenseRows([oldRow, recentRow], 'debito', storageWith('[]'))).toEqual([recentRow]);
});

test('tolera preferencias locales dañadas sin ocultar gastos vigentes', () => {
  expect(readHiddenMonthlyExpenseKeys(storageWith('{invalido'))).toEqual(new Set());
});

test('al borrar un gasto mensual oculta también su historial del selector', () => {
  const oldRow = { id: 1, concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', tarjeta: 'visa', notas: 'Internet', fecha: '2026-06-01' };
  const deletedRow = { ...oldRow, id: 2, fecha: '2026-07-01' };
  const storage = writableStorageWith('[]');

  hideMonthlyExpense(deletedRow, storage);

  expect(currentMonthlyExpenseRows([oldRow], 'credito', storage)).toEqual([]);
});

test('crear nuevamente el gasto mensual lo devuelve al selector', () => {
  const row = { id: 3, concepto: 'gastos_recurrentes', metodoPago: 'debito', moneda: 'PEN', tarjeta: 'bcp', notas: 'Internet', fecha: '2026-08-01' };
  const storage = writableStorageWith(JSON.stringify([monthlyExpenseKey(row)]));

  restoreMonthlyExpense(row, storage);

  expect(currentMonthlyExpenseRows([row], 'debito', storage)).toEqual([row]);
});

test('no reconstruye mensuales antiguos que ya no tienen programación en el servidor', () => {
  const removed = { id: 4, concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', monto: 49.9, tarjeta: 'visa', notas: 'Streaming', fecha: '2025-01-01' };

  expect(currentMonthlyExpenseRows([removed], 'credito', storageWith('[]'), [])).toEqual([]);
});

test('mantiene un gasto mensual cuando su programación continúa activa', () => {
  const active = { id: 5, concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', monto: 49.9, tarjeta: 'visa', notas: 'Streaming', fecha: '2026-08-01' };
  const schedules = [{ tipo: 'recurrente', concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', monto: '49.90', tarjeta: 'visa', active: true }];

  expect(hasActiveMonthlySchedule(active, schedules)).toBe(true);
  expect(currentMonthlyExpenseRows([active], 'credito', storageWith('[]'), schedules)).toEqual([active]);
});

test('una programación huérfana no recupera un pago histórico anterior', () => {
  const oldRow = { id: 6, concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', monto: 49.9, tarjeta: 'visa', notas: 'Streaming', fecha: '2026-06-01' };
  const orphanSchedule = [{ tipo: 'recurrente', concepto: 'gastos_recurrentes', metodoPago: 'credito', moneda: 'PEN', monto: '49.90', tarjeta: 'visa', active: true, lastDate: '2026-07-01' }];

  expect(currentMonthlyExpenseRows([oldRow], 'credito', storageWith('[]'), orphanSchedule)).toEqual([]);
});
