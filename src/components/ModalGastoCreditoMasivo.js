import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import CloseX from './CloseX';
import { createExpenseWithDuplicateCheck, ExpenseDuplicateCancelledError } from '../utils/createExpense';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist/webpack';

const CREDIT_CONCEPTS = [
  'comida',
  'gusto',
  'inversion',
  'pago_envios',
  'deuda_cuotas',
  'gastos_recurrentes',
  'desgravamen',
  'transporte',
  'reinicio',
  'cashback',
];
const DEBIT_BANKS = [
  { value: 'bcp', label: 'BCP' },
  { value: 'interbank', label: 'Interbank' },
  { value: 'bbva', label: 'BBVA' },
];

const CONCEPT_ALIASES = {
  comida: 'comida',
  gusto: 'gusto',
  inversion: 'inversion',
  'pago envios': 'pago_envios',
  pago_envios: 'pago_envios',
  'deuda en cuotas': 'deuda_cuotas',
  deuda_cuotas: 'deuda_cuotas',
  deuda_en_cuotas: 'deuda_cuotas',
  'gastos mensuales': 'gastos_recurrentes',
  gastos_recurrentes: 'gastos_recurrentes',
  desgravamen: 'desgravamen',
  transporte: 'transporte',
  reinicio: 'reinicio',
  cashback: 'cashback',
  'cashback reembolso': 'cashback',
  reembolso: 'cashback',
  devolucion: 'cashback',
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const isTransportExpenseDescription = (description) => {
  const text = normalizeText(description);
  return /\brides?\b/.test(text) || /\buber\b(?![\s*._-]*(?:eats|one)\b)/.test(text);
};

const classifyExpenseConcept = (description) => {
  const text = normalizeText(description);
  if (/reembolso|reembols|refund|devolucion/.test(text)) return 'cashback';
  if (/seguro\s+(?:de\s+)?desgravamen|\bdesgravamen\b/.test(text)) return 'desgravamen';
  if (/\bebay\b|sp\s*centex\s*luxury\s*goods/.test(text)) return 'inversion';
  if (/alignet|alinet|eshopex/.test(text)) return 'pago_envios';
  if (/amazon\s*prime/.test(text)) return 'gastos_recurrentes';
  if (isTransportExpenseDescription(text)) return 'transporte';
  if (/evaristo|\bpvea\b|plaza\s*vea|\btambo\b|\blisto\b|\bmetro\b|mcdonalds|mc\s*donald'?s|\boxxo\b|\bkfc\b|burger\s*king|pizza\s*hut|\bsubway\b|starbucks|dunkin|popeyes|\brappi\b|pedidos\s*ya|pedidosya|uber\s*eats|didi\s*food/.test(text)) return 'comida';
  return 'gusto';
};

const toConceptApi = (raw) => {
  const key = normalizeText(raw);
  const mapped = CONCEPT_ALIASES[key] || key.replace(/\s+/g, '_');
  return CREDIT_CONCEPTS.includes(mapped) ? mapped : null;
};

const toMoneda = (raw) => {
  const key = normalizeText(raw).replace(/\./g, '');
  if (['pen', 'sol', 'soles', 's/', 's'].includes(key) || /\bpen\b|\bsoles?\b|s\//.test(key)) return 'PEN';
  if (['usd', 'dolar', 'dolares', '$', 'us$'].includes(key) || /\busd\b|\bdolares?\b|us\$/.test(key)) return 'USD';
  return null;
};

const toAmount = (raw) => {
  let s = String(raw || '').trim().replace(/\s+/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/,/g, '');
  } else if (s.includes(',') && !s.includes('.')) {
    s = s.replace(/,/g, '.');
  }
  const n = Number(s);
  if (!isFinite(n) || n <= 0) return null;
  return n;
};

const toSignedAmount = (raw) => {
  let value = String(raw ?? '').trim().replace(/\s+/g, '');
  if (!value) return null;
  const parenthesized = /^\(.*\)$/.test(value);
  const trailingMinus = /-$/.test(value);
  value = value.replace(/[()]/g, '').replace(/[^\d,.-]/g, '');
  value = value.replace(/-$/, '');
  if (value.includes(',') && value.includes('.')) value = value.replace(/,/g, '');
  else if (value.includes(',')) value = value.replace(',', '.');
  const number = Number(value);
  if (!Number.isFinite(number) || number === 0) return null;
  return parenthesized || trailingMinus ? -Math.abs(number) : number;
};

const isPaymentMovement = (description) => /\bpagos?\b|\bpago[_ -]?tarjeta\b|\bpag\.?\s*tarj\w*\b|\bpagtc\b/.test(normalizeText(description));
const isPaymentOrBalanceMovement = (description) => isPaymentMovement(description) || /\bexceso\b|sdo\.?\s*acre|saldo\s+acre/i.test(normalizeText(description));
const isRefundMovement = (description) => /reembolso|refund|devolucion|\bdev\.?\s*(?:compra|consumo|tarjeta)\b/.test(normalizeText(description));

const matrixToBulkLines = (matrix, mode = 'credito') => {
  const headerIndex = (matrix || []).findIndex((row) => {
    const headers = (row || []).map(normalizeText);
    return headers.some((header) => header.includes('fecha'))
      && headers.some((header) => /monto|importe|total|soles|dolares|\bpen\b|\busd\b/.test(header));
  });
  if (headerIndex < 0) return null;

  const headers = (matrix[headerIndex] || []).map(normalizeText);
  const findColumn = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const dateIndex = findColumn('fecha');
  const penAmountIndex = headers.findIndex((header) => /^(?:s\/|pen|soles?)$/.test(header)
    || (/(?:monto|importe|total)/.test(header) && /(?:\bpen\b|soles?|s\/)/.test(header)));
  const usdAmountIndex = headers.findIndex((header) => /^(?:us\$|usd|dolares?|\$)$/.test(header)
    || (/(?:monto|importe|total)/.test(header) && /(?:\busd\b|dolares?|us\$)/.test(header)));
  const amountIndex = headers.findIndex((header, index) => index !== penAmountIndex && index !== usdAmountIndex && /monto|importe|total/.test(header));
  const currencyIndex = findColumn('moneda');
  const conceptIndex = findColumn('concepto', 'categoria');
  const noteIndex = findColumn('nota', 'descripcion', 'detalle', 'comercio');
  if (dateIndex < 0 || (amountIndex < 0 && penAmountIndex < 0 && usdAmountIndex < 0)) return null;

  const entries = matrix.slice(headerIndex + 1).flatMap((row) => {
    const noteText = noteIndex >= 0 ? String(row?.[noteIndex] || '') : '';
    const note = (mode === 'debito' && conceptIndex >= 0
      ? `${String(row?.[conceptIndex] || '')} ${noteText}`.trim()
      : noteText).replace(/\|/g, '/');
    const currencyAmounts = [
      penAmountIndex >= 0 ? { index: penAmountIndex, currency: 'PEN' } : null,
      usdAmountIndex >= 0 ? { index: usdAmountIndex, currency: 'USD' } : null,
    ].filter(Boolean).map(({ index, currency }) => {
      const rawAmount = String(row?.[index] ?? '');
      return { row, rawAmount, note, signedAmount: toSignedAmount(rawAmount), explicitCurrency: currency };
    }).filter((entry) => entry.signedAmount);
    if (currencyAmounts.length) return currencyAmounts;
    const rawAmount = String(row?.[amountIndex] ?? '');
    return [{ row, rawAmount, note, signedAmount: toSignedAmount(rawAmount), explicitCurrency: null }];
  }).filter((entry) => entry.signedAmount && (mode === 'debito'
    ? isPaymentMovement(entry.note)
    : !isPaymentOrBalanceMovement(entry.note)));

  // Interbank exporta consumos negativos; otros extractos muestran consumos
  // positivos y pagos/excesos negativos. Tras retirar pagos, el signo que tenga
  // más movimientos representa los consumos del archivo.
  const negativeCount = entries.filter((entry) => entry.signedAmount < 0).length;
  const positiveCount = entries.filter((entry) => entry.signedAmount > 0).length;
  const expenseSign = negativeCount || positiveCount
    ? (negativeCount >= positiveCount ? -1 : 1)
    : 0;

  return entries.flatMap(({ row, rawAmount, note, signedAmount, explicitCurrency }) => {
    if (mode === 'debito') {
      const currency = explicitCurrency || (currencyIndex >= 0
        ? (toMoneda(row[currencyIndex]) || (/US\$|USD|\$/i.test(rawAmount) ? 'USD' : 'PEN'))
        : (/US\$|USD|\$/i.test(rawAmount) ? 'USD' : 'PEN'));
      return [`pago_tarjeta | ${currency} | ${Math.abs(signedAmount)} | ${excelDateToText(row[dateIndex])} | ${note}`];
    }
    const inferredConcept = classifyExpenseConcept(note);
    const isRefund = inferredConcept === 'cashback';
    if (!isRefund && Math.sign(signedAmount) !== expenseSign) return [];
    const currency = explicitCurrency || (currencyIndex >= 0
      ? (toMoneda(row[currencyIndex]) || (/US\$|USD|\$/i.test(rawAmount) ? 'USD' : 'PEN'))
      : (/US\$|USD|\$/i.test(rawAmount) ? 'USD' : 'PEN'));
    const concept = isRefund ? 'cashback' : (conceptIndex >= 0 && toConceptApi(row[conceptIndex]) ? row[conceptIndex] : inferredConcept);
    return [`${concept} | ${currency} | ${Math.abs(signedAmount)} | ${excelDateToText(row[dateIndex])} | ${note}`];
  });
};

export const spreadsheetToBulkLines = (data, fileName = '', mode = 'credito') => {
  // En CSV/TSV las fechas son texto dd/mm/yyyy. SheetJS puede convertir
  // 03/10/2026 a 10 de marzo si aplica su formato estadounidense.
  const isDelimitedText = /\.(?:csv|tsv)$/i.test(fileName);
  const workbook = XLSX.read(data, { type: 'array', cellDates: true, raw: isDelimitedText, ...(isDelimitedText ? { codepage: 65001 } : {}) });
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
  return matrixToBulkLines(matrix, mode);
};

const PDF_MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

const statementDate = (day, monthText, year) => {
  const month = PDF_MONTHS[normalizeText(monthText).slice(0, 3)];
  return month ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` : '';
};

export const pdfLinesToBulkText = (lines, mode = 'credito') => {
  const allText = lines.join(' ');
  const detectedYear = allText.match(/\b(20\d{2})\b/)?.[1]
    || (allText.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/)?.[1] ? `20${allText.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/)[1]}` : String(new Date().getFullYear()));
  let pdfSection = '';
  return lines.flatMap((line) => {
    const normalizedLine = normalizeText(line);
    if (/^abonos$/.test(normalizedLine)) { pdfSection = 'credits'; return []; }
    if (/^consumos directos/.test(normalizedLine)) { pdfSection = 'purchases'; return []; }
    if (/^consumos en cuotas/.test(normalizedLine)) { pdfSection = 'installments'; return []; }
    if (/^resumen de movimientos|^plan de cuotas|^informacion sobre/.test(normalizedLine)) { pdfSection = ''; return []; }
    if (/\bAV\.|XX-XXXX|X{4,}|ESTADO\s+DE\s+CUENTA|PAG\s+\d+\s+DE\s+\d+/i.test(line)) return [];
    const bcp = line.match(/^\s*(\d{1,2})(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Set|Oct|Nov|Dic)\s+(\d{1,2})(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Set|Oct|Nov|Dic)\s+(.+?)\s+([\d,.]+)(-?)\s*(?:\[(PEN|USD)\])?\s*$/i);
    if (bcp) {
      const middle = bcp[5].trim();
      const operation = middle.match(/\b(CONSUMO|DEVOLUCI[OÓ]N|PAGO)\b/i)?.[1] || '';
      const isPayment = isPaymentMovement(middle) || /PAGO/i.test(operation);
      if (mode === 'debito' ? !isPayment : isPayment) return [];
      const isRefund = /DEVOLUCI/i.test(operation) || isRefundMovement(middle);
      const description = middle.replace(/\s+\b(CONSUMO|DEVOLUCI[OÓ]N)\b.*$/i, '').trim();
      // El marcador proviene de la columna visual real del PDF y tiene
      // prioridad. El código 840 queda solo como respaldo para PDFs antiguos.
      const currency = bcp[8]?.toUpperCase() || (/\b840\b/.test(middle) ? 'USD' : 'PEN');
      const date = statementDate(bcp[3], bcp[4], detectedYear);
      const amount = toAmount(bcp[6]);
      if (!date || !amount) return [];
      return [`${mode === 'debito' ? 'pago_tarjeta' : (isRefund ? 'cashback' : classifyExpenseConcept(description))} | ${currency} | ${amount} | ${date} | ${description.replace(/\|/g, '/')}${isRefund ? ' DEVOLUCION' : ''}`];
    }

    // iO: la moneda se obtiene de la posición de la cifra en la tabla y el
    // extractor la agrega como marcador. Los abonos (pagos y devoluciones) no
    // son consumos y se omiten completos.
    const io = line.match(/^\s*(\d{1,2})-(ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)\s+(.+?)\s+([\d,.]+)\s+\[(PEN|USD)\]\s*$/i);
    if (io) {
      const isPayment = isPaymentMovement(io[3]);
      const isRefund = isRefundMovement(io[3]);
      if (mode === 'debito' ? !isPayment : (isPayment || (pdfSection === 'credits' && !isRefund))) return [];
      if (mode === 'credito' && !['purchases', 'installments'].includes(pdfSection) && !isRefund) return [];
      const date = statementDate(io[1], io[2], detectedYear);
      const amount = toAmount(io[4]);
      if (!date || !amount) return [];
      const description = io[3].trim();
      return [`${mode === 'debito' ? 'pago_tarjeta' : (isRefund ? 'cashback' : classifyExpenseConcept(description))} | ${io[5].toUpperCase()} | ${amount} | ${date} | ${description.replace(/\|/g, '/')}`];
    }

    // Banco Falabella/CMR: dos fechas completas, detalle y monto. La palabra
    // Pago manda sobre el signo; así un pago negativo nunca se vuelve gasto.
    const falabella = line.match(/^\s*(\d{1,2}\/\d{1,2}\/20\d{2})\s+(\d{1,2}\/\d{1,2}\/20\d{2})\s+(.+?)\s+(-?[\d,.]+)\s*$/i);
    if (falabella) {
      const description = falabella[3].trim();
      if (mode === 'debito' ? !isPaymentMovement(description) : isPaymentOrBalanceMovement(description)) return [];
      const amount = toSignedAmount(falabella[4]);
      if (!amount) return [];
      const currency = /\[(?:USD|DOLARES?)\]|US\$|\bUSD\b/i.test(line) ? 'USD' : 'PEN';
      return [`${mode === 'debito' ? 'pago_tarjeta' : classifyExpenseConcept(description)} | ${currency} | ${Math.abs(amount)} | ${falabella[1]} | ${description.replace(/\|/g, '/')}`];
    }
    const dateMatch = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (!dateMatch) return [];
    const amountMatches = [...line.matchAll(/(?:US\$|USD|\$|S\/)\s*\(?-?\s*[\d.,]+\)?-?|\(?-\s*[\d.,]+\)?|\([\d.,]+\)/gi)];
    const amountToken = amountMatches.at(-1)?.[0];
    const signedAmount = toSignedAmount(amountToken);
    const visualCurrency = line.match(/\[(PEN|USD)\]\s*$/i)?.[1]?.toUpperCase();
    const description = line.replace(dateMatch[0], ' ').replace(amountToken || '', ' ').replace(/\[(?:PEN|USD)\]\s*$/i, '').replace(/\s+/g, ' ').trim();
    const isRefund = classifyExpenseConcept(description) === 'cashback';
    if (!signedAmount) return [];
    if (mode === 'debito' ? !isPaymentMovement(description) : isPaymentOrBalanceMovement(description)) return [];
    // Si conocemos la columna visual, el signo deja de ser una señal de
    // moneda o de tipo de movimiento. Algunos bancos muestran consumos en
    // positivo y otros en negativo.
    if (mode === 'credito' && !visualCurrency && !(signedAmount < 0) && !isRefund) return [];
    const date = `${String(dateMatch[1]).padStart(2, '0')}/${String(dateMatch[2]).padStart(2, '0')}/${dateMatch[3] || detectedYear}`;
    const currency = visualCurrency || (/US\$|USD|\$/i.test(amountToken || '') && !/S\//i.test(amountToken || '') ? 'USD' : 'PEN');
    return [`${mode === 'debito' ? 'pago_tarjeta' : classifyExpenseConcept(description)} | ${currency} | ${Math.abs(signedAmount)} | ${date} | ${description.replace(/\|/g, '/')}`];
  }).join('\n');
};

const extractPdfTextLines = async (file, password = '') => {
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), password: password || undefined }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const groups = new Map();
    content.items.forEach((item) => {
      const y = Math.round(Number(item.transform?.[5] || 0) / 3) * 3;
      if (!groups.has(y)) groups.set(y, []);
      groups.get(y).push({ x: Number(item.transform?.[4] || 0), text: String(item.str || '') });
    });
    const pageHasCurrencyColumns = content.items.some((item) => normalizeText(item.str) === 'soles')
      && content.items.some((item) => normalizeText(item.str) === 'dolares');
    const currencyHeaders = pageHasCurrencyColumns
      ? content.items.filter((item) => ['soles', 'dolares'].includes(normalizeText(item.str)))
        .map((item) => ({ currency: normalizeText(item.str) === 'dolares' ? 'USD' : 'PEN', x: Number(item.transform?.[4] || 0) }))
      : [];
    [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
      const ordered = items.sort((a, b) => a.x - b.x);
      let line = ordered.map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim();
      const looksLikeTransaction = /^\d{1,2}-?(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|SET|OCT|NOV|DIC)\b/i.test(line)
        || /^\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|20\d{2})\b/.test(line);
      if (currencyHeaders.length && looksLikeTransaction) {
        const amountItem = [...ordered].reverse().find((item) => /^[\d,.]+$/.test(item.text.trim()));
        if (amountItem) {
          const nearest = [...currencyHeaders].sort((a, b) => Math.abs(a.x - amountItem.x) - Math.abs(b.x - amountItem.x))[0];
          if (nearest) line += ` [${nearest.currency}]`;
        }
      }
      lines.push(line);
    });
  }
  return lines.filter(Boolean);
};

const toIsoDate = (raw) => {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (
    dt.getFullYear() !== yyyy ||
    dt.getMonth() + 1 !== mm ||
    dt.getDate() !== dd
  ) return null;
  return iso;
};

export const parseBulkRows = (text, mode = 'credito') => {
  let lines = String(text || '').split(/\r?\n/);
  // Excel/Sheets pega TSV, mientras Interbank entrega CSV. XLSX interpreta
  // correctamente comillas, comas internas y ambos delimitadores.
  if (!lines.some((line) => line.includes('|'))) {
    try {
      const pastedBook = XLSX.read(String(text || ''), { type: 'string', raw: true });
      const pastedMatrix = XLSX.utils.sheet_to_json(pastedBook.Sheets[pastedBook.SheetNames[0]], { header: 1, defval: '' });
      const converted = matrixToBulkLines(pastedMatrix, mode);
      if (converted) lines = converted;
    } catch {
      // El validador normal mostrará las líneas que no tengan un formato válido.
    }
  }
  const rows = [];
  const errors = [];

  lines.forEach((lineRaw, idx) => {
    const line = String(lineRaw || '').trim();
    if (!line) return;

    const parts = line.split('|').map((x) => String(x || '').trim());
    if (parts.length < 4 || parts.length > 5) {
      errors.push(`Linea ${idx + 1}: usa exactamente "concepto | moneda | monto | fecha | nota(opcional)".`);
      return;
    }

    const inputConcept = mode === 'debito'
      ? (isPaymentMovement(parts[0]) ? 'pago_tarjeta' : null)
      : toConceptApi(parts[0]);
    if (!inputConcept) {
      errors.push(`Linea ${idx + 1}: concepto invalido "${parts[0]}".`);
      return;
    }

    const moneda = toMoneda(parts[1]);
    if (!moneda) {
      errors.push(`Linea ${idx + 1}: moneda invalida "${parts[1]}". Usa PEN o USD.`);
      return;
    }

    const monto = toAmount(parts[2]);
    if (!monto) {
      errors.push(`Linea ${idx + 1}: monto invalido "${parts[2]}".`);
      return;
    }

    const fecha = toIsoDate(parts[3]);
    if (!fecha) {
      errors.push(`Linea ${idx + 1}: fecha invalida "${parts[3]}". Formato requerido: dd/mm/yyyy.`);
      return;
    }

    const notas = parts[4] ? parts[4].trim() : null;
    const concept = mode === 'debito' ? 'pago_tarjeta'
      : isRefundMovement(notas) ? 'cashback'
      : inputConcept !== 'cashback' && isTransportExpenseDescription(notas) ? 'transporte'
      : inputConcept;
    if (concept === 'gusto' && !notas) {
      errors.push(`Linea ${idx + 1}: para concepto "gusto" la nota es obligatoria.`);
      return;
    }

    rows.push({
      lineNumber: idx + 1,
      body: {
        concepto: concept,
        metodoPago: mode,
        moneda,
        monto,
        fecha,
        notas,
      },
    });
  });

  return { rows, errors };
};

const excelDateToText = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}/${value.getFullYear()}`;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
  }
  const raw = String(value || '').trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : raw;
};

const validExchangeRate = (value) => {
  if (value == null || String(value).trim() === '') return null;
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};
const money = (value) => Number(Number(value).toFixed(2));
const amountLabel = (currency, amount) => `${currency === 'USD' ? '$' : 'S/'} ${Number(amount).toFixed(2)}`;

export const debitPaymentBody = (body, exchangeRate) => {
  const rate = validExchangeRate(exchangeRate);
  if (!rate) return { ...body, pagoObjetivo: body.moneda };
  if (body.moneda === 'USD') return {
    ...body, moneda: 'PEN', monto: money(Number(body.monto) * rate),
    pagoObjetivo: 'USD', montoUsdAplicado: money(body.monto), tipoCambioDia: rate,
  };
  return {
    ...body, pagoObjetivo: 'USD', montoUsdAplicado: money(Number(body.monto) / rate), tipoCambioDia: rate,
  };
};

const matchingAmounts = (source, target, exchangeRate, mode) => {
  const sourceAmount = Math.abs(Number(source.monto));
  const targetAmount = Math.abs(Number(target.monto));
  if (normalizeText(source.moneda) === normalizeText(target.moneda)) return Math.abs(sourceAmount - targetAmount) < 0.005;
  if (mode !== 'debito') return false;
  const rate = validExchangeRate(exchangeRate) || validExchangeRate(target.tasaUsdPen);
  if (source.moneda === 'USD' && target.moneda === 'PEN') {
    const appliedUsd = validExchangeRate(target.montoUsdAplicado);
    return (appliedUsd != null && Math.abs(sourceAmount - appliedUsd) < 0.015)
      || (rate != null && Math.abs(money(sourceAmount * rate) - targetAmount) < 0.015);
  }
  if (source.moneda === 'PEN' && target.moneda === 'USD') {
    return rate != null && Math.abs(sourceAmount - money(targetAmount * rate)) < 0.015;
  }
  return false;
};

export const compareBulkExpenses = (importedRows, savedRows, card, mode = 'credito', bank = '', exchangeRates = {}) => {
  const imported = (importedRows || []).map((row) => ({ ...row.body, _lineNumber: row.lineNumber })).sort((a, b) =>
    String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.monto || 0) - Number(b.monto || 0));
  if (!imported.length) return null;
  const dates = imported.map((row) => row.fecha).filter(Boolean).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const dayValue = (value) => {
    const time = new Date(`${String(value || '').slice(0, 10)}T00:00:00Z`).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const oneDay = 24 * 60 * 60 * 1000;
  const candidateFrom = new Date(dayValue(from) - oneDay).toISOString().slice(0, 10);
  const candidateTo = new Date(dayValue(to) + oneDay).toISOString().slice(0, 10);
  const normalizedCard = normalizeText(card).replace(/[^a-z0-9]/g, '');
  const candidates = (savedRows || []).filter((row) => normalizeText(row.metodoPago) === mode
    && (mode !== 'debito' || normalizeText(row.concepto) === 'pago_tarjeta')
    && normalizeText(mode === 'debito' ? row.tarjetaPago : row.tarjeta).replace(/[^a-z0-9]/g, '') === normalizedCard
    && (mode !== 'debito' || !bank || normalizeText(row.tarjeta) === normalizeText(bank))
    && String(row.fecha || '').slice(0, 10) >= candidateFrom && String(row.fecha || '').slice(0, 10) <= candidateTo)
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.monto || 0) - Number(b.monto || 0));
  const used = new Set();
  const pairs = imported.map((source, sourceIndex) => {
    const matchingIndexes = candidates.map((target, candidateIndex) => ({ target, candidateIndex }))
      .filter(({ target, candidateIndex }) => !used.has(candidateIndex)
        && (source.concepto !== 'cashback' || normalizeText(target.concepto) === 'cashback')
        && matchingAmounts(source, target, exchangeRates[source._lineNumber], mode)
        && Math.abs(dayValue(target.fecha) - dayValue(source.fecha)) <= oneDay)
      .sort((a, b) => Math.abs(dayValue(a.target.fecha) - dayValue(source.fecha)) - Math.abs(dayValue(b.target.fecha) - dayValue(source.fecha)));
    const index = matchingIndexes[0]?.candidateIndex ?? -1;
    if (index >= 0) used.add(index);
    return { source, sourceIndex: source._lineNumber, target: index >= 0 ? candidates[index] : null };
  });
  const missing = pairs.filter((pair) => !pair.target).map((pair) => pair.source);
  const remaining = candidates.filter((_, index) => !used.has(index));
  const importedDates = [...new Set(imported.map((row) => row.fecha))].sort();
  const systemGroups = new Map(importedDates.map((date) => [date, []]));
  candidates.forEach((saved) => {
    const savedDate = String(saved.fecha || '').slice(0, 10);
    const anchorDate = importedDates.includes(savedDate)
      ? savedDate
      : importedDates.reduce((best, date) => Math.abs(dayValue(date) - dayValue(savedDate)) < Math.abs(dayValue(best) - dayValue(savedDate)) ? date : best, importedDates[0]);
    systemGroups.get(anchorDate).push(saved);
  });
  const allMatchedTargets = new Set(pairs.map((pair) => pair.target).filter(Boolean));
  const displayRows = [];
  importedDates.forEach((date) => {
    const datePairs = pairs.filter((pair) => pair.source.fecha === date);
    const groupRows = datePairs.map((pair) => ({ imported: pair.source, saved: pair.target, matched: Boolean(pair.target), sourceIndex: pair.sourceIndex }));
    (systemGroups.get(date) || []).filter((saved) => !allMatchedTargets.has(saved)).forEach((saved) => {
      const empty = groupRows.find((row) => !row.saved);
      if (empty) empty.saved = saved;
      else groupRows.push({ imported: null, saved, matched: false, sourceIndex: null });
    });
    displayRows.push(...groupRows);
  });
  return { from, to, totalImported: imported.length, matched: used.size, missing, pairs, displayRows, imported, candidates, onlyInSystem: remaining };
};

const CONCEPT_LABELS = {
  comida: 'Comida', gusto: 'Gusto', inversion: 'Inversión', pago_envios: 'Pago de envíos',
  deuda_cuotas: 'Deuda en cuotas', gastos_recurrentes: 'Gastos recurrentes', desgravamen: 'Desgravamen',
  transporte: 'Transporte', reinicio: 'Reinicio', cashback: 'Cashback / reembolso',
};

function ExpenseComparisonRows({ comparison, reviewed, setReviewed, conceptOverrides, setConceptOverrides, conceptOptions, mode, exchangeRates }) {
  return comparison.displayRows.map((displayRow, index) => {
    const { imported, saved, matched } = displayRow;
    const importedKey = `imported-${displayRow.sourceIndex ?? index}`;
    const hasManualReview = Object.prototype.hasOwnProperty.call(reviewed, importedKey);
    const checked = hasManualReview ? Boolean(reviewed[importedKey]) : matched;
    const acceptedMatch = matched && checked;
    const toggle = (key) => setReviewed((current) => ({
      ...current,
      [key]: !(Object.prototype.hasOwnProperty.call(current, key) ? current[key] : matched),
    }));
    return (
      <tr key={`manual-${index}-${saved?.id || 'none'}`} className="border-t border-gray-100 align-top">
        <td onClick={() => imported && toggle(importedKey)} className={`p-2 ${acceptedMatch ? 'bg-emerald-100' : imported ? 'cursor-pointer bg-white hover:bg-gray-50' : 'bg-white'}`}>
          {imported && <div className="flex items-start gap-2">
            <input aria-label={`Revisar gasto cargado ${index + 1}`} type="checkbox" checked={checked} onClick={(event) => event.stopPropagation()} onChange={(event) => setReviewed((current) => ({ ...current, [importedKey]: event.target.checked }))} className="mt-0.5" />
            <div className={`min-w-0 flex-1 ${acceptedMatch ? 'text-emerald-900' : checked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              <div className="font-medium">{imported.fecha} · {amountLabel(imported.moneda, imported.monto)}</div>
              {mode === 'debito' && validExchangeRate(exchangeRates[displayRow.sourceIndex]) && (
                <div className="text-xs">{imported.moneda === 'USD'
                  ? `Pagado: ${amountLabel('PEN', money(Number(imported.monto) * Number(exchangeRates[displayRow.sourceIndex])))}`
                  : `Aplicado: ${amountLabel('USD', money(Number(imported.monto) / Number(exchangeRates[displayRow.sourceIndex])))}`}</div>
              )}
              <div className={acceptedMatch ? 'text-emerald-700' : 'text-gray-500'}>{imported.notas || ''}</div>
              {!checked && imported.concepto !== 'cashback' && <select aria-label={`Tipo de gasto ${index + 1}`} value={conceptOverrides[displayRow.sourceIndex] || imported.concepto} onClick={(event) => event.stopPropagation()} onChange={(event) => setConceptOverrides((current) => ({ ...current, [displayRow.sourceIndex]: event.target.value }))} className="mt-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800">
                {conceptOptions.map((concept) => <option key={concept.value} value={concept.value}>{concept.label}</option>)}
              </select>}
            </div>
          </div>}
        </td>
        <td className={`border-l border-gray-100 p-2 ${acceptedMatch ? 'bg-emerald-100' : 'bg-white'}`}>
          {saved && <div className={acceptedMatch ? 'text-emerald-900' : 'text-indigo-800'}>
            <span className="font-medium">{String(saved.fecha).slice(0, 10)} · {amountLabel(saved.moneda, saved.monto)}</span>
            {mode === 'debito' && saved.moneda === 'PEN' && validExchangeRate(saved.tasaUsdPen) && validExchangeRate(saved.montoUsdAplicado) && (
              <span className="block text-xs">Aplicado: {amountLabel('USD', saved.montoUsdAplicado)} · TC {Number(saved.tasaUsdPen).toFixed(4)}</span>
            )}
            <span className={acceptedMatch ? 'block text-emerald-700' : 'block text-gray-500'}>{saved.notas || ''}</span>
          </div>}
        </td>
      </tr>
    );
  });
}

export default function ModalGastoCreditoMasivo({ userId, existingRows = [], expenseConcepts = [], mode = 'credito', onClose, onSaved }) {
  const [cards, setCards] = useState([]);
  const [systemRows, setSystemRows] = useState(existingRows);
  const [loadingCards, setLoadingCards] = useState(true);
  const [tarjeta, setTarjeta] = useState('');
  const [banco, setBanco] = useState('bcp');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [draggingFile, setDraggingFile] = useState(false);
  const [reviewed, setReviewed] = useState({});
  const [conceptOverrides, setConceptOverrides] = useState({});
  const [exchangeRates, setExchangeRates] = useState({});
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, []);
  const passwordStorageKey = `credit-statement-password:${userId || currentUser?.id || currentUser?.username || 'current'}`;
  const [pdfPassword, setPdfPassword] = useState(() => localStorage.getItem(passwordStorageKey) || '');
  const [showPdfPassword, setShowPdfPassword] = useState(false);

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';
  const conceptOptions = useMemo(() => {
    if (mode === 'debito') return [{ value: 'pago_tarjeta', label: 'Pago a tarjeta' }];
    const options = CREDIT_CONCEPTS.map((value) => ({ value, label: CONCEPT_LABELS[value] || value }));
    (Array.isArray(expenseConcepts) ? expenseConcepts : []).filter((item) => item?.appliesCredit !== false).forEach((item) => {
      const value = String(item?.value || '').trim();
      if (!value || options.some((option) => option.value === value)) return;
      options.push({ value, label: String(item?.label || value) });
    });
    return options;
  }, [expenseConcepts, mode]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const res = await fetch(`${API_URL}/cards${query}`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!alive) return;
        const arr = Array.isArray(data) ? data : [];
        setCards(arr);
        setTarjeta(arr[0]?.tipo || arr[0]?.type || '');
      } catch {
        if (alive) setCards([]);
      } finally {
        if (alive) setLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [userId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const token = localStorage.getItem('token');
        const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
        const isAdmin = currentUser?.role === 'admin';
        const query = isAdmin && userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const url = isAdmin ? `${API_URL}/gastos/all${query}` : `${API_URL}/gastos`;
        const response = await fetch(url, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        if (alive) setSystemRows(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setSystemRows(existingRows);
      }
    })();
    return () => { alive = false; };
  }, [userId, existingRows]);

  const preview = useMemo(() => parseBulkRows(bulkText, mode), [bulkText, mode]);
  const comparison = useMemo(() => compareBulkExpenses(preview.rows, systemRows, tarjeta, mode, banco, exchangeRates), [preview.rows, systemRows, tarjeta, mode, banco, exchangeRates]);

  const loadFile = async (file) => {
    if (!file) return;
    setError('');
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const value = pdfLinesToBulkText(await extractPdfTextLines(file, pdfPassword), mode);
        if (!value.trim()) throw new Error(mode === 'debito' ? 'No se encontraron pagos a tarjeta en el PDF.' : 'No se encontraron consumos ni devoluciones en el PDF.');
        setBulkText(value);
        setFileName(file.name);
        setReviewed({});
        setConceptOverrides({});
        setExchangeRates({});
        return;
      }
      const lines = spreadsheetToBulkLines(await file.arrayBuffer(), file.name, mode);
      if (!lines) throw new Error('Faltan las columnas Fecha y Monto/Importe.');
      if (!lines.length) throw new Error(mode === 'debito' ? 'No se encontraron pagos a tarjeta en el archivo.' : 'No se encontraron consumos ni devoluciones en el archivo.');
      setBulkText(lines.join('\n'));
      setFileName(file.name);
      setReviewed({});
      setConceptOverrides({});
      setExchangeRates({});
    } catch (loadError) {
      const passwordProblem = loadError?.name === 'PasswordException' || /password|contrase/i.test(loadError?.message || '');
      setError(passwordProblem
        ? 'No se pudo desbloquear el PDF. Revisa la contraseña guardada para esta persona e intenta subirlo otra vez.'
        : (loadError?.message || 'No se pudo leer el archivo XLSX o PDF.'));
    }
  };

  const loadWorkbook = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    loadFile(file);
  };

  const dropWorkbook = (event) => {
    event.preventDefault();
    setDraggingFile(false);
    loadFile(event.dataTransfer.files?.[0]);
  };

  const submitBulk = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setError('');
    setSuccessMsg('');

    if (!cards.length) return setError('No tienes tarjetas registradas.');
    if (!tarjeta) return setError('Selecciona una tarjeta.');

    const token = localStorage.getItem('token');
    if (!token) return setError('No hay sesion.');

    const parsed = parseBulkRows(bulkText, mode);
    if (!parsed.rows.length) return setError('No hay lineas validas para guardar.');
    if (parsed.errors.length) {
      setError(parsed.errors.slice(0, 8).join('\n'));
      return;
    }
    const invalidRate = mode === 'debito' && parsed.rows.find((item) =>
      Object.prototype.hasOwnProperty.call(exchangeRates, item.lineNumber)
      && !validExchangeRate(exchangeRates[item.lineNumber]));
    if (invalidRate) return setError(`Linea ${invalidRate.lineNumber}: ingresa un tipo de cambio válido.`);
    const matchedLines = new Set((comparison?.pairs || [])
      .filter((pair) => pair.target && reviewed[`imported-${pair.source._lineNumber}`] !== false)
      .map((pair) => pair.source._lineNumber));
    const rowsToSave = parsed.rows.filter((item) => !matchedLines.has(item.lineNumber) && !reviewed[`imported-${item.lineNumber}`]);
    if (!rowsToSave.length) return setError('No hay gastos pendientes sin marcar para guardar.');

    setSaving(true);
    onClose?.();

    // Sigue guardando tras cerrar el modal. Cuatro workers reducen bastante el
    // tiempo de lotes grandes sin disparar demasiadas solicitudes simultáneas.
    void (async () => {
      const created = [];
      const failed = [];
      let nextIndex = 0;
      const worker = async () => {
        while (nextIndex < rowsToSave.length) {
          const item = rowsToSave[nextIndex++];
          const body = mode === 'debito'
            ? { ...debitPaymentBody(item.body, exchangeRates[item.lineNumber]), concepto: 'pago_tarjeta', tarjeta: banco, tarjetaPago: tarjeta }
            : { ...item.body, concepto: item.body.concepto === 'cashback' ? 'cashback' : (conceptOverrides[item.lineNumber] || item.body.concepto), tarjeta };
          try {
            const row = await createExpenseWithDuplicateCheck(body, { userId, notify: false });
            if (row) created.push(row);
          } catch (saveError) {
            if (saveError instanceof ExpenseDuplicateCancelledError) continue;
            failed.push(`Linea ${item.lineNumber}: ${saveError?.message || 'No se pudo guardar'}`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(4, rowsToSave.length) }, worker));
      onSaved?.(created, { failed });
    })().catch((saveError) => {
      console.error('[ModalGastoCreditoMasivo] save error:', saveError);
      onSaved?.([], { failed: ['No se pudo completar el guardado masivo.'] });
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-2">{mode === 'debito' ? 'Agregar pagos masivos (Débito)' : 'Agregar gastos masivos (Crédito)'}</h2>
        <p className="text-sm text-gray-600 mb-4">
          Patron por linea: <code>concepto | moneda | monto | fecha(dd/mm/yyyy) | nota(opcional)</code>.
          {mode === 'debito' ? ' Se importan solo movimientos de pago a tarjeta.' : ' Los pagos se omiten y las devoluciones se registran como cashback.'}
        </p>
        <div className="mb-4 max-w-md rounded-xl border border-gray-200 bg-gray-50 p-3">
          <label className="text-sm text-gray-700">
            <span className="mb-1 block font-medium">Contraseña de estados de cuenta de esta persona</span>
            <div className="flex gap-2">
              <input
                type={showPdfPassword ? 'text' : 'password'}
                autoComplete="off"
                value={pdfPassword}
                onChange={(event) => {
                  const value = event.target.value;
                  setPdfPassword(value);
                  if (value) localStorage.setItem(passwordStorageKey, value);
                  else localStorage.removeItem(passwordStorageKey);
                }}
                placeholder="Solo si el PDF está protegido"
                className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-3 py-2"
              />
              <button type="button" onClick={() => setShowPdfPassword((value) => !value)} className="rounded border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">
                {showPdfPassword ? 'Ocultar' : 'Ver / cambiar'}
              </button>
            </div>
          </label>
          <div className="mt-1 text-xs text-gray-500">Se guarda en este navegador por persona y puedes cambiarla cuando sea necesario.</div>
        </div>
        <div
          className={`mb-4 flex min-h-24 flex-wrap items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 transition-colors ${draggingFile ? 'border-blue-500 bg-blue-100' : 'border-blue-300 bg-blue-50'}`}
          onDragEnter={(event) => { event.preventDefault(); setDraggingFile(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDraggingFile(false); }}
          onDrop={dropWorkbook}
        >
          <label className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Subir o arrastrar XLSX/CSV/PDF
            <input type="file" accept=".xlsx,.xls,.csv,text/csv,.pdf,application/pdf" onChange={loadWorkbook} className="hidden" />
          </label>
          {fileName && <span className="text-sm text-gray-600">Archivo: {fileName}</span>}
        </div>

        {error && (
          <div className="mb-3 text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </div>
        )}
        {successMsg && (
          <div className="mb-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            {successMsg}
          </div>
        )}

        {loadingCards ? (
          <div className="text-sm text-gray-600 mb-3">Cargando tarjetas...</div>
        ) : !cards.length ? (
          <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
            No tienes tarjetas registradas. Agrega una desde el panel de tarjetas.
          </div>
        ) : null}

        <form className="grid gap-4" onSubmit={submitBulk}>
          {mode === 'debito' && <label className="text-sm max-w-sm">
            <span className="block text-gray-600 mb-1">Banco de débito desde el que se pagó</span>
            <select className="w-full border rounded px-3 py-2" value={banco} onChange={(event) => setBanco(event.target.value)}>
              {DEBIT_BANKS.map((bank) => <option key={bank.value} value={bank.value}>{bank.label}</option>)}
            </select>
          </label>}
          <label className="text-sm max-w-sm">
            <span className="block text-gray-600 mb-1">{mode === 'debito' ? 'Tarjeta pagada en todas las líneas' : 'Tarjeta para todas las líneas'}</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={tarjeta}
              onChange={(e) => setTarjeta(e.target.value)}
              disabled={!cards.length}
            >
              {cards.map((c) => (
                <option key={cardValue(c)} value={cardValue(c)}>{cardLabel(c)}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-2">
            <label className="text-sm text-gray-600">{mode === 'debito' ? 'Líneas de pagos' : 'Líneas de gastos'}</label>
            <textarea
              aria-label={mode === 'debito' ? 'Líneas de pagos' : 'Líneas de gastos'}
              className="w-full min-h-[220px] border rounded px-3 py-2 font-mono text-sm"
              value={bulkText}
              onChange={(e) => { setBulkText(e.target.value); setExchangeRates({}); }}
              placeholder=""
            />
            <div className="text-xs text-gray-500">
              Conceptos permitidos: {mode === 'debito' ? 'pago_tarjeta' : CREDIT_CONCEPTS.join(', ')}.
            </div>
          </div>

          {!!bulkText.trim() && (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="text-sm font-medium mb-2">Vista previa</div>
              <div className="text-xs text-gray-600 mb-2">
                Lineas validas: {preview.rows.length} | Errores: {preview.errors.length}
              </div>
              <div className="overflow-auto max-h-44">
                <table className="min-w-[680px] w-full text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="text-left py-1">Linea</th>
                      <th className="text-left py-1">Concepto</th>
                      <th className="text-left py-1">Moneda</th>
                      <th className="text-left py-1">Monto</th>
                      <th className="text-left py-1">Fecha</th>
                      <th className="text-left py-1">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={`preview-${r.lineNumber}`} className="border-t">
                        <td className="py-1">{r.lineNumber}</td>
                        <td className="py-1">{r.body.concepto}</td>
                        <td className="py-1">{r.body.moneda}</td>
                        <td className="py-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span>{amountLabel(r.body.moneda, r.body.monto)}</span>
                            {mode === 'debito' && <button type="button" aria-label={`Tipo de cambio línea ${r.lineNumber}`} onClick={() => setExchangeRates((current) => {
                              const next = { ...current };
                              if (Object.prototype.hasOwnProperty.call(next, r.lineNumber)) delete next[r.lineNumber];
                              else next[r.lineNumber] = '';
                              return next;
                            })} className="rounded border border-indigo-200 px-1.5 py-0.5 text-indigo-700 hover:bg-indigo-50">{Object.prototype.hasOwnProperty.call(exchangeRates, r.lineNumber) ? 'Quitar TC' : 'Poner TC'}</button>}
                          </div>
                          {mode === 'debito' && Object.prototype.hasOwnProperty.call(exchangeRates, r.lineNumber) && (
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <input aria-label={`Tipo de cambio para línea ${r.lineNumber}`} type="number" min="0.0001" step="0.0001" value={exchangeRates[r.lineNumber]} onChange={(event) => setExchangeRates((current) => ({ ...current, [r.lineNumber]: event.target.value }))} placeholder="S/ por $" className="w-24 rounded border px-1.5 py-1" />
                              {validExchangeRate(exchangeRates[r.lineNumber]) && <span>{r.body.moneda === 'USD'
                                ? `Pagado ${amountLabel('PEN', money(Number(r.body.monto) * Number(exchangeRates[r.lineNumber])))}`
                                : `Aplicado ${amountLabel('USD', money(Number(r.body.monto) / Number(exchangeRates[r.lineNumber])))}`}</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-1">{r.body.fecha}</td>
                        <td className="py-1">{r.body.notas || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {comparison && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <div className="font-semibold text-indigo-950">Comparación con {cardLabel(cards.find((card) => cardValue(card) === tarjeta)) || tarjeta}</div>
              <div className="mt-1 text-indigo-800">Periodo detectado: {comparison.from} al {comparison.to} · Coinciden por fecha y monto: {comparison.matched}/{comparison.totalImported} · Faltan en el sistema: {comparison.missing.length}</div>
              <div className="mt-3 overflow-x-auto rounded-lg border border-indigo-200 bg-white">
                <table className="min-w-[760px] w-full text-xs">
                  <thead className="bg-indigo-100 text-indigo-950"><tr><th className="w-1/2 p-2 text-left">Movimientos cargados ({comparison.imported.length})</th><th className="w-1/2 border-l border-indigo-200 p-2 text-left">Movimientos en el sistema ({comparison.candidates.length})</th></tr></thead>
                  <tbody><ExpenseComparisonRows comparison={comparison} reviewed={reviewed} setReviewed={setReviewed} conceptOverrides={conceptOverrides} setConceptOverrides={setConceptOverrides} conceptOptions={conceptOptions} mode={mode} exchangeRates={exchangeRates} /></tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={onClose}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !cards.length}
              className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? 'Guardando...' : 'Guardar masivo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
