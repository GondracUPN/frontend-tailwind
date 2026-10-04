export const getPending500 = (monto, cantidad500, partialReceived = 0) => {
  const totalCents = Math.round((Number(monto) || 0) * 100);
  const receivedCents = (Number(cantidad500) || 0) * 50000 + Math.round((Number(partialReceived) || 0) * 100);
  const pendingCents = Math.max(0, totalCents - receivedCents);
  return {
    amount: pendingCents / 100,
    fullTransfers: Math.floor(pendingCents / 50000),
    transfers: Math.ceil(pendingCents / 50000),
    lastAmount: pendingCents ? ((pendingCents - 1) % 50000 + 1) / 100 : 0,
  };
};

export const formatPending500 = (pending) => {
  if (!pending.transfers) return 'Sin transferencias pendientes';
  if (pending.lastAmount === 500) {
    return `Faltan ${pending.fullTransfers} transferencias de S/ 500 · Última: S/ 500.00`;
  }
  const last = `1 última transferencia de S/ ${pending.lastAmount.toFixed(2)}`;
  return pending.fullTransfers
    ? `Faltan ${pending.fullTransfers} transferencias de S/ 500 + ${last}`
    : `Falta ${last}`;
};
