// Visibilidad comercial de especificaciones en tarjetas, títulos y detalles (matriz del catálogo Apple).
// La RAM solo es dato comercial en Mac; en iPhone/iPad/Watch/AirPods no se muestra aunque exista guardada.
const RAM_FAMILIES = new Set(['macbook', 'imac', 'macmini', 'otro']);

export const showsRam = (tipo) => RAM_FAMILIES.has(String(tipo || '').trim().toLowerCase());

/** Tamaño legible según familia: caja en mm para Watch, pulgadas para pantallas. */
export const formatSize = (tipo, value) => {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const type = String(tipo || '').trim().toLowerCase();
  if (type === 'watch') return /mm$/i.test(raw) ? raw : `${raw} mm`;
  if (type === 'macmini' || type === 'iphone' || type === 'airpods') return '';
  return /["”″]$/.test(raw) ? raw : `${raw}″`;
};

/** Especificaciones comerciales en orden para listados y detalles. */
export const commercialSpecs = (tipo, detalle = {}) => {
  const d = detalle || {};
  return [
    d.gama,
    d.generacion,
    d.procesador,
    formatSize(tipo, d.tamano || d.tamanio),
    d.almacenamiento,
    showsRam(tipo) ? d.ram : '',
    d.conexion,
  ].map((value) => String(value ?? '').trim()).filter(Boolean);
};
