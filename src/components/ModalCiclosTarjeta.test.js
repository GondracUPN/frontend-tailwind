import { buildAllocatedCycles } from './ModalCiclosTarjeta';

describe('ModalCiclosTarjeta', () => {
  it('aplica la devolucion al ciclo correspondiente a su propia fecha', () => {
    const rows = [
      {
        id: 1,
        concepto: 'gusto',
        metodoPago: 'credito',
        moneda: 'USD',
        monto: '100.00',
        fecha: '2026-01-30',
        tarjeta: 'bcp_visa',
      },
      {
        id: 2,
        concepto: 'gusto',
        metodoPago: 'credito',
        moneda: 'USD',
        monto: '80.00',
        fecha: '2026-03-01',
        tarjeta: 'bcp_visa',
      },
      {
        id: 3,
        concepto: 'cashback',
        metodoPago: 'credito',
        moneda: 'USD',
        monto: '-30.00',
        fecha: '2026-03-10',
        tarjeta: 'bcp_visa',
      },
    ];

    const cycles = buildAllocatedCycles({
      rows,
      creditRows: rows,
      cardKeys: ['bcp_visa'],
      selectedYear: 2026,
      selectedMonth: 4,
    });
    const previousCycle = cycles.get('bcp_visa:2026-03');
    const refundCycle = cycles.get('bcp_visa:2026-04');

    // El ciclo de abril abarca 2026-02-26 a 2026-03-25: 80 - 30 = USD 50.
    expect(refundCycle.totals.usd).toBe(50);
    expect(refundCycle.usedPen).toBe(185);
    expect(refundCycle.pendingUsdAmount).toBe(50);
    // La devolucion cuenta como movimiento del ciclo, junto con el consumo.
    expect(refundCycle.items).toHaveLength(2);
    // No aparece como pago: el ciclo no tiene pagos de tarjeta registrados.
    expect(refundCycle.paidUsdAmount).toBe(0);
    // El consumo del ciclo anterior conserva toda su deuda.
    expect(previousCycle.totals.usd).toBe(100);
    expect(previousCycle.pendingUsdAmount).toBe(100);
  });

  it('mantiene las devoluciones de IO como abono a la deuda pendiente', () => {
    const rows = [
      {
        id: 1,
        concepto: 'gusto',
        metodoPago: 'credito',
        moneda: 'USD',
        monto: '100.00',
        fecha: '2026-01-27',
        tarjeta: 'io',
      },
      {
        id: 2,
        concepto: 'cashback',
        metodoPago: 'credito',
        moneda: 'USD',
        monto: '-30.00',
        fecha: '2026-03-01',
        tarjeta: 'io',
      },
    ];

    const cycles = buildAllocatedCycles({
      rows,
      creditRows: rows,
      cardKeys: ['io'],
      selectedYear: 2026,
      selectedMonth: 4,
    });
    const previousCycle = cycles.get('io:2026-03');
    const dateCycle = cycles.get('io:2026-04');

    expect(previousCycle.totals.usd).toBe(100);
    expect(previousCycle.paidUsdAmount).toBe(30);
    expect(previousCycle.pendingUsdAmount).toBe(70);
    expect(dateCycle.totals.usd).toBe(0);
    expect(dateCycle.items).toHaveLength(0);
  });
});
