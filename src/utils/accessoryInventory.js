const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const dates = (values) => values.map((value) => String(value || '').slice(0, 10)).filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value)).sort();

export const accessoryCodeQuery = (value) => normalize(value).match(/^acc[\s_-]*(\d+)$/)?.[1];

export const accessoryPackaging = { con_caja: 'Con caja', sin_caja: 'Sin caja', sin_indicar: 'Sin indicar' };

export function accessoryMergeKey(lot) {
  const identity = (value) => String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  const model = identity(lot.referencia?.modelo || lot.detalle?.modelo);
  if (!model || !['con_caja', 'sin_caja'].includes(lot.empaqueAccesorio)) return null;
  return JSON.stringify([lot.empaqueAccesorio, String(lot.vendedor ?? '').trim().toLowerCase(), identity(lot.estado), lot.referenciaId ?? null,
    model, identity(lot.referencia?.variante || lot.detalle?.descripcionOtro)]);
}

export function matchesAccessoryQuery(query, lots, description) {
  const needle = normalize(query);
  const code = accessoryCodeQuery(needle) || needle.match(/^(\d+)$/)?.[1];
  if (code) return lots.some((lot) => Number(lot.codigoInventario || lot.id) === Number(code) || Number(lot.id) === Number(code));
  return normalize(description).includes(needle);
}

export function accessoryInventoryDates({ producto, ficha }) {
  const tracking = producto.tracking || [];
  const arrival = dates(tracking.map((row) => row.fechaRecogido || (
    normalize(row.estado) === 'recogido' ? row.createdAt : null
  ))).at(-1);
  const added = dates([ficha?.createdAt])[0] || dates(tracking.map((row) => row.createdAt))[0];
  return {
    date: arrival || added || '',
    label: arrival ? 'Llegó' : 'Agregado',
  };
}

export function compareAccessoryDates(a, b, oldest = false) {
  if (!a || !b) return Number(Boolean(b)) - Number(Boolean(a));
  return oldest ? a.localeCompare(b) : b.localeCompare(a);
}
