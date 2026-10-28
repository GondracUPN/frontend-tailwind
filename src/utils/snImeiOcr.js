// Adaptador compartido por los dos escáneres (Productos e Inventario). El reconocimiento de serial/IMEI
// ocurre una sola vez en el backend (/ocr/vision → identifier-recognizer.ts); aquí solo se normaliza la
// respuesta, se decide qué puede autocompletarse según las reglas del modelo y se protegen valores ya escritos.

export const OCR_FIELDS = { serial: 'Serial', imei: 'IMEI 1', imei2: 'IMEI 2' };
// Holgura sobre el plazo total del backend (OCR_TOTAL_TIMEOUT_MS, 25 s por defecto).
export const OCR_REQUEST_TIMEOUT_MS = 45_000;
// Igual que el mínimo de OcrCropDto en el backend (fracción de ancho/alto de la imagen).
export const OCR_MIN_CROP_FRACTION = 0.005;

const list = (value) => (Array.isArray(value) ? value : []);
const str = (value) => String(value ?? '').trim();

const normalizeCandidate = (candidate) => ({
  id: str(candidate?.id) || `${candidate?.kind}:${candidate?.value}`,
  kind: candidate?.kind === 'imei' ? 'imei' : 'serial',
  value: str(candidate?.value),
  rawValue: str(candidate?.rawValue ?? candidate?.value),
  label: candidate?.label || null,
  slot: candidate?.slot === 'imei1' || candidate?.slot === 'imei2' ? candidate.slot : null,
  component: ['case', 'left', 'right'].includes(candidate?.component) ? candidate.component : null,
  labelEvidence: candidate?.labelEvidence || 'none',
  confidence: Number(candidate?.confidence) || 0,
  confidenceSource: candidate?.confidenceSource || 'heuristic',
  validation: candidate?.validation || { status: 'review' },
  warnings: list(candidate?.warnings),
  sourcePass: candidate?.sourcePass || '',
  sourcePasses: list(candidate?.sourcePasses),
  boundingBox: candidate?.boundingBox || null,
  corrections: list(candidate?.corrections),
  autofill: Boolean(candidate?.autofill),
});

/** Normaliza la respuesta de /ocr/vision. Mantiene los campos antiguos (serial, imei1, imei2, serials, imeis). */
export default function parseSnImeiIds(result) {
  const source = result && typeof result === 'object' ? result : { text: String(result || '') };
  const candidates = list(source.candidates).map(normalizeCandidate).filter((candidate) => candidate.value);
  return {
    text: String(source.text || ''),
    candidates,
    conflicts: list(source.conflicts),
    serial: str(source.serial),
    imei1: str(source.imei1),
    imei2: str(source.imei2),
    serials: list(source.serials).map(str).filter(Boolean),
    imeis: list(source.imeis).map(str).filter(Boolean),
    calls: Number(source.calls) || 0,
    budget: source.budget || null,
    requestToken: source.requestToken || null,
  };
}

/** Misma semántica que `fieldVisible` de Inventario: sin reglas del backend, todo campo es aplicable. */
export const isFieldApplicable = (reglas, field) => (reglas ? Boolean(reglas[field]?.visible) : true);

export const preferredField = (candidate) => {
  if (candidate.kind === 'serial') return 'serial';
  if (candidate.slot === 'imei2') return 'imei2';
  if (candidate.slot === 'imei1') return 'imei';
  return null;
};

export const candidateTargets = (candidate, reglas) =>
  (candidate.kind === 'serial' ? ['serial'] : ['imei', 'imei2']).filter((field) => isFieldApplicable(reglas, field));

/** Rellena solo campos aplicables y vacíos con candidatos etiquetados y validados. Nunca pisa un valor escrito. */
export function planAutofill(parsed, values, reglas) {
  const patch = {};
  const kept = [];
  const notApplicable = [];
  for (const candidate of parsed.candidates.filter((item) => item.autofill)) {
    const field = preferredField(candidate);
    if (!field) continue;
    if (!isFieldApplicable(reglas, field)) {
      notApplicable.push({ field, value: candidate.value });
      continue;
    }
    const current = str(values?.[field]);
    if (current && current !== candidate.value) kept.push({ field, current, proposed: candidate.value });
    else if (!current && !patch[field]) patch[field] = candidate.value;
  }
  return { patch, kept, notApplicable };
}

/** Asignación manual («Usar como …»): devuelve un parche o un conflicto que el usuario debe confirmar. */
export function assignCandidate(values, field, value) {
  const proposed = str(value);
  if (!proposed) return { patch: null, conflict: null };
  const current = str(values?.[field]);
  const other = field === 'imei' ? 'imei2' : field === 'imei2' ? 'imei' : null;
  if (other && str(values?.[other]) === proposed) {
    return { patch: null, conflict: { type: 'duplicate', field, other, current, proposed } };
  }
  if (current && current !== proposed) return { patch: null, conflict: { type: 'replace', field, current, proposed } };
  return { patch: { [field]: proposed }, conflict: null };
}

/** Turnos de lectura: cada lectura nueva (o cambio de imagen/producto) invalida y aborta la anterior. */
export function createScanSession() {
  let sequence = 0;
  let controller = null;
  return {
    begin() {
      controller?.abort();
      sequence += 1;
      const mine = sequence;
      const own = new AbortController();
      controller = own;
      const token = `scan-${mine}-${Math.random().toString(36).slice(2, 10)}`;
      return {
        token,
        signal: own.signal,
        isCurrent: (result) => mine === sequence && !own.signal.aborted && (!result?.requestToken || result.requestToken === token),
      };
    },
    cancel() {
      controller?.abort();
      controller = null;
      sequence += 1;
    },
  };
}

/** Convierte una selección en coordenadas de pantalla a fracciones de la imagen original (ya orientada).
 * `fit: 'contain'` descuenta las bandas de object-fit: contain; `'fill'` asume que la imagen ocupa su caja. */
export function mapSelectionToImage(selection, rect, natural, fit = 'fill') {
  if (!rect?.width || !rect?.height || !natural?.width || !natural?.height) return null;
  let content = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  if (fit === 'contain') {
    const scale = Math.min(rect.width / natural.width, rect.height / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    content = { left: rect.left + (rect.width - width) / 2, top: rect.top + (rect.height - height) / 2, width, height };
  }
  const clampX = (value) => Math.max(0, Math.min(1, (value - content.left) / content.width));
  const clampY = (value) => Math.max(0, Math.min(1, (value - content.top) / content.height));
  const x1 = clampX(Math.min(selection.x1, selection.x2));
  const x2 = clampX(Math.max(selection.x1, selection.x2));
  const y1 = clampY(Math.min(selection.y1, selection.y2));
  const y2 = clampY(Math.max(selection.y1, selection.y2));
  const crop = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  if (crop.width * natural.width < 8 || crop.height * natural.height < 8) return null;
  if (crop.width < OCR_MIN_CROP_FRACTION || crop.height < OCR_MIN_CROP_FRACTION) return null;
  const round = (value) => Math.round(value * 10000) / 10000;
  return {
    x: round(crop.x),
    y: round(crop.y),
    width: round(crop.width),
    height: round(crop.height),
    pixels: {
      left: Math.round(crop.x * natural.width),
      top: Math.round(crop.y * natural.height),
      width: Math.round(crop.width * natural.width),
      height: Math.round(crop.height * natural.height),
    },
  };
}

const WARNING_TEXT = {
  luhn_invalid: 'Luhn inválido',
  ambiguous_characters: 'Caracteres O/0 o I/1 dudosos',
  alternative_reading: 'Lectura alternativa',
  corrected_characters: 'Caracteres corregidos',
  no_label: 'Sin etiqueta',
  column_pairing: 'Etiqueta en otra columna',
  letters_only: 'Solo letras',
  joined_tokens: 'Unido de dos fragmentos',
  slot_inferred: 'Posición deducida',
  slot_unknown: 'Posición desconocida',
  slot_conflict: 'Otro valor para la misma posición',
  same_value_both_slots: 'Mismo valor en IMEI 1 e IMEI 2',
  serial_conflict: 'Hay otro serial etiquetado',
};
export const warningText = (code) => WARNING_TEXT[code] || code;

export const candidateTitle = (candidate) => {
  if (candidate.kind === 'serial') {
    if (candidate.component === 'case') return 'Serial del estuche';
    if (candidate.component === 'left') return 'Serial auricular izquierdo';
    if (candidate.component === 'right') return 'Serial auricular derecho';
    return 'Serial';
  }
  if (candidate.slot === 'imei1') return 'IMEI 1';
  if (candidate.slot === 'imei2') return 'IMEI 2';
  return 'IMEI';
};
