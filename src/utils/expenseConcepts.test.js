import { isCardRefundExpense, visibleExpenseNotes } from './expenseConcepts';

test('reconoce el reembolso a tarjeta y oculta su nota técnica', () => {
  expect(isCardRefundExpense({ notas: '__REFUND__:1:2' })).toBe(true);
  expect(isCardRefundExpense({ notas: '__REFUND__:1' })).toBe(true);
  expect(isCardRefundExpense({ notas: '__REFUND__:VENTA:5:9' })).toBe(false);
  expect(isCardRefundExpense({ notas: 'Devolución tienda' })).toBe(false);
  expect(visibleExpenseNotes('__REFUND__:1:2')).toBe('-');
  expect(visibleExpenseNotes('Compra en tienda')).toBe('Compra en tienda');
});
