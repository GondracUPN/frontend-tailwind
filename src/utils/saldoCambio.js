/* global BigInt:readonly */
// Vista previa; el servidor vuelve a calcular con sus registros bajo bloqueo transaccional.
export function cambioSaldoAplicado(saldos, monto, fecha) {
  let pendiente = Math.round(Number(monto) * 100);
  if (!Number.isSafeInteger(pendiente) || pendiente <= 0) return null;
  const div = (n, d) => (n + d / BigInt(2)) / d;
  let pen = BigInt(0),
    usd = BigInt(0);
  const partes = [];
  const ordenados = [...saldos].sort(
    (a, b) =>
      Math.round(Number(a.disponible) * 100) - Math.round(Number(b.disponible) * 100) ||
      String(a.fecha).localeCompare(String(b.fecha)) ||
      Number(a.id) - Number(b.id),
  );
  for (const s of ordenados) {
    if (String(s.fecha) > fecha || pendiente <= 0) continue;
    const cents = Math.min(pendiente, Math.round(Number(s.disponible) * 100));
    if (cents <= 0) continue;
    const rate = Math.round(Number(s.tipo_cambio) * 10000);
    if (!Number.isSafeInteger(rate) || rate <= 0) return null;
    pen += BigInt(cents);
    usd += div(BigInt(cents) * BigInt(100000000), BigInt(rate));
    partes.push({
      saldoId: s.id,
      sku: s.sku,
      monto: cents / 100,
      tipoCambio: Number(s.tipo_cambio),
    });
    pendiente -= cents;
  }
  if (pendiente || !usd) return null;
  return {
    tipoCambio: Number(div(pen * BigInt(100000000), usd)) / 10000,
    equivalenteUsd: Number(usd) / 1000000,
    partes,
  };
}
