const cents = (value) => Math.round(Number(value || 0) * 100);
const dateText = (value) => String(value || '').slice(0, 10);
const sellerShare = (seller, owner) => {
  const name = String(seller || '').toLowerCase();
  if (name === 'ambos') return 0.5;
  return owner && name.includes(owner) ? 1 : 0;
};

export function buildExtraDebts(rows = [], advances = [], owner = '') {
  const incomes = rows.filter((row) => row.concepto === 'ingreso' && row.metodoPago === 'debito');
  const groups = new Map();
  for (const row of incomes) {
    if (!row.saleId || !row.salePaymentType) continue;
    const key = `sale-${row.saleId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  const debts = [];
  for (const [key, group] of groups) {
    const total = group.reduce((sum, row) => sum + cents(row.monto), 0);
    const received = group.reduce((sum, row) => sum + cents(row.saleReceivedAmount), 0);
    if (total <= received) continue;
    const history = group.flatMap((row) => {
      const payments = Array.isArray(row.salePaymentHistory) ? row.salePaymentHistory : [];
      if (payments.length) return payments.map((payment) => ({ date: dateText(payment.paidAt), amount: Number(payment.amount), type: row.salePaymentType }));
      return cents(row.saleReceivedAmount) > 0 ? [{ date: dateText(row.salePaidAt || row.fecha), amount: Number(row.saleReceivedAmount), type: row.salePaymentType }] : [];
    }).sort((a, b) => a.date.localeCompare(b.date));
    debts.push({
      id: key, title: group[0].saleSku || `Venta #${group[0].saleId}`,
      total: total / 100, received: received / 100, pending: (total - received) / 100,
      startedAt: group.map((row) => dateText(row.fecha)).sort()[0], history,
      kinds: [...new Set(group.filter((row) => cents(row.monto) > cents(row.saleReceivedAmount)).map((row) => row.salePaymentType))],
      collectionRows: group.filter((row) => ['card', 'debt'].includes(row.salePaymentType) && cents(row.monto) > cents(row.saleReceivedAmount)),
    });
  }
  for (const advance of advances) {
    const share = sellerShare(advance.producto?.vendedor, owner);
    if (!share || advance.completadoAt) continue;
    const advanceRows = incomes.filter((row) => String(row.notas || '').startsWith(`__SALE_ADVANCE__:${advance.id}:`));
    const total = cents(Number(advance.montoVenta) * share);
    const cuotas = Array.isArray(advance.cuotas) && advance.cuotas.length
      ? advance.cuotas : [{ fecha: advance.fechaAdelanto, monto: Number(advance.montoAdelanto) }];
    const unmatchedDirect = cuotas.flatMap((cuota, index) =>
      cuota.tipoPago !== 'card' && !advanceRows.some((row) => String(row.notas || '').endsWith(`:${index}`))
        ? [{ date: dateText(cuota.fecha), amount: Number(cuota.monto) * share, type: 'direct' }]
        : []);
    const received = advanceRows.reduce((sum, row) => sum + cents(row.saleReceivedAmount), 0)
      + unmatchedDirect.reduce((sum, payment) => sum + cents(payment.amount), 0);
    if (total <= received) continue;
    const history = [
      ...advanceRows.flatMap((row) => {
        const payments = Array.isArray(row.salePaymentHistory) ? row.salePaymentHistory : [];
        if (payments.length) return payments.map((payment) => ({ date: dateText(payment.paidAt), amount: Number(payment.amount), type: row.salePaymentType }));
        return cents(row.saleReceivedAmount) > 0 ? [{ date: dateText(row.salePaidAt || row.fecha), amount: Number(row.saleReceivedAmount), type: row.salePaymentType }] : [];
      }),
      ...unmatchedDirect,
    ];
    debts.push({
      id: `advance-${advance.id}`, title: `Adelanto · ${advance.producto?.codigoInventario || advance.productoId}`,
      total: total / 100, received: received / 100, pending: (total - received) / 100,
      startedAt: dateText(advance.fechaAdelanto), history: history.sort((a, b) => a.date.localeCompare(b.date)),
      kinds: ['advance'], collectionRows: advanceRows.filter((row) => row.salePaymentType === 'card' && cents(row.monto) > cents(row.saleReceivedAmount)),
    });
  }
  for (const row of incomes) {
    if (row.saleId || String(row.notas || '').startsWith('__SALE_ADVANCE__:') || !Number(row.cantidad500)) continue;
    const total = cents(row.monto);
    const received = Number(row.cantidad500) * 50000;
    if (total <= received) continue;
    debts.push({ id: `legacy-${row.id}`, title: row.saleSku || row.notas || `Ingreso #${row.id}`,
      total: total / 100, received: received / 100, pending: (total - received) / 100,
      startedAt: dateText(row.fecha), history: [{ date: dateText(row.fecha), amount: received / 100, type: 'debt' }],
      kinds: ['debt'], collectionRows: [] });
  }
  return debts.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
