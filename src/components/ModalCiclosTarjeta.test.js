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

  it('envia una compra BCP hecha el dia de cierre a la facturacion siguiente', () => {
    const rows = [{
      id: 10,
      concepto: 'gusto',
      metodoPago: 'credito',
      moneda: 'PEN',
      monto: '120.00',
      fecha: '2026-07-24',
      tarjeta: 'bcp_visa',
    }];

    const cycles = buildAllocatedCycles({
      rows,
      creditRows: rows,
      cardKeys: ['bcp_visa'],
      selectedYear: 2026,
      selectedMonth: 9,
    });

    expect(cycles.get('bcp_visa:2026-08').totals.pen).toBe(0);
    expect(cycles.get('bcp_visa:2026-09').totals.pen).toBe(120);
  });

  it('distribuye una compra en cuotas entre las facturaciones siguientes', () => {
    const rows = [{
      id: 11,
      concepto: 'deuda_cuotas',
      cuotasMeses: 3,
      metodoPago: 'credito',
      moneda: 'USD',
      monto: '300.00',
      fecha: '2026-06-10',
      tarjeta: 'bcp_visa',
    }];

    const cycles = buildAllocatedCycles({
      rows,
      creditRows: rows,
      cardKeys: ['bcp_visa'],
      selectedYear: 2026,
      selectedMonth: 9,
    });

    expect(cycles.get('bcp_visa:2026-07').totals.usd).toBe(100);
    expect(cycles.get('bcp_visa:2026-08').totals.usd).toBe(100);
    expect(cycles.get('bcp_visa:2026-09').totals.usd).toBe(100);
    expect(cycles.get('bcp_visa:2026-07').items[0]).toMatchObject({ cuotaNumero: 1, cuotasMeses: 3, monto: 100 });
    expect(cycles.get('bcp_visa:2026-09').items[0]).toMatchObject({ cuotaNumero: 3, cuotasMeses: 3, monto: 100 });
  });

  it('carga en agosto solo la primera cuota de una compra BCP del 6 de julio', () => {
    const rows = [{
      id: 1183,
      concepto: 'deuda_cuotas',
      cuotasMeses: 6,
      metodoPago: 'credito',
      moneda: 'PEN',
      monto: '1530.00',
      fecha: '2026-07-06T05:00:00.000Z',
      tarjeta: 'bcp_visa',
    }];

    const cycles = buildAllocatedCycles({
      rows,
      creditRows: rows,
      cardKeys: ['bcp_visa'],
      selectedYear: 2026,
      selectedMonth: 8,
    });

    const august = cycles.get('bcp_visa:2026-08');
    expect(august.totals.pen).toBe(255);
    expect(august.items).toHaveLength(1);
    expect(august.items[0]).toMatchObject({ cuotaNumero: 1, cuotasMeses: 6, monto: 255 });
    expect(cycles.get('bcp_visa:2027-01').totals.pen).toBe(255);
  });
});
