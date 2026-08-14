const clean = (value) => String(value ?? '').trim();

const canonicalWatchLine = (value) => {
  const raw = clean(value).replace(/^apple\s+watch\s*/i, '').trim();
  if (/^normal$/i.test(raw)) return 'Series';
  if (/^series(?:\s|$)/i.test(raw)) return raw.replace(/^series/i, 'Series');
  if (/^se(?:\s|$)/i.test(raw)) return raw.replace(/^se/i, 'SE');
  if (/^ultra(?:\s|$)/i.test(raw)) return raw.replace(/^ultra/i, 'Ultra');
  return raw;
};

export const formatAppleWatchModel = (detalle = {}) => {
  const rawLine = detalle.gama || detalle.linea || detalle.tipoWatch || detalle.modelo;
  const line = canonicalWatchLine(rawLine);
  const generation = canonicalWatchLine(detalle.generacion || detalle.serie);

  if (/^(Series|SE|Ultra)(?:\s|$)/i.test(generation)) return generation;
  if (line && generation && line.toLowerCase().endsWith(` ${generation.toLowerCase()}`)) return line;
  if (line) return generation ? `${line} ${generation}` : line;
  if (generation) return /^\d+$/.test(generation) ? `Series ${generation}` : generation;
  return '';
};

export const formatAppleWatchName = (detalle = {}) => {
  const model = formatAppleWatchModel(detalle);

  const rawSize = clean(detalle.tamano ?? detalle.tamanio ?? detalle['tama\u00f1o']);
  const size = /^\d+(?:[.,]\d+)?$/.test(rawSize) ? `${rawSize} mm` : rawSize;
  const connection = clean(detalle.conexion ?? detalle.conectividad);

  return ['Apple Watch', model, size, connection].map(clean).filter(Boolean).join(' ');
};
