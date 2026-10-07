import { buildExtraDebts } from './extraDebts';

test('agrupa venta mixta, descuenta cobros y conserva fechas', () => {
  const rows = [
    { id: 1, saleId: 9, saleSku: 'MS-9', concepto: 'ingreso', metodoPago: 'debito', salePaymentType: 'direct', monto: 300, saleReceivedAmount: 300, fecha: '2026-09-01' },
    { id: 2, saleId: 9, saleSku: 'MS-9', concepto: 'ingreso', metodoPago: 'debito', salePaymentType: 'card', monto: 500, saleReceivedAmount: 200, fecha: '2026-09-01', salePaymentHistory: [{ amount: 200, paidAt: '2026-09-04' }] },
    { id: 3, saleId: 9, saleSku: 'MS-9', concepto: 'ingreso', metodoPago: 'debito', salePaymentType: 'debt', monto: 500, saleReceivedAmount: 0, fecha: '2026-09-01' },
  ];
  const [debt] = buildExtraDebts(rows, [], 'gonzalo');
  expect(debt).toMatchObject({ title: 'MS-9', total: 1300, received: 500, pending: 800, startedAt: '2026-09-01' });
  expect(debt.history).toEqual(expect.arrayContaining([{ date: '2026-09-04', amount: 200, type: 'card' }]));
  expect(buildExtraDebts(rows.map((row) => ({ ...row, saleReceivedAmount: row.monto })), [], 'gonzalo')).toEqual([]);
});

test('muestra un adelanto activo y lo quita cuando se completa', () => {
  const advance = { id: 4, productoId: 20, producto: { vendedor: 'Gonzalo', codigoInventario: 77 }, montoVenta: 2000, montoAdelanto: 700, fechaAdelanto: '2026-09-01', cuotas: [{ fecha: '2026-09-01', monto: 500 }, { fecha: '2026-09-03', monto: 200 }] };
  const [debt] = buildExtraDebts([], [advance], 'gonzalo');
  expect(debt).toMatchObject({ total: 2000, received: 700, pending: 1300 });
  expect(debt.history).toHaveLength(2);
  expect(buildExtraDebts([], [{ ...advance, completadoAt: '2026-09-05' }], 'gonzalo')).toEqual([]);
});
