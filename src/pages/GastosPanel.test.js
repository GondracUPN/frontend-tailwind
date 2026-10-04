jest.mock('pdfjs-dist/webpack', () => ({ getDocument: jest.fn() }));

import { buildCreditExpensesText, receivedIncomeAmount } from './GastosPanel';

test('cuenta solo los depósitos x500 recibidos en el saldo', () => {
  expect(receivedIncomeAmount({ monto: 5000, cantidad500: 8 })).toBe(4000);
  expect(receivedIncomeAmount({ monto: 5000 })).toBe(5000);
  expect(receivedIncomeAmount({ monto: 5000, salePaymentType: 'debt', saleReceivedAmount: '0.00' })).toBe(0);
  expect(receivedIncomeAmount({ monto: 5000, salePaymentType: 'debt', saleReceivedAmount: '1200.00' })).toBe(1200);
  expect(receivedIncomeAmount({ monto: 5000, salePaymentType: 'direct', saleReceivedAmount: '5000.00' })).toBe(5000);
});

test('genera texto copiable de gastos de crédito con rango y totales por moneda', () => {
  const text = buildCreditExpensesText([
    { fecha: '2026-08-10', tarjeta: 'bcp_visa', concepto: 'inversion', notas: 'MacBook', moneda: 'USD', monto: 500, metodoPago: 'credito' },
    { fecha: '2026-08-12', tarjeta: 'io', concepto: 'comida', notas: 'Almuerzo', moneda: 'PEN', monto: 40, metodoPago: 'credito' },
    { fecha: '2026-08-13', tarjeta: 'io', concepto: 'cashback', notas: 'Devolución', moneda: 'PEN', monto: 5, metodoPago: 'credito' },
  ], {
    from: '2026-08-10',
    to: '2026-08-13',
    conceptLabel: (value) => value.toUpperCase(),
  });

  expect(text).toContain('Periodo: 10/08/2026 al 13/08/2026');
  expect(text).toContain('BCP Visa | INVERSION | MacBook | + $ 500.00');
  expect(text).toContain('IO | CASHBACK | Devolución | - S/ 5.00');
  expect(text).toContain('Total PEN: S/ 35.00');
  expect(text).toContain('Total USD: $ 500.00');
  expect(text).toContain('Movimientos: 3');
});
