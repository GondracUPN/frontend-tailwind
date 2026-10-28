// La identificación de modelos Apple (Axxxx, códigos de pedido, identificadores) vive en el backend:
// GET /apple-catalog/identify. Las reglas estáticas previas se migraron al dataset complementario
// (backend/src/apple-catalog/data/apple-specs.dataset.ts) con procedencia `project_rules`.

export const calculateShippingWeight = (productWeightKg) => {
  const weight = Number(productWeightKg);
  return Number.isFinite(weight) && weight > 0 ? Math.ceil(weight) + 1 : null;
};

export const describeAppleModelMatch = (match) => {
  if (!match) return '';
  const size = match.tamano ? (match.tipo === 'watch' ? match.tamano : `${match.tamano}″`) : '';
  const config = [match.ram && `${match.ram} GB`, match.almacenamiento].filter(Boolean).join(' / ');
  return [match.title, size, config, match.conexion].filter(Boolean).join(' · ');
};
