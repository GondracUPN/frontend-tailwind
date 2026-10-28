// Match the sale's selected lot followed by FIFO consumption in the backend.
export const accessoryLotAvailable = (lot) => Number(lot?.stockActual || 0) > 0 &&
  !(lot?.referenciaId && lot.origen === 'accesorio_importado' && !(lot.tracking || []).some((row) => row.fechaRecogido || String(row.estado).toLowerCase() === 'recogido'));

export function accessoryLotDate(lot) {
  const purchase = lot.valor?.fechaCompra ? new Date(lot.valor.fechaCompra).getTime() : NaN;
  if (Number.isFinite(purchase)) return purchase;
  const pickups = (lot.tracking || [])
    .map((row) => row.fechaRecogido || (String(row.estado || '').toLowerCase() === 'recogido' ? row.createdAt : null))
    .filter(Boolean).map((date) => new Date(date).getTime()).filter(Number.isFinite);
  return pickups.length ? Math.min(...pickups) : Number(lot.id || 0);
}

export function consumedAccessoryLots(lots, firstId, quantity) {
  const ordered = [...lots].sort((a, b) =>
    accessoryLotDate(a) - accessoryLotDate(b) || Number(a.id) - Number(b.id));
  const first = ordered.findIndex((lot) => String(lot.id) === String(firstId));
  if (first >= 0) ordered.unshift(ordered.splice(first, 1)[0]);
  let remaining = Math.max(1, Number(quantity) || 1);
  return ordered.flatMap((lot) => {
    const taken = Math.min(remaining, Math.max(0, Number(lot.stockActual || 0)));
    remaining -= taken;
    return taken > 0 ? [{ lot, quantity: taken }] : [];
  });
}

export function accessoryMonthlyProfit(sales) {
  const months = new Map();
  sales.forEach((sale) => {
    const month = String(sale.fechaVenta || sale.createdAt || '').slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    months.set(month, (months.get(month) || 0) + Number(sale.ganancia || 0) * Number(sale.__share ?? 1));
  });
  return [...months].sort(([a], [b]) => b.localeCompare(a));
}
