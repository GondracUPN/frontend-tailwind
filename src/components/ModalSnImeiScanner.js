import React, { useEffect, useMemo, useState } from 'react';
import CloseX from './CloseX';
import api from '../api';

const normalizeOcrText = (value) =>
  String(value || '')
    .replace(/[|]/g, 'I')
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\r/g, '\n');

const onlyDigits = (value) => String(value || '').replace(/\D+/g, '');
const cleanSerial = (value) => String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
const SERIAL_MIN_LENGTH = 10;
const SERIAL_MAX_LENGTH = 12;
const IMEI_LENGTH = 15;

const SICKW_SERVICES = [
  { id: '30', label: 'Apple Basic Info', description: 'Servicio #30', cost: '0.05' },
  { id: '81', label: 'Apple MDM Status', description: 'Servicio #81', cost: '0.30' },
  { id: '8', label: 'SIM Lock Status', description: 'SICKW Servicio #8', cost: '0.025' },
  { id: '30+81', label: 'Revisar MacBook / iPad MDM', description: 'Servicios #30 + #81 simultaneos', cost: '0.35' },
  { id: '30+8', label: 'iPhone / iPad SIM Lock', description: 'Servicios #30 + #8 simultaneos', cost: '0.075' },
];

const normalizeOcrDigits = (value) =>
  String(value || '')
    .replace(/[OoQqDd]/g, '0')
    .replace(/[Il|!]/g, '1')
    .replace(/[Zz]/g, '2')
    .replace(/[Ss]/g, '5')
    .replace(/[Gg]/g, '6')
    .replace(/[Bb]/g, '8')
    .replace(/\D+/g, '');

const isValidImei = (value) => {
  const digits = onlyDigits(value);
  if (digits.length !== IMEI_LENGTH) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let n = Number(digits[i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
};

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const SERIAL_LABEL = /\b(?:S\/N|S\s*\/\s*N|SN|SERIAL(?:\s+NUMBER)?|SERIAL\s+NO\.?|SERIE|NO\.\s*SERIE|NUMERO\s+DE\s+SERIE|NRO\s+SERIE)\b/i;
const SERIAL_STOP_WORDS = new Set([
  'APPLE',
  'CALIFORNIA',
  'DESIGNED',
  'ASSEMBLED',
  'CHINA',
  'MODEL',
  'MODELO',
  'NUMBER',
  'SERIAL',
  'SERIE',
  'IMEI',
  'MEID',
  'ICCID',
  'MACBOOK',
  'IPHONE',
  'IPAD',
  'WATCH',
  'ORIGINAL',
  'COLOR',
  'CAPACITY',
]);

const extractImeis = (text) => {
  const source = normalizeOcrText(text);
  const found = [];
  const imeiChars = '[0-9OoQqDdIl|!ZzSsGgBb\\s.:-]';
  const labelRegex = new RegExp(`\\b(?:IMEI|1MEI|IME1|MEID)(?:\\s*[12])?(?:\\s*\\/\\s*MEID)?\\b[\\s:;#-]*(${imeiChars}{${IMEI_LENGTH},34})`, 'gi');
  let match;

  while ((match = labelRegex.exec(source))) {
    const digits = normalizeOcrDigits(match[1]).slice(0, IMEI_LENGTH);
    if (digits.length === IMEI_LENGTH) found.push(digits);
  }

  const lineRegex = /(?:\b(?:IMEI|1MEI|IME1|MEID)\b[^\n]{0,60})/gi;
  while ((match = lineRegex.exec(source))) {
    const digits = normalizeOcrDigits(match[0]).slice(-IMEI_LENGTH);
    if (digits.length === IMEI_LENGTH) found.push(digits);
  }

  const looseRegex = /\b\d(?:[\s.:-]*\d){14}\b/g;
  while ((match = looseRegex.exec(source))) {
    const digits = onlyDigits(match[0]);
    if (digits.length === IMEI_LENGTH) found.push(digits);
  }

  const valid = unique(found.filter(isValidImei));
  return valid.length ? valid : unique(found);
};

const scoreSerialCandidate = (candidate, contextScore = 0) => {
  const value = cleanSerial(candidate);
  if (value.length < SERIAL_MIN_LENGTH || value.length > SERIAL_MAX_LENGTH) return 0;
  if (/^\d+$/.test(value)) return 0;
  if (!/[A-Z]/.test(value) || !/\d/.test(value)) return 0;
  if (SERIAL_STOP_WORDS.has(value)) return 0;
  if (Array.from(SERIAL_STOP_WORDS).some((word) => word.length > 4 && value.includes(word))) return 0;
  let score = contextScore + 5;
  score += 4;
  if (new RegExp(`^[A-Z0-9]{${SERIAL_MIN_LENGTH},${SERIAL_MAX_LENGTH}}$`).test(value)) score += 3;
  if (/[IOQ]/.test(value)) score -= 1;
  return score;
};

const collectSerialCandidates = (text, imeis) => {
  const source = normalizeOcrText(text);
  const blocked = new Set((imeis || []).map(String));
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean);
  const scored = new Map();

  const addCandidate = (candidate, contextScore) => {
    const value = cleanSerial(candidate);
    if (blocked.has(value) || /^\d{15}$/.test(value)) return;
    const score = scoreSerialCandidate(value, contextScore);
    if (!score) return;
    scored.set(value, Math.max(scored.get(value) || 0, score));
  };

  const addFromContext = (context, contextScore) => {
    const upper = context.toUpperCase();
    const afterLabel = upper.replace(SERIAL_LABEL, ' ');
    const tokens = afterLabel.match(/\b[A-Z0-9][A-Z0-9-]{8,16}\b/g) || [];
    tokens.forEach((token) => addCandidate(token, contextScore));

    const compact = afterLabel.replace(/[^A-Z0-9]/g, '');
    for (let length = SERIAL_MAX_LENGTH; length >= SERIAL_MIN_LENGTH; length -= 1) {
      for (let i = 0; i <= compact.length - length; i += 1) {
        addCandidate(compact.slice(i, i + length), contextScore - 2);
      }
    }
  };

  lines.forEach((line, index) => {
    if (!SERIAL_LABEL.test(line)) return;
    addFromContext(line, 12);
    if (lines[index + 1]) addFromContext(lines[index + 1], 10);
    if (lines[index + 2] && cleanSerial(lines[index + 1]).length < 8) addFromContext(lines[index + 2], 8);
  });

  const directRegex = /\b(?:S\/N|S\s*\/\s*N|SN|SERIAL(?:\s+NUMBER)?|SERIAL\s+NO\.?|SERIE|NO\.\s*SERIE|NUMERO\s+DE\s+SERIE|NRO\s+SERIE)\b[\s:;#-]*([A-Z0-9][A-Z0-9\s-]{9,22})/gi;
  let match;
  while ((match = directRegex.exec(source))) {
    addFromContext(match[1], 14);
  }

  const standaloneRegex = /\b[A-Z0-9]{10,12}\b/gi;
  while ((match = standaloneRegex.exec(source))) {
    addCandidate(match[0], 2);
  }

  return Array.from(scored.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value]) => value)
    .slice(0, 5);
};

export const parseIds = (text) => {
  const imeis = extractImeis(text);
  const serialCandidates = collectSerialCandidates(text, imeis);
  return {
    serial: serialCandidates[0] || '',
    imei1: imeis[0] || '',
    imei2: imeis[1] || '',
    serials: serialCandidates,
    imeis,
  };
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const parseManualIdentifier = (value) => {
  const clean = cleanSerial(value);
  if (!clean) return null;
  if (/^\d{15}$/.test(clean)) return { type: 'imei', label: 'IMEI manual', value: clean };
  if (/^[A-Z0-9]{10,12}$/.test(clean) && /[A-Z]/.test(clean) && /\d/.test(clean)) return { type: 'sn', label: 'SN manual', value: clean };
  return null;
};

const resultToneClass = (tone) => {
  if (tone === 'good') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (tone === 'bad') return 'bg-red-50 text-red-700 ring-red-100';
  if (tone === 'warn') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-slate-50 text-slate-800 ring-slate-100';
};

const formatHistoryDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('es-PE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function ModalSnImeiScanner({ onClose }) {
  const [imageUrl, setImageUrl] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('30');
  const [text, setText] = useState('');
  const [selectedLookup, setSelectedLookup] = useState(null);
  const [sickwResult, setSickwResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [checkError, setCheckError] = useState('');
  const [balance, setBalance] = useState(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedIdentifier, setCopiedIdentifier] = useState('');
  const [hasScanned, setHasScanned] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [lookupStatus, setLookupStatus] = useState(null);
  const [lookupNotice, setLookupNotice] = useState('');

  useEffect(() => {
    let active = true;
    setHistoryLoading(true);
    api.get('/sickw/history?limit=150')
      .then((result) => {
        if (!active) return;
        setHistory(Array.isArray(result?.items) ? result.items : []);
        setHistoryTotal(Number(result?.total) || 0);
        setHistoryError('');
      })
      .catch((err) => {
        if (active) setHistoryError(err?.message || 'No se pudo cargar el historial.');
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!historyOpen) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setHistoryLoading(true);
      try {
        const query = historyQuery.trim();
        const result = await api.get(`/sickw/history?limit=150${query ? `&query=${encodeURIComponent(query)}` : ''}`);
        if (!active) return;
        setHistory(Array.isArray(result?.items) ? result.items : []);
        setHistoryTotal(Number(result?.total) || 0);
        setHistoryError('');
      } catch (err) {
        if (active) setHistoryError(err?.message || 'No se pudo buscar en el historial.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [historyOpen, historyQuery]);

  const parsed = useMemo(() => parseIds(text), [text]);
  const manualOption = useMemo(() => parseManualIdentifier(manualInput), [manualInput]);
  const selectedService = useMemo(
    () => SICKW_SERVICES.find((service) => service.id === selectedServiceId) || SICKW_SERVICES[0],
    [selectedServiceId],
  );
  const lookupOptions = useMemo(() => {
    const options = [
      manualOption,
      parsed.serial ? { type: 'sn', label: 'SN', value: parsed.serial } : null,
      parsed.imei1 ? { type: 'imei', label: 'IMEI 1', value: parsed.imei1 } : null,
      parsed.imei2 ? { type: 'imei2', label: 'IMEI 2', value: parsed.imei2 } : null,
    ].filter(Boolean);
    return unique(options.map((item) => `${item.type}:${item.value}`)).map((key) => {
      const [type, value] = key.split(':');
      return options.find((item) => item.type === type && item.value === value);
    }).filter(Boolean);
  }, [manualOption, parsed.serial, parsed.imei1, parsed.imei2]);
  const resetScanState = () => {
    setError('');
    setCheckError('');
    setCopied(false);
    setCopiedIdentifier('');
    setHasScanned(false);
    setText('');
    setSelectedLookup(null);
    setSickwResult(null);
    setLookupStatus(null);
    setLookupNotice('');
    setProgress(0);
  };

  const applyManualLookup = () => {
    const option = parseManualIdentifier(manualInput);
    if (!option) {
      setCheckError('Ingresa un SN o IMEI valido.');
      return;
    }
    setCheckError('');
    setSickwResult(null);
    setCopied(false);
    setCopiedIdentifier('');
    setLookupStatus(null);
    setLookupNotice('');
    setSelectedLookup(option);
  };

  const applyOcrText = (value) => {
    const normalized = normalizeOcrText(value || '');
    setText(normalized);
    setHasScanned(true);
    setProgress(100);
    const parsedNow = parseIds(normalized);
    const first = parsedNow.serial
      ? { type: 'sn', label: 'SN', value: parsedNow.serial }
      : parsedNow.imei1
        ? { type: 'imei', label: 'IMEI 1', value: parsedNow.imei1 }
        : parsedNow.imei2
          ? { type: 'imei2', label: 'IMEI 2', value: parsedNow.imei2 }
          : null;
    setSelectedLookup(first);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    resetScanState();
    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setLoading(true);

    try {
      setProgress(20);
      const imageBase64 = await fileToDataUrl(file);
      setProgress(45);
      const result = await api.post('/ocr/vision', {
        imageBase64,
        mimeType: file.type || 'image/jpeg',
      });
      applyOcrText(result?.text || '');
    } catch (err) {
      console.error('[ModalSnImeiScanner] OCR error:', err);
      setError(err?.message || 'No se pudo leer la imagen con Cloud Vision.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlScan = async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    resetScanState();
    if (imageUrl?.startsWith('blob:')) URL.revokeObjectURL(imageUrl);
    setImageUrl(trimmed);
    setLoading(true);

    try {
      setProgress(35);
      const result = await api.post('/ocr/vision', {
        imageUrl: trimmed,
      });
      applyOcrText(result?.text || '');
    } catch (err) {
      console.error('[ModalSnImeiScanner] OCR URL error:', err);
      setError(err?.message || 'No se pudo leer la imagen desde la URL.');
    } finally {
      setLoading(false);
    }
  };

  const checkSickw = async () => {
    if (!selectedLookup?.value) return;
    setChecking(true);
    setCheckError('');
    setSickwResult(null);
    setCopied(false);
    setCopiedIdentifier('');
    try {
      const result = await api.post('/sickw/apple-basic-info', {
        identifier: selectedLookup.value,
        type: selectedLookup.type,
        serviceId: selectedServiceId,
      });
      setSickwResult(result);
      setLookupNotice(result?.lookupStatus?.message || '');
      setLookupStatus({
        ...(result?.lookupStatus || {}),
        state: 'cached',
        result,
      });
      if (result?.historyRecord) {
        setHistory((current) => [result.historyRecord, ...current].slice(0, 150));
        setHistoryTotal((current) => current + 1);
      }
      if (Array.isArray(result?.historyRecords) && result.historyRecords.length) {
        setHistory((current) => [...result.historyRecords, ...current].slice(0, 150));
        setHistoryTotal((current) => current + result.historyRecords.length);
      }
      if (result?.balance) setBalance({ sickw: result.balance });
    } catch (err) {
      console.error('[ModalSnImeiScanner] SICKW error:', err);
      setCheckError(err?.message || `No se pudo consultar ${selectedService.label}.`);
    } finally {
      setChecking(false);
    }
  };

  const loadBalance = async () => {
    setBalanceLoading(true);
    setBalanceError('');
    try {
      const result = await api.get('/sickw/balance');
      setBalance(result);
    } catch (err) {
      setBalanceError(err?.message || 'No se pudo leer saldo.');
    } finally {
      setBalanceLoading(false);
    }
  };

  const copyResult = async () => {
    const fields = sickwResult?.fields || [];
    if (!fields.length) return;
    try {
      await navigator.clipboard.writeText(fields.map((field) => `${field.label}: ${field.value}`).join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const copyLookupValue = async (option) => {
    if (!option?.value) return;
    const key = `${option.type}:${option.value}`;
    try {
      await navigator.clipboard.writeText(option.value);
      setCopiedIdentifier(key);
      window.setTimeout(() => setCopiedIdentifier((current) => (current === key ? '' : current)), 1500);
    } catch {
      setCopiedIdentifier('');
    }
  };

  const handleHistoryItem = (item) => {
    const value = item.serial || item.imei1 || item.identifier || item.imei2;
    if (!value) return;
    setManualInput(value);
    setSelectedLookup({
      type: /^\d{15}$/.test(String(value)) ? 'imei' : 'sn',
      label: 'Historial',
      value,
    });
    setSelectedServiceId(item.serviceId || selectedServiceId);
    setSickwResult({
      serviceId: item.serviceId || '',
      serviceName: item.serviceName || '',
      costUSD: item.costUSD ?? '',
      identifier: item.identifier || value,
      type: item.type || (/^\d{15}$/.test(String(value)) ? 'imei' : 'sn'),
      raw: item.raw || '',
      fields: Array.isArray(item.fields) ? item.fields : [],
    });
    setLookupStatus({ state: 'cached' });
    setLookupNotice('Resultado cargado desde el historial. No se realizo una consulta nueva.');
    setCheckError('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl ring-1 ring-gray-200 p-6 relative max-h-[92vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Escanear SN / IMEI</h2>
          <p className="text-sm text-gray-500">Sube una imagen o pega una URL para consultar el servicio seleccionado.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)]">
          <div className="space-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Imagen</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFile}
                className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-800"
              />
            </label>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block text-sm">
                <span className="block text-sm font-medium text-gray-700 mb-1">URL de imagen</span>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleUrlScan();
                    }
                  }}
                  placeholder="https://i.ebayimg.com/images/..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </label>
              <button
                type="button"
                onClick={handleUrlScan}
                disabled={loading || checking || !urlInput.trim()}
                className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Leer URL
              </button>
            </div>
            {imageUrl ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <img src={imageUrl} alt="Imagen para OCR" className="max-h-[24rem] w-full object-contain" />
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                Sin imagen seleccionada.
              </div>
            )}
            {loading && (
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-sm text-sky-800">
                Leyendo imagen... {progress}%
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sky-100">
                  <div className="h-full bg-sky-600 transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
            {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{selectedService.label}</div>
                  <div className="text-xs text-gray-500">{selectedService.description} - costo {selectedService.cost} USD</div>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">API</span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                <div className="text-xs text-gray-600">
                  Saldo SICKW:{' '}
                  <span className="font-semibold text-gray-900">
                    {balance?.sickw?.available ? balance.sickw.label : balance?.sickw?.error ? 'No disponible' : '-'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadBalance}
                  disabled={balanceLoading || loading || checking}
                  className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {balanceLoading ? 'Leyendo...' : 'Actualizar saldo'}
                </button>
                {balanceError && <div className="basis-full text-xs font-medium text-red-600">{balanceError}</div>}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {SICKW_SERVICES.map((service) => {
                  const active = selectedServiceId === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(service.id);
                        setSickwResult(null);
                        setLookupStatus(null);
                        setLookupNotice('');
                        setCheckError('');
                      }}
                      disabled={loading || checking}
                      className={`rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${active ? 'border-blue-500 bg-white ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <div className="text-sm font-semibold text-gray-900">{service.label}</div>
                      <div className="text-xs text-gray-500">{service.description} - ${service.cost}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block text-sm">
                    <span className="block text-sm font-medium text-gray-700 mb-1">SN o IMEI manual</span>
                    <input
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          applyManualLookup();
                        }
                      }}
                      placeholder="Escribe SN o IMEI"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={applyManualLookup}
                    disabled={loading || checking || !manualInput.trim()}
                    className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Usar
                  </button>
                </div>

                {lookupOptions.map((option) => {
                  const active = selectedLookup?.type === option.type && selectedLookup?.value === option.value;
                  const key = `${option.type}:${option.value}`;
                  return (
                    <div key={key} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLookup(option);
                          setSickwResult(null);
                          setLookupStatus(null);
                          setLookupNotice('');
                        }}
                        className={`flex min-w-0 items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ${active ? 'border-blue-500 bg-white ring-2 ring-blue-100' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                      >
                        <span className="text-xs font-semibold text-gray-500">{option.label}</span>
                        <span className="min-w-0 break-all font-mono text-sm font-semibold text-gray-900">{option.value}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => copyLookupValue(option)}
                        className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        {copiedIdentifier === key ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  );
                })}

                {hasScanned && lookupOptions.length === 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                    No se pudo detectar SN ni IMEI.
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={checkSickw}
                disabled={loading || checking || lookupStatus?.state === 'cached' || !selectedLookup?.value}
                className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking
                  ? 'Consultando...'
                  : lookupStatus?.state === 'cached'
                      ? 'Consulta ya realizada'
                      : lookupStatus?.state === 'partial'
                        ? 'Consultar solamente el servicio faltante'
                        : `Consultar ${selectedService.label}`}
              </button>
              {lookupNotice && (
                <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${lookupStatus?.state === 'cached' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                  {lookupNotice}
                </div>
              )}
              {checkError && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{checkError}</div>}
            </div>

            {sickwResult && (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 bg-slate-900 px-4 py-3 text-white">
                  <div className="text-sm font-semibold">Resultado</div>
                  <div className="text-xs text-slate-300">{sickwResult.serviceName} - {sickwResult.identifier} - ${sickwResult.costUSD ?? selectedService.cost}</div>
                </div>
                <div className="grid gap-2 p-4 sm:grid-cols-2">
                  {(sickwResult.fields || []).map((field) => (
                    <div key={field.label} className={`rounded-lg px-3 py-2 ring-1 ${resultToneClass(field.tone)}`}>
                      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{field.label}</div>
                      <div className="mt-0.5 break-words text-sm font-semibold">{field.value}</div>
                    </div>
                  ))}
                  {!(sickwResult.fields || []).length && (
                    <div className="sm:col-span-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 ring-1 ring-slate-100">
                      SICKW respondio, pero no se pudieron separar los campos.
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-100 px-4 py-3">
                  <button
                    type="button"
                    onClick={copyResult}
                    disabled={!(sickwResult.fields || []).length}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {copied ? 'Copiado' : 'Copiar resultado'}
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Historial consultado</div>
                  <div className="text-xs text-gray-500">{historyTotal} consultas guardadas permanentemente</div>
                </div>
                <button
                  type="button"
                  onClick={() => setHistoryOpen(true)}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Ver historial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {historyOpen && (
        <div
          className="fixed inset-0 z-[60] bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={(e) => { if (e.target === e.currentTarget) setHistoryOpen(false); }}
        >
          <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-gray-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Historial SN / IMEI</h3>
                <p className="text-sm text-gray-500">{historyTotal} consultas guardadas en la base de datos.</p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-xl font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                aria-label="Cerrar historial"
              >
                x
              </button>
            </div>
            <div className="border-b border-gray-100 p-4">
              <div>
                <input
                  value={historyQuery}
                  onChange={(e) => setHistoryQuery(e.target.value)}
                  placeholder="Buscar por SN o IMEI"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              {historyError && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{historyError}</div>}
              {historyLoading ? (
                <div className="px-3 py-10 text-center text-sm text-gray-500">Cargando historial...</div>
              ) : history.length > 0 ? (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <span className="block text-xs font-semibold text-gray-500">{formatHistoryDate(item.checkedAt)}</span>
                          <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-600 ring-1 ring-gray-200">{item.serviceName || 'API'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleHistoryItem(item);
                            setHistoryOpen(false);
                          }}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                        >
                          Cargar
                        </button>
                      </div>
                      <div className="mt-1 grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
                        <div className="min-w-0">SN: <span className="break-all font-mono font-semibold">{item.serial || (item.type === 'sn' ? item.identifier : '') || '-'}</span></div>
                        <div className="min-w-0">IMEI: <span className="break-all font-mono font-semibold">{item.imei1 || (/^\d{15}$/.test(String(item.identifier || '')) ? item.identifier : '') || '-'}</span></div>
                        {item.imei2 ? <div className="min-w-0 sm:col-span-2">IMEI2: <span className="break-all font-mono font-semibold">{item.imei2}</span></div> : null}
                      </div>
                      {Array.isArray(item.fields) && item.fields.length > 0 && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {item.fields.map((field, index) => (
                            <div key={`${item.id}-${field.label}-${index}`} className="rounded-md bg-white px-2 py-1.5 ring-1 ring-gray-200">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{field.label}</div>
                              <div className="mt-0.5 break-words text-xs font-semibold text-gray-900">{field.value || '-'}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {item.raw && (
                        <details className="mt-3 rounded-md bg-white px-2 py-1.5 ring-1 ring-gray-200">
                          <summary className="cursor-pointer text-xs font-semibold text-gray-700">Ver respuesta original</summary>
                          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-gray-700">{item.raw}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-10 text-center text-sm text-gray-500">
                  {historyQuery.trim() ? 'No hay coincidencias.' : 'Todavia no hay consultas guardadas.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
