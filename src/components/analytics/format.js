export function formatCurrency(value) {
  const n = Number(value || 0);
  return n.toLocaleString('es-PE', { style: 'currency', currency: 'PEN' });
}

export function formatPercent(value) {
  const n = Number(value || 0);
  return `${n.toFixed(2)}%`;
}
