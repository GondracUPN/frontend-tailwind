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

const shortText = (value, maxLength = 56) => {
  const firstPart = clean(value).split(',')[0].replace(/\s+/g, ' ');
  if (firstPart.length <= maxLength) return firstPart;
  const words = firstPart.slice(0, maxLength + 1).split(' ');
  if (words.length > 1) words.pop();
  return words.join(' ') || firstPart.slice(0, maxLength);
};

export const formatProfitProductName = (product = {}) => {
  const detail = product.detalle || {};
  const type = clean(product.tipo);
  const typeKey = type.toLowerCase().replace(/\s+/g, '');

  if (typeKey.includes('applewatch') || typeKey === 'watch') {
    const model = formatAppleWatchModel(detail);
    const size = clean(detail.tamano ?? detail.tamanio ?? detail['tama\u00f1o']).replace(/\s*mm$/i, 'mm');
    const sizeLabel = /^\d+(?:[.,]\d+)?$/.test(size) ? `${size}mm` : size;
    const connection = clean(detail.conexion ?? detail.conectividad).replace(/\s*\+\s*/g, '+');
    return ['A Watch', model, sizeLabel, connection].filter(Boolean).join(' ');
  }

  if (typeKey.includes('airpods')) {
    const model = clean(detail.modelo || detail.descripcionOtro || type);
    const match = model.match(/\bAirPods(?:\s+(?:Pro|Max))?(?:\s+\d+)?\b/i);
    return match ? `Apple ${match[0]}` : shortText(model);
  }

  if (typeKey.includes('ipad')) {
    const size = clean(detail.tamano ?? detail.tamanio ?? detail['tama\u00f1o']);
    const connection = clean(detail.conexion ?? detail.conectividad);
    return shortText(['iPad', detail.generacion, size ? `${size}"` : '', connection].filter(Boolean).join(' '));
  }

  if (typeKey === 'otro' || typeKey === 'otros' || typeKey === 'accesorios') {
    return shortText(detail.descripcionOtro || detail.modelo || type);
  }

  return shortText([type, detail.gama, detail.procesador, detail.tamano || detail.tamanio || detail['tama\u00f1o']].filter(Boolean).join(' '));
};
