jest.mock('pdfjs-dist/webpack', () => ({ getDocument: jest.fn() }));

import { buildCreditExpensesText, debitPendingBalance, groupAdvanceRows, receivedIncomeAmount } from './GastosPanel';

test('muestra solo el saldo faltante de deuda y x500 en Débito', () => {
  expect(debitPendingBalance({ salePaymentType: 'card', monto: 2200, saleReceivedAmount: 600 })).toEqual({ label: 'Deuda', amount: 1600 });
  expect(debitPendingBalance({ salePaymentType: 'debt', monto: 5200, cantidad500: 0, saleReceivedAmount: 0 })).toEqual({ label: 'x500', amount: 5200 });
  expect(debitPendingBalance({ monto: 4100, cantidad500: 8 })).toEqual({ label: 'x500', amount: 100 });
  expect(debitPendingBalance({ monto: 250, concepto: 'ingreso' })).toBeNull();
});

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

test('muestra una reserva con varios pagos como una sola venta con lo cobrado y la deuda', () => {
  const pago = (id, index, fecha, monto) => ({ id, fecha, monto, concepto: 'ingreso', tarjeta: 'bcp', notas: `__SALE_ADVANCE__:20:${index}`, saleSku: 'MS-498', salePaymentType: 'direct', saleReceivedAmount: monto });
  const otro = { id: 9, fecha: '2026-10-05', monto: 50, concepto: 'ingreso', notas: null };
  const rows = [pago(3, 2, '2026-10-12', 300), otro, pago(2, 1, '2026-10-03', 200), pago(1, 0, '2026-10-01', 500)];
  const grouped = groupAdvanceRows(rows, {}, [{ id: 'advance-20', pending: 800 }]);
  expect(grouped.map((row) => row.id)).toEqual(['advance-20', 9]);
  expect(grouped[0]).toMatchObject({ fecha: '2026-10-12', saleSku: 'MS-498', __advanceGroup: { adelantoId: 20, received: 1000, pending: 800, open: true } });

  // Ya vendida: entra también el cobro del saldo y la deuda sale de la tarjeta pendiente.
  const cierre = { id: 4, fecha: '2026-10-15', monto: 1800, concepto: 'ingreso', tarjeta: 'interbank', notas: '__SALE_INCOME__:498:77:card', saleId: 77, saleSku: 'MS-498', salePaymentType: 'card', saleReceivedAmount: 1000 };
  const vendida = groupAdvanceRows([cierre, ...rows.map((row) => (row.notas ? { ...row, saleId: 77 } : row))], {}, []);
  expect(vendida).toHaveLength(2);
  expect(vendida[0]).toMatchObject({ saleId: 77, tarjeta: 'Varias', __advanceGroup: { received: 2000, pending: 800, open: false, collectRow: expect.objectContaining({ id: 4 }) } });
});


test('una sola cuota visible usa el total confirmado y no declara pagada una venta incompleta', () => {
  const rows = [{ id: 1, monto: 700, tarjeta: 'bcp', notas: '__SALE_ADVANCE__:10:0', concepto: 'ingreso' }];
  const summary = { precio: 2600, cobrado: 2600, falta: 0, estado: 'vendido', ventaId: 405, producto: { codigo: 'MS-279', vendedor: 'Gonzalo' }, pagos: [{ banco: 'bcp' }] };
  expect(groupAdvanceRows(rows, { 10: summary })[0]).toMatchObject({ saleId: 405, __advanceGroup: { received: 2600, pending: 0, paid: true } });
  expect(groupAdvanceRows(rows, { 10: { ...summary, cobrado: 1950, falta: 650 } })[0].__advanceGroup).toMatchObject({ received: 1950, pending: 650, paid: false });
  expect(groupAdvanceRows(rows)[0].__advanceGroup).toMatchObject({ received: 700, paid: false, summaryKnown: false });
  expect(groupAdvanceRows(rows, { 10: { ...summary, producto: { vendedor: 'ambos' } } })[0].__advanceGroup).toMatchObject({ received: 1300, paid: true });
  expect(groupAdvanceRows(rows, { 10: { ...summary, estado: 'cancelado' } })[0].__advanceGroup.paid).toBe(false);
});


test('agrupa también el cierre histórico sin saleId sin duplicar el total', () => {
  const rows = [
    { id: 1, notas: '__SALE_ADVANCE__:10:0', monto: 700, concepto: 'ingreso', tarjeta: 'bcp' },
    { id: 2, notas: '__SALE_INCOME__:279:405:direct', monto: 650, concepto: 'ingreso', tarjeta: 'bcp', saleId: null },
  ];
  const details = { 10: { productoId: 279, ventaId: 405, precio: 2600, cobrado: 2600, falta: 0, estado: 'vendido', pagos: [{ banco: 'bcp' }] } };
  expect(groupAdvanceRows(rows, details)).toHaveLength(1);
  expect(groupAdvanceRows(rows, details)[0].__advanceGroup).toMatchObject({ received: 2600, paid: true });
});
