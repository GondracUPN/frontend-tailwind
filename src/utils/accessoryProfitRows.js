// Agrega únicamente las salidas del rango; nunca el costo completo del inventario.
export function accessoryProfitRows(sales, nameForProduct) {
  const groups = new Map();
  for (const sale of sales) {
    const name = nameForProduct(sale.producto) || 'Accesorio';
    if (!groups.has(name)) groups.set(name, { id: `accessory-${name}`, name, units: 0, cost: 0, revenue: 0, sales: [], pendingCount: 0 });
    const group = groups.get(name);
    const share = Number(sale.__share ?? 1);
    group.units += Math.max(0, Number(sale.cantidad || 1) - Number(sale.cantidadDevuelta || 0));
    if (sale.costoPendiente) group.pendingCount += 1;
    else group.cost += Number(sale.costoVendido ?? (Number(sale.precioVenta || 0) - Number(sale.ganancia || 0))) * share;
    group.revenue += (Number(sale.precioVenta || 0) - Number(sale.precioDevuelto || 0)) * share;
    group.sales.push(sale);
  }
  return [...groups.values()].map((group) => ({ ...group, profit: group.pendingCount ? null : group.revenue - group.cost,
    percentage: group.pendingCount ? null : group.cost > 0 ? (group.revenue - group.cost) / group.cost * 100 : 0 }));
}
