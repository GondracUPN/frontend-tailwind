const normalizeText = (value) => String(value || '').replace(/[|]/g, 'I').replace(/\r/g, '\n');
const onlyDigits = (value) => String(value || '').replace(/\D+/g, '');
const cleanSerial = (value) => String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const normalizeOcrDigits = (value) => String(value || '')
  .replace(/[OoQqDd]/g, '0')
  .replace(/[Il|!]/g, '1')
  .replace(/[Zz]/g, '2')
  .replace(/[Ss]/g, '5')
  .replace(/[Gg]/g, '6')
  .replace(/[Bb]/g, '8')
  .replace(/\D+/g, '');

const isValidImei = (value) => {
  const digits = onlyDigits(value);
  if (digits.length !== 15) return false;
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
};

const extractImeis = (text) => {
  const source = normalizeText(text);
  const found = [];
  const chars = '[0-9OoQqDdIl|!ZzSsGgBb\\s.:-]';
  const labelled = new RegExp(`\\b(?:IMEI|1MEI|IME1|MEID)(?:\\s*[12])?(?:\\s*\\/\\s*MEID)?\\b[\\s:;#-]*(${chars}{15,34})`, 'gi');
  let match;
  while ((match = labelled.exec(source))) {
    const digits = normalizeOcrDigits(match[1]).slice(0, 15);
    if (digits.length === 15) found.push(digits);
  }

  const labelledLine = /(?:\b(?:IMEI|1MEI|IME1|MEID)\b[^\n]{0,60})/gi;
  while ((match = labelledLine.exec(source))) {
    const digits = normalizeOcrDigits(match[0]).slice(-15);
    if (digits.length === 15) found.push(digits);
  }

  const loose = /\b\d(?:[\s.:-]*\d){14}\b/g;
  while ((match = loose.exec(source))) {
    const digits = onlyDigits(match[0]);
    if (digits.length === 15) found.push(digits);
  }

  const valid = unique(found.filter(isValidImei));
  return valid.length ? valid : unique(found);
};

const SERIAL_LABEL = /\b(?:S\/N|S\s*\/\s*N|SN|SERIAL(?:\s+NUMBER)?|SERIAL\s+NO\.?|SERIE|NO\.\s*SERIE|NUMERO\s+DE\s+SERIE|NRO\s+SERIE)\b/i;
const STOP_WORDS = new Set([
  'APPLE', 'CALIFORNIA', 'DESIGNED', 'ASSEMBLED', 'CHINA', 'MODEL', 'MODELO',
  'NUMBER', 'SERIAL', 'SERIE', 'IMEI', 'MEID', 'ICCID', 'MACBOOK', 'IPHONE',
  'IPAD', 'WATCH', 'ORIGINAL', 'COLOR', 'CAPACITY',
]);

const serialScore = (candidate, contextScore = 0) => {
  const value = cleanSerial(candidate);
  if (value.length < 10 || value.length > 12 || /^\d+$/.test(value)) return 0;
  if (!/[A-Z]/.test(value) || !/\d/.test(value) || STOP_WORDS.has(value)) return 0;
  if (Array.from(STOP_WORDS).some((word) => word.length > 4 && value.includes(word))) return 0;
  return contextScore + 12 - (/[IOQ]/.test(value) ? 1 : 0);
};

const extractSerials = (text, imeis) => {
  const source = normalizeText(text);
  const blocked = new Set(imeis);
  const scored = new Map();
  const add = (candidate, score) => {
    const value = cleanSerial(candidate);
    if (blocked.has(value) || /^\d{15}$/.test(value)) return;
    const finalScore = serialScore(value, score);
    if (finalScore) scored.set(value, Math.max(scored.get(value) || 0, finalScore));
  };
  const addContext = (context, score) => {
    const afterLabel = String(context || '').toUpperCase().replace(SERIAL_LABEL, ' ');
    const tokens = afterLabel.match(/\b[A-Z0-9][A-Z0-9-]{8,16}\b/g) || [];
    tokens.forEach((token) => add(token, score));
  };

  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  lines.forEach((line, index) => {
    if (!SERIAL_LABEL.test(line)) return;
    addContext(line, 14);
    if (lines[index + 1]) addContext(lines[index + 1], 10);
    if (lines[index + 2]) addContext(lines[index + 2], 8);
  });

  const direct = /\b(?:S\/N|S\s*\/\s*N|SN|SERIAL(?:\s+NUMBER)?|SERIAL\s+NO\.?|SERIE|NO\.\s*SERIE|NUMERO\s+DE\s+SERIE|NRO\s+SERIE)\b[\s:;#-]*([A-Z0-9][A-Z0-9\s-]{9,22})/gi;
  let match;
  while ((match = direct.exec(source))) addContext(match[1], 16);

  const standalone = /\b[A-Z0-9]{10,12}\b/gi;
  while ((match = standalone.exec(source))) add(match[0], 2);

  return Array.from(scored.entries())
    .sort((left, right) => right[1] - left[1])
    .map(([value]) => value)
    .slice(0, 10);
};

export default function parseSnImeiIds(text) {
  const imeis = extractImeis(text);
  const serials = extractSerials(text, imeis);
  return {
    serial: serials[0] || '',
    imei1: imeis[0] || '',
    imei2: imeis[1] || '',
    serials,
    imeis,
  };
}
