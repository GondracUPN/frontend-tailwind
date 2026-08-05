const MONTHS_ES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const stripMarkup = (value) => String(value || '')
  .replace(/\*\*([^*\n]+)\*\*/g, '$1')
  .replace(/\[[^\]]*\]\([^)]*\)/g, (match) => match.replace(/^\[|\]\([^)]*\)$/g, ''))
  .replace(/\u00a0/g, ' ')
  .replace(/\r/g, '');

const fold = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

export function parseBankAmount(raw) {
  const value = String(raw || '').replace(/\s/g, '');
  if (!value) return null;
  let normalized = value;
  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');
  if (lastComma > lastDot) normalized = value.replace(/\./g, '').replace(',', '.');
  else normalized = value.replace(/,/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function cardTypeFromProduct(productName) {
  const value = fold(productName);
  if (value.includes('io de bcp') || value === 'io') return 'io';
  if (value.includes('qore')) return 'visa_qore';
  if (value.includes('sapphire')) return 'bcp_visa';
  if (value.includes('amex') || value.includes('american express')) return 'bcp_amex';
  if (value.includes('visa')) return 'bcp_visa';
  return '';
}

function parseSpanishDate(text) {
  const match = text.match(/(\d{1,2})(?:\s+de)?\s+([a-záéíóúñ]+)(?:\s+de)?\s+(\d{4})/i);
  if (!match) return '';
  const month = MONTHS_ES[fold(match[2])];
  if (!month) return '';
  return `${match[3]}-${String(month).padStart(2, '0')}-${String(Number(match[1])).padStart(2, '0')}`;
}

export function parseBankOperation(input) {
  const text = stripMarkup(input);
  const normalized = fold(text);
  const isIoServicePayment = normalized.includes('io de bcp') && normalized.includes('pago dolares');

  if (isIoServicePayment) {
    const amount = parseBankAmount(text.match(/Monto\s+total\s*:\s*(?:US\$|USD|\$)\s*([\d.,]+)/i)?.[1]);
    const exchangeRate = parseBankAmount(text.match(/Tipo\s+de\s+cambio\s*:\s*S\/\s*([\d.,]+)/i)?.[1]);
    const chargedAmount = parseBankAmount(text.match(/Monto\s+transferido\s+al\s+cambio\s*:\s*S\/\s*([\d.,]+)/i)?.[1]);
    const date = parseSpanishDate(text);
    const sourceLast4 = text.match(/Cuenta\s+de\s+origen\s*:\s*[^\n]*(?:\n|\s)+(?:\*{2,}|X{2,})\s*(\d{4})/i)?.[1] || '';
    const missing = [];
    if (!amount) missing.push('monto en dólares');
    if (!chargedAmount) missing.push('monto cobrado en soles');
    if (!date) missing.push('fecha');
    if (missing.length) return { ok: false, error: `No se pudo reconocer: ${missing.join(', ')}.` };

    return {
      ok: true,
      operation: {
        kind: 'card_payment',
        amount,
        currency: 'USD',
        chargedAmount,
        chargedCurrency: 'PEN',
        exchangeRate,
        date,
        cardType: 'io',
        productName: 'IO DE BCP',
        cardLast4: '',
        sourceBank: 'bcp',
        sourceLast4,
        operationNumber: '',
      },
    };
  }

  if (!normalized.includes('pago a tu tarjeta') && !normalized.includes('pago de tarjeta propia')) {
    return { ok: false, error: 'Por ahora se reconoce el correo de pago de tarjeta propia BCP.' };
  }

  const amountMatch = text.match(/Monto\s+pagado\s+(?:S\/|US\$|USD|\$)\s*([\d.,]+)/i)
    || text.match(/pago\s+a\s+tu\s+tarjeta\s+de\s+(?:S\/|US\$|USD|\$)\s*([\d.,]+)/i);
  const amount = parseBankAmount(amountMatch?.[1]);
  const currencyToken = amountMatch?.[0] || '';
  const currency = /US\$|USD|\$/i.test(currencyToken) && !/S\//i.test(currencyToken) ? 'USD' : 'PEN';
  const exchangeRate = parseBankAmount(text.match(/Tipo\s+de\s+cambio\s+S\/\s*([\d.,]+)/i)?.[1]);
  const chargedMatch = text.match(/Total\s+cobrado(?:\s+al\s+tipo\s+de\s+cambio)?\s+(S\/|US\$|USD|\$)\s*([\d.,]+)/i);
  const chargedAmount = parseBankAmount(chargedMatch?.[2]) || amount;
  const chargedCurrency = chargedMatch
    ? (/US\$|USD|\$/i.test(chargedMatch[1]) && !/S\//i.test(chargedMatch[1]) ? 'USD' : 'PEN')
    : currency;

  const paidToMatch = text.match(/Pagado\s+a\s+([^\n]+)(?:\n|\s)+(?:\*{2,}|X{2,})\s*(\d{4})/i);
  const productName = paidToMatch?.[1]?.trim() || '';
  const cardLast4 = paidToMatch?.[2] || '';
  const cardType = cardTypeFromProduct(productName);
  const sourceLast4 = text.match(/Desde\s+[^\n]+(?:\n|\s)+(?:\*{2,}|X{2,})\s*(\d{4})/i)?.[1] || '';
  const operationNumber = text.match(/N[uú]mero\s+de\s+operaci[oó]n\s+(\d{5,})/i)?.[1]
    || text.match(/operaci[oó]n[^\d]{0,30}(\d{5,})/i)?.[1]
    || '';
  const date = parseSpanishDate(text);

  const missing = [];
  if (!amount) missing.push('monto');
  if (!date) missing.push('fecha');
  if (!cardType) missing.push('tarjeta destino');
  if (missing.length) {
    return { ok: false, error: `No se pudo reconocer: ${missing.join(', ')}.` };
  }

  return {
    ok: true,
    operation: {
      kind: 'card_payment',
      amount,
      currency,
      chargedAmount,
      chargedCurrency,
      exchangeRate,
      date,
      cardType,
      productName,
      cardLast4,
      sourceBank: 'bcp',
      sourceLast4,
      operationNumber,
    },
  };
}
