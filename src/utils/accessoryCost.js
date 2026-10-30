export const isSimpleAccessory = (lot) =>
  String(lot?.tipo).toLowerCase() === 'accesorios' && Boolean(lot?.soloInventario) && !lot?.referenciaId;

export function accessoryUnitCost(lot) {
  const value = lot?.valor;
  if (!value) return null;
  const rate = String(value.monedaCompra || 'USD').toUpperCase() === 'PEN' ? 1 : 3.7;
  const total = isSimpleAccessory(lot) && value.valorProducto != null
    ? Math.round((Number(value.valorProducto) * rate + Number(value.costoEnvioProrrateado ?? value.costoEnvio ?? 0)) * 100) / 100
    : value.costoTotalProrrateado ?? value.costoTotal ?? value.valorSoles;
  return total == null ? null : Number(total) / Math.max(1, Number(lot.stockInicial || 1));
}
