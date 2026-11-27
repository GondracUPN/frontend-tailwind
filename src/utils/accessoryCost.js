export const isSimpleAccessory = (lot) =>
  String(lot?.tipo).toLowerCase() === 'accesorios' && Boolean(lot?.soloInventario) && !lot?.referenciaId;

export const accessoryPurchaseTotal = (form, quantityKey) => form.totalCompra ??
  (Number(form.precioCompra || 0) * Number(form[quantityKey] || 1)).toFixed(2);

export function updateAccessoryPurchase(form, field, value, quantityKey) {
  const next = { ...form, [field]: value };
  if (field === 'precioCompra') next.totalCompra = null;
  if (field === 'totalCompra' || (field === quantityKey && next.totalCompra != null)) {
    next.precioCompra = next.totalCompra === '' ? '' : Number(next.totalCompra) / Math.max(1, Number(next[quantityKey]) || 1);
  }
  return next;
}

export function accessoryUnitCost(lot) {
  const value = lot?.valor;
  if (!value) return null;
  const rate = String(value.monedaCompra || 'USD').toUpperCase() === 'PEN' ? 1 : 3.7;
  const total = isSimpleAccessory(lot) && value.valorProducto != null
    ? Math.round((Number(value.valorProducto) * rate + Number(value.costoEnvioProrrateado ?? value.costoEnvio ?? 0)) * 100) / 100
    : value.costoTotalProrrateado ?? value.costoTotal ?? value.valorSoles;
  return total == null ? null : Number(total) / Math.max(1, Number(lot.stockInicial || 1));
}

export function accessoryPurchaseSummary(lots) {
  const lines = lots.map((lot) => ({
    quantity: Number(lot.stockInicial || 0), available: Number(lot.stockActual || 0), cost: accessoryUnitCost(lot),
  }));
  const quantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const available = lines.reduce((sum, line) => sum + line.available, 0);
  const total = lines.some((line) => line.cost == null) ? null : lines.reduce((sum, line) => sum + line.cost * line.quantity, 0);
  const availableCost = lines.some((line) => line.available > 0 && line.cost == null) ? null
    : lines.reduce((sum, line) => sum + (line.cost || 0) * line.available, 0);
  return {
    quantity, available, total,
    average: total == null || !quantity ? null : total / quantity,
    availableAverage: availableCost == null || !available ? null : availableCost / available,
  };
}
