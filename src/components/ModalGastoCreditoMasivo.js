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
};

const normalizeText = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const classifyExpenseConcept = (description) => {
  const text = normalizeText(description);
  if (/reembolso|reembols|refund|devolucion/.test(text)) return 'cashback';
  if (/\bebay\b|sp\s*centex\s*luxury\s*goods/.test(text)) return 'inversion';
  if (/alignet|alignet|alinet/.test(text)) return 'pago_envios';
  if (/amazon\s*prime/.test(text)) return 'gastos_recurrentes';
  if (/evaristo|\bpvea\b|plaza\s*vea|\btambo\b|\blisto\b|\bmetro\b/.test(text)) return 'comida';
  return 'gusto';
};

const toConceptApi = (raw) => {
  const key = normalizeText(raw);
  const mapped = CONCEPT_ALIASES[key] || key.replace(/\s+/g, '_');
  return CREDIT_CONCEPTS.includes(mapped) ? mapped : null;
};

const toMoneda = (raw) => {
  const key = normalizeText(raw).replace(/\./g, '');
  if (['pen', 'sol', 'soles', 's/', 's'].includes(key)) return 'PEN';
  if (['usd', 'dolar', 'dolares', '$'].includes(key)) return 'USD';
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

const PDF_MONTHS = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

const statementDate = (day, monthText, year) => {
  const month = PDF_MONTHS[normalizeText(monthText).slice(0, 3)];
  return month ? `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}` : '';
};

export const pdfLinesToBulkText = (lines) => {
  const allText = lines.join(' ');
  const detectedYear = allText.match(/\b(20\d{2})\b/)?.[1]
    || (allText.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/)?.[1] ? `20${allText.match(/\b\d{1,2}\/\d{1,2}\/(\d{2})\b/)[1]}` : String(new Date().getFullYear()));
  return lines.flatMap((line) => {
    if (/\bAV\.|XX-XXXX|X{4,}|ESTADO\s+DE\s+CUENTA|PAG\s+\d+\s+DE\s+\d+/i.test(line)) return [];
    const bcp = line.match(/^\s*(\d{1,2})(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Set|Oct|Nov|Dic)\s+(\d{1,2})(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Set|Oct|Nov|Dic)\s+(.+?)\s+([\d,.]+)(-?)\s*$/i);
    if (bcp) {
      const middle = bcp[5].trim();
      const operation = middle.match(/\b(CONSUMO|DEVOLUCI[OÓ]N|PAGO)\b/i)?.[1] || '';
      if (/PAGO/i.test(operation)) return [];
      const isRefund = /DEVOLUCI/i.test(operation);
      const description = middle.replace(/\s+\b(CONSUMO|DEVOLUCI[OÓ]N)\b.*$/i, '').trim();
      const currency = /\b840\b/.test(middle) ? 'USD' : 'PEN';
      const date = statementDate(bcp[3], bcp[4], detectedYear);
      const amount = toAmount(bcp[6]);
      if (!date || !amount) return [];
      return [`${isRefund ? 'cashback' : classifyExpenseConcept(description)} | ${currency} | ${amount} | ${date} | ${description.replace(/\|/g, '/')}${isRefund ? ' DEVOLUCION' : ''}`];
    }
    const dateMatch = line.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
    if (!dateMatch) return [];
    const amountMatches = [...line.matchAll(/(?:US\$|USD|\$|S\/)\s*\(?-?\s*[\d.,]+\)?-?|\(?-\s*[\d.,]+\)?|\([\d.,]+\)/gi)];
    const amountToken = amountMatches.at(-1)?.[0];
    const signedAmount = toSignedAmount(amountToken);
    const description = line.replace(dateMatch[0], ' ').replace(amountToken || '', ' ').replace(/\s+/g, ' ').trim();
    const isRefund = classifyExpenseConcept(description) === 'cashback';
    if (!(signedAmount < 0) && !isRefund) return [];
    if (!signedAmount) return [];
    const date = `${String(dateMatch[1]).padStart(2, '0')}/${String(dateMatch[2]).padStart(2, '0')}/${dateMatch[3] || detectedYear}`;
    const currency = /US\$|USD|\$/i.test(amountToken || '') && !/S\//i.test(amountToken || '') ? 'USD' : 'PEN';
    return [`${classifyExpenseConcept(description)} | ${currency} | ${Math.abs(signedAmount)} | ${date} | ${description.replace(/\|/g, '/')}`];
  }).join('\n');
};

const extractPdfTextLines = async (file) => {
  const document = await pdfjsLib.getDocument({ data: await file.arrayBuffer(), password: '75135395' }).promise;
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
    [...groups.entries()].sort((a, b) => b[0] - a[0]).forEach(([, items]) => {
      lines.push(items.sort((a, b) => a.x - b.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim());
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

export const parseBulkRows = (text) => {
  let lines = String(text || '').split(/\r?\n/);
  // Al pegar un rango desde Excel/Sheets llega separado por tabulaciones.
  // Si contiene encabezados comunes, lo convertimos al formato interno.
  if (!lines.some((line) => line.includes('|')) && lines.some((line) => line.includes('\t'))) {
    const matrix = lines.filter((line) => line.trim()).map((line) => line.split('\t'));
    const headers = (matrix[0] || []).map(normalizeText);
    const findColumn = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
    const dateIndex = findColumn('fecha');
    const amountIndex = findColumn('monto', 'importe', 'total');
    const currencyIndex = findColumn('moneda');
    const conceptIndex = findColumn('concepto', 'categoria');
    const noteIndex = findColumn('nota', 'descripcion', 'detalle', 'comercio');
    if (dateIndex >= 0 && amountIndex >= 0) {
      lines = matrix.slice(1).flatMap((row) => {
        const rawAmount = String(row[amountIndex] || '');
        const signedAmount = toSignedAmount(rawAmount);
        const note = noteIndex >= 0 ? String(row[noteIndex] || '').replace(/\|/g, '/') : '';
        const inferredConcept = classifyExpenseConcept(note);
        if (!(signedAmount < 0) && inferredConcept !== 'cashback') return [];
        if (!signedAmount) return [];
        const currency = currencyIndex >= 0 ? (toMoneda(row[currencyIndex]) || 'PEN') : (/\$|USD/i.test(rawAmount) ? 'USD' : 'PEN');
        const concept = conceptIndex >= 0 && toConceptApi(row[conceptIndex]) ? row[conceptIndex] : inferredConcept;
        return [`${concept} | ${currency} | ${Math.abs(signedAmount)} | ${row[dateIndex]} | ${note}`];
      });
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

    const concept = toConceptApi(parts[0]);
    if (!concept) {
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
    if (concept === 'gusto' && !notas) {
      errors.push(`Linea ${idx + 1}: para concepto "gusto" la nota es obligatoria.`);
      return;
    }

    rows.push({
      lineNumber: idx + 1,
      body: {
        concepto: concept,
        metodoPago: 'credito',
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

export const compareBulkExpenses = (importedRows, savedRows, card) => {
  const imported = (importedRows || []).map((row) => ({ ...row.body, _lineNumber: row.lineNumber })).sort((a, b) =>
    String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.monto || 0) - Number(b.monto || 0));
  if (!imported.length) return null;
  const dates = imported.map((row) => row.fecha).filter(Boolean).sort();
  const from = dates[0];
  const to = dates[dates.length - 1];
  const candidates = (savedRows || []).filter((row) => row.metodoPago === 'credito'
    && row.tarjeta === card && String(row.fecha || '').slice(0, 10) >= from && String(row.fecha || '').slice(0, 10) <= to)
    .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.monto || 0) - Number(b.monto || 0));
  const used = new Set();
  const pairs = imported.map((source, sourceIndex) => {
    const index = candidates.findIndex((target, candidateIndex) => !used.has(candidateIndex)
      && String(target.fecha || '').slice(0, 10) === source.fecha
      && Math.abs(Number(target.monto) - Number(source.monto)) < 0.005);
    if (index >= 0) used.add(index);
    return { source, sourceIndex: source._lineNumber, target: index >= 0 ? candidates[index] : null };
  });
  const missing = pairs.filter((pair) => !pair.target).map((pair) => pair.source);
  const remaining = candidates.filter((_, index) => !used.has(index));
  const dayValue = (value) => {
    const time = new Date(`${String(value || '').slice(0, 10)}T00:00:00Z`).getTime();
    return Number.isFinite(time) ? time : 0;
  };
  const importedDates = [...new Set(imported.map((row) => row.fecha))].sort();
  const systemGroups = new Map(importedDates.map((date) => [date, []]));
  candidates.forEach((saved) => {
    const savedDate = String(saved.fecha || '').slice(0, 10);
    const anchorDate = importedDates.includes(savedDate)
      ? savedDate
      : importedDates.reduce((best, date) => Math.abs(dayValue(date) - dayValue(savedDate)) < Math.abs(dayValue(best) - dayValue(savedDate)) ? date : best, importedDates[0]);
    systemGroups.get(anchorDate).push(saved);
  });
  const displayRows = [];
  importedDates.forEach((date) => {
    const datePairs = pairs.filter((pair) => pair.source.fecha === date);
    const groupRows = datePairs.map((pair) => ({ imported: pair.source, saved: pair.target, matched: Boolean(pair.target), sourceIndex: pair.sourceIndex }));
    const matchedTargets = new Set(datePairs.map((pair) => pair.target).filter(Boolean));
    (systemGroups.get(date) || []).filter((saved) => !matchedTargets.has(saved)).forEach((saved) => {
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

function ExpenseComparisonRows({ comparison, reviewed, setReviewed, conceptOverrides, setConceptOverrides, conceptOptions }) {
  return comparison.displayRows.map((displayRow, index) => {
    const { imported, saved, matched } = displayRow;
    const importedKey = `imported-${displayRow.sourceIndex ?? index}`;
    const savedKey = `saved-${saved?.id || index}`;
    const toggle = (key) => setReviewed((current) => ({ ...current, [key]: !current[key] }));
    return (
      <tr key={`manual-${index}-${saved?.id || 'none'}`} className="border-t border-gray-100 align-top">
        <td onClick={() => imported && !matched && toggle(importedKey)} className={`p-2 ${matched ? 'bg-emerald-100' : imported ? 'cursor-pointer bg-white hover:bg-gray-50' : 'bg-white'}`}>
          {imported && <div className="flex items-start gap-2">
            <input aria-label={`Revisar gasto cargado ${index + 1}`} type="checkbox" disabled={matched} checked={matched || Boolean(reviewed[importedKey])} onClick={(event) => event.stopPropagation()} onChange={(event) => setReviewed((current) => ({ ...current, [importedKey]: event.target.checked }))} className="mt-0.5" />
            <div className={`min-w-0 flex-1 ${matched ? 'text-emerald-900' : reviewed[importedKey] ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
              <div className="font-medium">{imported.fecha} · {imported.moneda} {Number(imported.monto).toFixed(2)}</div>
              <div className={matched ? 'text-emerald-700' : 'text-gray-500'}>{imported.notas || imported.concepto}</div>
              {!matched && !reviewed[importedKey] && <select aria-label={`Tipo de gasto ${index + 1}`} value={conceptOverrides[displayRow.sourceIndex] || imported.concepto} onClick={(event) => event.stopPropagation()} onChange={(event) => setConceptOverrides((current) => ({ ...current, [displayRow.sourceIndex]: event.target.value }))} className="mt-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-800">
                {conceptOptions.map((concept) => <option key={concept.value} value={concept.value}>{concept.label}</option>)}
              </select>}
            </div>
          </div>}
        </td>
        <td onClick={() => saved && !matched && toggle(savedKey)} className={`border-l border-gray-100 p-2 ${matched ? 'bg-emerald-100' : saved ? 'cursor-pointer bg-white hover:bg-gray-50' : 'bg-white'}`}>
          {saved && <label className={`flex items-start gap-2 ${matched ? 'text-emerald-900' : reviewed[savedKey] ? 'text-gray-400 line-through' : 'cursor-pointer text-indigo-800'}`}>
            <input aria-label={`Revisar gasto del sistema ${index + 1}`} type="checkbox" disabled={matched} checked={matched || Boolean(reviewed[savedKey])} onClick={(event) => event.stopPropagation()} onChange={(event) => setReviewed((current) => ({ ...current, [savedKey]: event.target.checked }))} className="mt-0.5" />
            <span><span className="font-medium">{String(saved.fecha).slice(0, 10)} · {saved.moneda} {Number(saved.monto).toFixed(2)}</span><span className={matched ? 'block text-emerald-700' : 'block text-gray-500'}>{saved.notas || saved.concepto}</span></span>
          </label>}
        </td>
      </tr>
    );
  });
}

export default function ModalGastoCreditoMasivo({ userId, existingRows = [], expenseConcepts = [], onClose, onSaved }) {
  const [cards, setCards] = useState([]);
  const [systemRows, setSystemRows] = useState(existingRows);
  const [loadingCards, setLoadingCards] = useState(true);
  const [tarjeta, setTarjeta] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [fileName, setFileName] = useState('');
  const [reviewed, setReviewed] = useState({});
  const [conceptOverrides, setConceptOverrides] = useState({});

  const cardLabel = (c) => c?.label || c?.name || c?.tipo || c?.type || '';
  const cardValue = (c) => c?.type || c?.tipo || c?.label || c?.name || '';
  const conceptOptions = useMemo(() => {
    const options = CREDIT_CONCEPTS.map((value) => ({ value, label: CONCEPT_LABELS[value] || value }));
    (Array.isArray(expenseConcepts) ? expenseConcepts : []).filter((item) => item?.appliesCredit !== false).forEach((item) => {
      const value = String(item?.value || '').trim();
      if (!value || options.some((option) => option.value === value)) return;
      options.push({ value, label: String(item?.label || value) });
    });
    return options;
  }, [expenseConcepts]);

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

  const preview = useMemo(() => parseBulkRows(bulkText), [bulkText]);
  const comparison = useMemo(() => compareBulkExpenses(preview.rows, systemRows, tarjeta), [preview.rows, systemRows, tarjeta]);

  const loadWorkbook = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError('');
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const value = pdfLinesToBulkText(await extractPdfTextLines(file));
        if (!value.trim()) throw new Error('No se encontraron gastos negativos ni reembolsos en el PDF.');
        setBulkText(value);
        setFileName(file.name);
        setReviewed({});
        setConceptOverrides({});
        return;
      }
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
      const headers = (matrix[0] || []).map(normalizeText);
      const findColumn = (...names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
      const dateIndex = findColumn('fecha');
      const amountIndex = findColumn('monto', 'importe', 'total');
      const currencyIndex = findColumn('moneda');
      const conceptIndex = findColumn('concepto', 'categoria');
      const noteIndex = findColumn('nota', 'descripcion', 'detalle', 'comercio');
      if (dateIndex < 0 || amountIndex < 0) throw new Error('Faltan las columnas Fecha y Monto/Importe.');
      const lines = matrix.slice(1).filter((row) => row.some((cell) => String(cell).trim())).flatMap((row) => {
        const signedAmount = toSignedAmount(row[amountIndex]);
        const note = noteIndex >= 0 ? String(row[noteIndex] || '').replace(/\|/g, '/') : '';
        const inferredConcept = classifyExpenseConcept(note);
        if (!(signedAmount < 0) && inferredConcept !== 'cashback') return [];
        if (!signedAmount) return [];
        const currency = currencyIndex >= 0 ? (toMoneda(row[currencyIndex]) || (/\$|USD/i.test(String(row[amountIndex])) ? 'USD' : 'PEN')) : (/\$|USD/i.test(String(row[amountIndex])) ? 'USD' : 'PEN');
        const concept = conceptIndex >= 0 && toConceptApi(row[conceptIndex]) ? row[conceptIndex] : inferredConcept;
        return [`${concept} | ${currency} | ${Math.abs(signedAmount)} | ${excelDateToText(row[dateIndex])} | ${note}`];
      });
      if (!lines.length) throw new Error('No se encontraron importes negativos. Los importes positivos se consideran pagos y se omiten.');
      setBulkText(lines.join('\n'));
      setFileName(file.name);
      setReviewed({});
      setConceptOverrides({});
    } catch (loadError) {
      setError(loadError?.message || 'No se pudo leer el archivo XLSX o PDF.');
    }
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

    const parsed = parseBulkRows(bulkText);
    if (!parsed.rows.length) return setError('No hay lineas validas para guardar.');
    if (parsed.errors.length) {
      setError(parsed.errors.slice(0, 8).join('\n'));
      return;
    }
    const matchedLines = new Set((comparison?.pairs || []).filter((pair) => pair.target).map((pair) => pair.source._lineNumber));
    const rowsToSave = parsed.rows.filter((item) => !matchedLines.has(item.lineNumber) && !reviewed[`imported-${item.lineNumber}`]);
    if (!rowsToSave.length) return setError('No hay gastos pendientes sin marcar para guardar.');

    setSaving(true);
    const created = [];
    const failed = [];

    try {
      for (const item of rowsToSave) {
        const body = { ...item.body, concepto: conceptOverrides[item.lineNumber] || item.body.concepto, tarjeta };
        try {
          const row = await createExpenseWithDuplicateCheck(body);
          if (row) created.push(row);
        } catch (error) {
          if (error instanceof ExpenseDuplicateCancelledError) continue;
          failed.push(`Linea ${item.lineNumber}: ${error?.message || 'No se pudo guardar'}`);
        }
      }

      if (created.length) {
        onSaved?.(created);
      }

      if (failed.length) {
        setError(`Se guardaron ${created.length} gastos y fallaron ${failed.length}.\n${failed.slice(0, 6).join('\n')}`);
        return;
      }

      setSuccessMsg(`Se guardaron ${created.length} gastos pendientes. Los marcados se omitieron.`);
      setBulkText('');
      onClose?.();
    } catch (err) {
      console.error('[ModalGastoCreditoMasivo] save error:', err);
      setError('No se pudo completar el guardado masivo.');
    } finally {
      setSaving(false);
    }
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
        <h2 className="text-lg font-semibold mb-2">Agregar gastos masivos (Credito)</h2>
        <p className="text-sm text-gray-600 mb-4">
          Patron por linea: <code>concepto | moneda | monto | fecha(dd/mm/yyyy) | nota(opcional)</code>.
          Cada linea crea un solo gasto.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
            Subir XLSX o PDF
            <input type="file" accept=".xlsx,.xls,.pdf,application/pdf" onChange={loadWorkbook} className="hidden" />
          </label>
          {fileName && <span className="text-sm text-gray-600">Archivo: {fileName}</span>}
          <span className="text-xs text-gray-500">XLSX: Fecha y Monto/Importe. PDF protegido: se usa la clave configurada. Se leen gastos negativos y reembolsos; los demás positivos son pagos.</span>
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
          <label className="text-sm max-w-sm">
            <span className="block text-gray-600 mb-1">Tarjeta para todas las lineas</span>
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
            <label className="text-sm text-gray-600">Lineas de gastos</label>
            <textarea
              className="w-full min-h-[220px] border rounded px-3 py-2 font-mono text-sm"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={[
                'comida | PEN | 35.50 | 18/02/2026 | almuerzo oficina',
                'transporte | PEN | 12 | 18/02/2026 | taxi',
                'inversion | USD | 120.00 | 17/02/2026 | iphone lote 2',
              ].join('\n')}
            />
            <div className="text-xs text-gray-500">
              Conceptos permitidos: {CREDIT_CONCEPTS.join(', ')}.
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
                        <td className="py-1">{r.body.monto}</td>
                        <td className="py-1">{r.body.fecha}</td>
                        <td className="py-1">{r.body.notas || '-'}</td>
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
                  <thead className="bg-indigo-100 text-indigo-950"><tr><th className="w-1/2 p-2 text-left">Gastos recién cargados ({comparison.imported.length})</th><th className="w-1/2 border-l border-indigo-200 p-2 text-left">Gastos que existen en el sistema ({comparison.candidates.length})</th></tr></thead>
                  <tbody><ExpenseComparisonRows comparison={comparison} reviewed={reviewed} setReviewed={setReviewed} conceptOverrides={conceptOverrides} setConceptOverrides={setConceptOverrides} conceptOptions={conceptOptions} /></tbody>
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
