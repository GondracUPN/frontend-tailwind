import {
  currentMonthlyExpenseRows,
  monthlyExpenseKey,
  readHiddenMonthlyExpenseKeys,
} from './monthlyExpenses';

const storageWith = (value) => ({ getItem: jest.fn(() => value) });

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
