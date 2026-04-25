/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';
import { TC_FIJO } from '../utils/tipoCambio';

const PAGE_SIZE = 140;
const EMPTY_RESULT = {
  items: [],
  sellers: [],
  total: 0,
  query: '',
  sort: 'newlyListed',
  limit: PAGE_SIZE,
  offset: 0,
  groups: [],
  buyingOptions: '',
  family: 'all',
};

const FAMILY_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'ipad', label: 'iPad' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'macbook', label: 'MacBook' },
];

const IPAD_SCREEN_OPTIONS = ['', '11', '12.9', '13'];
const IPAD_PROCESSOR_OPTIONS = ['', 'A16', 'M1', 'M2', 'M3', 'M4', 'M5'];
const IPAD_STORAGE_OPTIONS = ['', '64GB', '128GB', '256GB', '512GB', '1TB', '2TB'];
const IPAD_CONNECTIVITY_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'cellular', label: 'Cell' },
];

const MACBOOK_LINE_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: 'Air', label: 'Air' },
  { value: 'Pro', label: 'Pro' },
];
const MACBOOK_SCREEN_OPTIONS = ['', '13', '14', '15', '16'];
const MACBOOK_PROCESSOR_OPTIONS = [
  '',
  'M1',
  'M1 Pro',
  'M1 Max',
  'M2',
  'M2 Pro',
  'M2 Max',
  'M3',
  'M3 Pro',
  'M3 Max',
  'M4',
  'M4 Pro',
  'M4 Max',
  'M5',
  'M5 Pro',
  'M5 Max',
];
const MACBOOK_RAM_OPTIONS = ['', '8GB', '16GB', '18GB', '24GB', '32GB', '36GB', '48GB', '64GB'];
const MACBOOK_STORAGE_OPTIONS = ['', '256GB', '512GB', '1TB', '2TB', '4TB', '8TB'];
const COMMON_CONDITION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'used', label: 'Used' },
  { value: 'for_parts', label: 'For parts or not working' },
  { value: 'open_box', label: 'Open box' },
  { value: 'new', label: 'New' },
];
const AUCTION_CONDITION_OPTIONS = [
  { value: 'auction_normal', label: 'Normal' },
  { value: 'auction_for_parts', label: 'No funciona' },
];
const PAWN_OFFER_OPTIONS = [
  { value: 'BEST_OFFER', label: 'Mejor oferta' },
  { value: '', label: 'Todos' },
];

const formatPrice = (value, currency = 'USD') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '$0.00';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
};

const formatDate = (value) => {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
};

const formatRemainingTime = (value) => {
  if (!value) return 'Tiempo no disponible';
  const endAt = new Date(value).getTime();
  if (Number.isNaN(endAt)) return 'Tiempo no disponible';
  const diffMs = endAt - Date.now();
  if (diffMs <= 0) return 'Finalizada';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const averageNumbers = (values = []) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  if (!valid.length) return null;
  return +(valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2);
};

const medianNumbers = (values = []) => {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0).sort((left, right) => left - right);
  if (!valid.length) return null;
  const middle = Math.floor(valid.length / 2);
  if (valid.length % 2 === 1) return valid[middle];
  return (valid[middle - 1] + valid[middle]) / 2;
};

const roundUp10 = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.ceil(amount / 10) * 10;
};

const compactValue = (value) => String(value || '').trim();

const buildIpadQuery = (form) => {
  const parts = ['apple', 'ipad'];
  if (compactValue(form.screen)) parts.push(`${form.screen}-inch`);
  if (compactValue(form.processor)) parts.push(form.processor);
  if (compactValue(form.storage)) parts.push(form.storage);
  if (form.connectivity === 'wifi') parts.push('wifi');
  if (form.connectivity === 'cellular') parts.push('cellular');
  return parts.join(' ');
};

const buildMacbookQuery = (form) => {
  const parts = ['apple', 'macbook'];
  if (compactValue(form.line)) parts.push(form.line);
  if (compactValue(form.screen)) parts.push(`${form.screen}-inch`);
  if (compactValue(form.processor)) parts.push(form.processor);
  if (compactValue(form.ram)) parts.push(form.ram);
  if (compactValue(form.storage)) parts.push(form.storage);
  return parts.join(' ');
};

const getIphoneModelOptions = (number) => {
  const n = Number(number);
  if (!Number.isFinite(n)) return [{ value: '', label: 'Base' }];
  if (n === 13) return [{ value: '', label: 'Base' }, { value: 'pro', label: 'Pro' }, { value: 'pro max', label: 'Pro Max' }];
  if (n >= 14 && n <= 15) {
    return [{ value: '', label: 'Base' }, { value: 'plus', label: 'Plus' }, { value: 'pro', label: 'Pro' }, { value: 'pro max', label: 'Pro Max' }];
  }
  if (n === 16) {
    return [{ value: '', label: 'Base' }, { value: 'e', label: 'E' }, { value: 'plus', label: 'Plus' }, { value: 'pro', label: 'Pro' }, { value: 'pro max', label: 'Pro Max' }];
  }
  if (n === 17) {
    return [{ value: '', label: 'Base' }, { value: 'e', label: 'E' }, { value: 'pro', label: 'Pro' }, { value: 'pro max', label: 'Pro Max' }];
  }
  return [{ value: '', label: 'Base' }];
};

const buildIphoneQuery = (form) => {
  const parts = ['apple', 'iphone'];
  if (compactValue(form.number)) {
    const number = compactValue(form.number);
    if (compactValue(form.model) === 'e') parts.push(`${number}e`);
    else {
      parts.push(number);
      if (compactValue(form.model)) parts.push(form.model);
    }
  }
  parts.push('unlocked');
  return parts.join(' ');
};

const normalizeTitleText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.+\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeIphoneNumber = (value) => {
  const match = normalizeTitleText(value).match(/\b\d{2}\b/);
  return match ? match[0] : '';
};

const normalizeIphoneModel = (value) => {
  const normalized = normalizeTitleText(value).replace(/\d+/g, '').replace(/[^a-z0-9]+/g, '');
  if (!normalized) return '';
  if (normalized === 'promax') return 'pro max';
  if (normalized === 'pro') return 'pro';
  if (normalized === 'plus') return 'plus';
  if (normalized === 'mini') return 'mini';
  if (normalized === 'e') return 'e';
  if (normalized === 'normal') return 'normal';
  return normalized;
};

const inferTypeFromTitle = (title) => {
  const normalized = normalizeTitleText(title);
  if (normalized.includes('macbook')) return 'macbook';
  if (normalized.includes('iphone')) return 'iphone';
  if (normalized.includes('ipad')) return 'ipad';
  return '';
};

const titleHasScreen = (title, screen) => {
  const normalized = normalizeTitleText(title);
  const target = String(screen || '').trim();
  if (!target) return true;
  const pattern = new RegExp(`\\b${escapeRegex(target)}(?:\\s|-)?(?:inch|in)?\\b`);
  return pattern.test(normalized);
};

const normalizeBulkPawnText = (value) =>
  String(value || '')
    .replace(/\r/g, '\n')
    .replace(/[;,]+/g, '\n')
    .replace(/(https?:\/\/[^\s]+)\s+(?=https?:\/\/)/gi, '$1\n')
    .replace(/\n{3,}/g, '\n\n');

const buildBulkPawnPasteText = (currentText, pastedText, selectionStart, selectionEnd) => {
  const before = String(currentText || '').slice(0, selectionStart);
  const after = String(currentText || '').slice(selectionEnd);
  const normalizedPaste = String(pastedText || '').trim();
  if (!normalizedPaste) return currentText;

  const needsLeadingBreak =
    before.length > 0 &&
    !before.endsWith('\n') &&
    /^https?:\/\//i.test(normalizedPaste);
  const needsTrailingBreak =
    after.length > 0 &&
    !after.startsWith('\n') &&
    /^https?:\/\//i.test(after) &&
    !normalizedPaste.endsWith('\n');

  return `${before}${needsLeadingBreak ? '\n' : ''}${normalizedPaste}${needsTrailingBreak ? '\n' : ''}${after}`;
};

const normalizePawnInputText = (value) =>
  String(value || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u2060]/g, '')
    .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '');

const compactPawnInput = (value) => String(value || '').replace(/\s+/g, '');

const stripTrailingPawnUrlJunk = (value) => String(value || '').replace(/[)\],;:!?]+$/g, '');

const sanitizePawnInput = (value) => {
  const normalized = normalizePawnInputText(value);
  const directMatch = normalized.match(/https?:\/\/[^\s"'`<>]+/i)?.[0];
  if (directMatch) return stripTrailingPawnUrlJunk(compactPawnInput(directMatch));

  const hostMatch = normalized.match(/(?:www\.)?ebay\.[a-z.]+\/[^\s"'`<>]+/i)?.[0];
  if (hostMatch) {
    const candidate = stripTrailingPawnUrlJunk(compactPawnInput(hostMatch));
    return candidate.startsWith('http') ? candidate : `https://${candidate}`;
  }

  const pathMatch =
    normalized.match(/(?:^|[\s"'`(])((?:\/)?(?:str|usr)\/[^\s/?#"'`<>]+)/i)?.[1] ||
    normalized.match(/^\/(?:str|usr)\/[^/]+$/i)?.[0];
  if (pathMatch) {
    return `https://www.ebay.com/${stripTrailingPawnUrlJunk(compactPawnInput(pathMatch)).replace(/^\/?/, '')}`;
  }

  const compacted = compactPawnInput(normalized);
  return stripTrailingPawnUrlJunk(compacted);
};

const sanitizePawnBulkText = (value) => {
  const lines = String(value || '')
    .split(/[\r\n,;]+/)
    .map((line) => sanitizePawnInput(line))
    .filter(Boolean);
  return Array.from(new Set(lines)).join('\n');
};

const ACCESSORY_KEYWORDS = [
  'sleeve',
  'keyboard',
  'magic keyboard',
  'folio',
  'smart folio',
  'case',
  'cover',
  'bag',
  'shell',
  'skin',
  'pencil',
  'charger',
  'cable',
  'adapter',
  'protector',
  'screen protector',
  'stylus',
  'pen',
  'replacement',
  'housing',
  'digitizer',
  'lcd',
  'glass',
  'bundle only',
];

const ACCESSORY_PRIMARY_PATTERNS = [
  /^(?:apple\s+)?(?:(?:laptop|tablet|phone|cell\s+phone|smartphone)\s+)?(?:case|sleeve|cover|folio|keyboard|magic keyboard|smart folio|screen protector|protector|pencil|charger|adapter|cable|bag|shell|skin|housing|digitizer|lcd|glass)\b/,
  /\bcompatible with\b/,
  /\bdesigned for\b/,
  /\bfits?\s+(?:the\s+)?(?:apple\s+)?(?:macbook|ipad|iphone|watch)\b/,
  /\bfor\s+(?:the\s+)?(?:apple\s+)?(?:macbook|ipad|iphone|watch)\b/,
  /\breplacement\b/,
];

const DEVICE_SIGNAL_PATTERNS = [
  /\bm[1-5](?:\s+(?:pro|max))?\b/,
  /\b\d+(?:gb|tb)\b/,
  /\b\d+gb\s+ram\b/,
  /\b(?:wifi|cellular|gps|unlocked|ssd|ram|cycles)\b/,
  /\ba\d{4}\b/,
  /\b[a-z0-9]{3,}ll\/a\b/,
];

const hasAccessoryKeyword = (normalized) =>
  ACCESSORY_KEYWORDS.some((keyword) => normalized.includes(keyword));

const hasDeviceSignals = (normalized) =>
  DEVICE_SIGNAL_PATTERNS.some((pattern) => pattern.test(normalized));

const isAccessoryPrimaryForFamily = (normalized, family) => {
  if (family === 'ipad') {
    return /\bipad(?:\s+(?:pro|air|mini|\d+(?:\.\d+)?))?(?:\s+\w+){0,2}\s+(?:case|sleeve|cover|folio|keyboard|magic keyboard|smart folio|screen protector|protector|pencil)\b/.test(normalized);
  }
  if (family === 'iphone') {
    return /\biphone(?:\s+\d{2})?(?:\s+(?:pro|max|plus|mini|e)){0,2}(?:\s+\w+){0,1}\s+(?:case|cover|screen protector|protector|charger|cable)\b/.test(normalized);
  }
  if (family === 'macbook') {
    return /\bmacbook(?:\s+(?:air|pro))?(?:\s+\w+){0,2}\s+(?:case|sleeve|cover|bag|shell)\b/.test(normalized);
  }
  return false;
};

const isPrimaryAccessoryTitle = (title, family = '') => {
  const normalized = normalizeTitleText(title);
  if (!hasAccessoryKeyword(normalized)) return false;
  if (ACCESSORY_PRIMARY_PATTERNS.some((pattern) => pattern.test(normalized))) return true;
  if (family && isAccessoryPrimaryForFamily(normalized, family)) return true;
  if (!hasDeviceSignals(normalized)) return true;
  return false;
};

const isLikelyAppleDeviceTitle = (title, family) => {
  const normalized = normalizeTitleText(title);
  if (isPrimaryAccessoryTitle(normalized, family)) return false;
  if (family === 'ipad') return normalized.includes('ipad');
  if (family === 'iphone') return normalized.includes('iphone');
  if (family === 'macbook') return normalized.includes('macbook');
  return false;
};

const matchIpadItem = (item, form) => {
  const title = normalizeTitleText(item?.title || '');
  if (!isLikelyAppleDeviceTitle(title, 'ipad')) return false;
  if (compactValue(form.processor) && !title.includes(compactValue(form.processor).toLowerCase())) return false;
  if (compactValue(form.screen) && !title.includes(compactValue(form.screen).toLowerCase())) return false;
  if (compactValue(form.storage) && !title.includes(compactValue(form.storage).toLowerCase().replace('gb', ' gb').replace('tb', ' tb').trim())) {
    const storageRaw = compactValue(form.storage).toLowerCase();
    if (!title.includes(storageRaw)) return false;
  }
  if (form.connectivity === 'wifi' && !title.includes('wifi')) return false;
  if (form.connectivity === 'cellular' && !title.includes('cellular')) return false;
  return true;
};

const computeSuggestedBuyRange = (group) => {
  const purchases = Array.isArray(group?.comprasDetalle) ? group.comprasDetalle : [];
  if (!purchases.length || Number(group?.compras?.count || 0) <= 0) return null;

  const sales = Array.isArray(group?.ventasDetalle) ? group.ventasDetalle : [];
  const salePrices = sales.map((entry) => Number(entry?.precioVenta || 0)).filter((value) => Number.isFinite(value) && value > 0);
  const purchaseCosts = purchases.map((entry) => Number(entry?.costoTotal || 0)).filter((value) => Number.isFinite(value) && value > 0);

  const saleMedian = medianNumbers(salePrices) || Number(group?.ventas?.p50 || 0) || null;
  const purchaseCostMean = averageNumbers(purchaseCosts) || Number(group?.compras?.mean || 0) || null;
  const saleMean = averageNumbers(salePrices);

  const saleRange20 = purchaseCostMean ? roundUp10(purchaseCostMean * 1.2) : null;
  const saleRange40 = purchaseCostMean ? roundUp10(purchaseCostMean * 1.4) : null;
  const baseRange = saleRange20 != null && saleRange40 != null
    ? (saleRange20 + saleRange40) / 2
    : (purchaseCostMean ? purchaseCostMean * 1.3 : null);
  const saleBase = saleMean || saleMedian || null;

  if (!saleBase && !baseRange) return null;

  const targetSale = roundUp10(
    saleBase && baseRange
      ? (saleBase + baseRange) / 2
      : (saleBase ?? baseRange),
  );

  const exchangeRates = purchases
    .map((entry) => {
      const usd = Number(entry?.precioUSD || 0);
      const totalCost = Number(entry?.costoTotal || 0);
      if (!Number.isFinite(usd) || !Number.isFinite(totalCost) || usd <= 0 || totalCost <= 0) return null;
      return totalCost / usd;
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  const referenceRate = averageNumbers(exchangeRates) || TC_FIJO;
  const saleBaseForBuy = targetSale || saleBase || null;
  if (!saleBaseForBuy || !referenceRate) return null;

  const buyMax20 = +(((saleBaseForBuy / 1.2) / referenceRate).toFixed(2));
  const buyMax40 = +(((saleBaseForBuy / 1.4) / referenceRate).toFixed(2));
  if (!Number.isFinite(buyMax20) || !Number.isFinite(buyMax40)) return null;

  return {
    min: Math.min(buyMax20, buyMax40),
    max: Math.max(buyMax20, buyMax40),
  };
};

const matchesAnalyticsGroup = (title, group) => {
  const normalizedTitle = normalizeTitleText(title);
  const type = normalizeTitleText(group?.tipo || '');
  const gama = normalizeTitleText(group?.gama || '');
  const processor = normalizeTitleText(group?.proc || '');
  const screen = String(group?.pantalla || '').trim();

  if (type === 'iphone') {
    if (!isLikelyAppleDeviceTitle(normalizedTitle, 'iphone')) return false;
    const number = normalizeIphoneNumber(group?.gama || '');
    const model = normalizeIphoneModel(group?.gama || '');
    if (number) {
      const numberPattern = new RegExp(`\\biphone\\s*${escapeRegex(number)}(?:\\s*e)?\\b|\\b${escapeRegex(number)}e\\b`);
      if (!numberPattern.test(normalizedTitle)) return false;
    }
    if (model === 'e') return /\biphone\s*(16|17)\s*e\b|\b(16|17)e\b/.test(normalizedTitle);
    if (model === 'pro max') return /\bpro\s*max\b/.test(normalizedTitle);
    if (model === 'pro') return /\bpro\b/.test(normalizedTitle) && !/\bpro\s*max\b/.test(normalizedTitle);
    if (model === 'plus') return /\bplus\b/.test(normalizedTitle);
    if (model === 'mini') return /\bmini\b/.test(normalizedTitle);
    return !/\b(pro|max|plus|mini)\b/.test(normalizedTitle) && !/\biphone\s*(16|17)\s*e\b|\b(16|17)e\b/.test(normalizedTitle);
  }

  if (type === 'ipad') {
    if (!isLikelyAppleDeviceTitle(normalizedTitle, 'ipad')) return false;
    if (gama && gama !== 'normal' && !new RegExp(`\\b${escapeRegex(gama)}\\b`).test(normalizedTitle)) return false;
    if (gama === 'normal' && /\b(pro|air|mini)\b/.test(normalizedTitle)) return false;
    if (processor && !new RegExp(`\\b${escapeRegex(processor)}\\b`).test(normalizedTitle)) return false;
    if (screen && !titleHasScreen(normalizedTitle, screen)) return false;
    return true;
  }

  if (type === 'macbook') {
    if (!isLikelyAppleDeviceTitle(normalizedTitle, 'macbook')) return false;
    if (gama && !new RegExp(`\\b${escapeRegex(gama)}\\b`).test(normalizedTitle)) return false;
    if (processor && !new RegExp(`\\b${escapeRegex(processor)}\\b`).test(normalizedTitle)) return false;
    if (screen && !titleHasScreen(normalizedTitle, screen)) return false;
    return true;
  }

  return false;
};

const scoreAnalyticsGroupMatch = (title, group) => {
  const normalizedTitle = normalizeTitleText(title);
  let score = 10;
  if (group?.gama && new RegExp(`\\b${escapeRegex(group.gama)}\\b`, 'i').test(normalizedTitle)) score += 5;
  if (group?.proc && new RegExp(`\\b${escapeRegex(group.proc)}\\b`, 'i').test(normalizedTitle)) score += 5;
  if (group?.pantalla && titleHasScreen(normalizedTitle, group.pantalla)) score += 3;
  score += Number(group?.compras?.count || 0) * 0.01;
  return score;
};

const buildRecommendationForItem = (item, analyticsGroups = [], priceMode = 'standard') => {
  const title = String(item?.title || '');
  const itemType = inferTypeFromTitle(title);
  if (!itemType) return null;
  if (['ipad', 'iphone', 'macbook'].includes(itemType) && isPrimaryAccessoryTitle(title, itemType)) return null;

  const currentPrice = Number(priceMode === 'bid' ? item?.currentBidPriceUSD : item?.priceUSD);
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null;

  const candidates = analyticsGroups
    .filter((group) => normalizeTitleText(group?.tipo || '') === itemType)
    .filter((group) => matchesAnalyticsGroup(title, group))
    .map((group) => ({
      group,
      score: scoreAnalyticsGroupMatch(title, group),
      range: computeSuggestedBuyRange(group),
    }))
    .filter((entry) => entry.range && Number(entry?.group?.compras?.count || 0) > 0)
    .sort((left, right) => right.score - left.score);

  if (!candidates.length) return null;

  const best = candidates[0];
  if (currentPrice <= best.range.min) return { label: 'Puja', tone: 'go' };
  if (currentPrice <= best.range.max) return { label: 'Limite', tone: 'limit' };
  return { label: 'No', tone: 'stop' };
};

const mergeUniqueItems = (prevItems, nextItems) => {
  const seen = new Set(prevItems.map((item) => String(item.itemId || item.legacyItemId || item.itemWebUrl || '')));
  const merged = [...prevItems];
  nextItems.forEach((item) => {
    const key = String(item.itemId || item.legacyItemId || item.itemWebUrl || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged;
};

function SectionToggle({ activeTab, onChange }) {
  const tabs = [
    { id: 'pawns', label: 'Buscar Por Pawns' },
    { id: 'product', label: 'Buscar Por Producto' },
    { id: 'auctions', label: 'Subastas Apple' },
  ];

  return (
    <div className="inline-flex rounded-2xl bg-slate-200 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function FieldShell({ label, children }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</div>
      {children}
    </label>
  );
}

function SelectField({ value, onChange, options, placeholder = 'Todos' }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
    >
      <option value="">{placeholder}</option>
      {options.filter((option) => option !== '').map((option) => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function MappedSelectField({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={onChange}
      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
    >
      {options.map((option) => (
        <option key={option.value || 'all'} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}

function ResultsGrid({ items, titleSource = 'store', dateField = 'origin', priceMode = 'standard' }) {
  const recommendationTone = {
    go: 'bg-emerald-100 text-emerald-800',
    limit: 'bg-amber-100 text-amber-800',
    stop: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
      {items.map((item) => {
        const sellerLabel = titleSource === 'seller' ? (item.seller || 'eBay') : (item.storeName || item.seller || 'eBay');
        const feedbackPercent = Number(item.sellerFeedbackPercentage);
        const feedbackScore = Number(item.sellerFeedbackScore);
        const bidAmount = Number.isFinite(Number(item.currentBidPriceUSD)) ? item.currentBidPriceUSD : 0;
        return (
          <a
            key={item.itemId || item.itemWebUrl}
            href={item.itemWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
          >
            <div className="aspect-square bg-slate-100">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">Sin imagen</div>
              )}
            </div>

            <div className="space-y-2 p-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{sellerLabel}</div>
                {(Number.isFinite(feedbackPercent) || Number.isFinite(feedbackScore)) && (
                  <div className="mt-1 text-[11px] text-slate-500">
                    {Number.isFinite(feedbackPercent) ? `${feedbackPercent.toFixed(1)}%` : '-'} | {Number.isFinite(feedbackScore) ? `${Math.round(feedbackScore)} reviews` : '0 reviews'}
                  </div>
                )}
              </div>

              <div className="line-clamp-3 min-h-[3.6rem] text-sm font-semibold leading-5 text-slate-900">{item.title}</div>

              {item.priceReview && (
                <div className={`inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${recommendationTone[item.priceReview.tone] || 'bg-slate-100 text-slate-700'}`}>
                  {item.priceReview.label}
                </div>
              )}

              <div className="rounded-xl bg-emerald-50 px-2.5 py-1.5 text-sm font-bold text-emerald-700">
                {priceMode === 'bid' ? `Oferta: ${formatPrice(bidAmount, item.currency)}` : formatPrice(item.priceUSD, item.currency)}
              </div>

              <div className="space-y-1 text-[11px] text-slate-500">
                <div>{item.condition || 'Sin condicion'}</div>
                <div>{dateField === 'end' ? `Restante: ${formatRemainingTime(item.itemEndDate)}` : formatDate(item.itemOriginDate || item.itemCreationDate)}</div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function Ebay({ setVista }) {
  const [activeTab, setActiveTab] = useState('pawns');
  const [loadingTab, setLoadingTab] = useState('');
  const [appendLoadingTab, setAppendLoadingTab] = useState('');
  const [errors, setErrors] = useState({ pawns: '', product: '', auctions: '' });

  const [pawnQuery, setPawnQuery] = useState('apple');
  const [pawnCondition, setPawnCondition] = useState('');
  const [pawnBuyingOptions, setPawnBuyingOptions] = useState('BEST_OFFER');
  const [pawnResult, setPawnResult] = useState(EMPTY_RESULT);
  const [pawnStores, setPawnStores] = useState([]);
  const [pawnStoreMode, setPawnStoreMode] = useState('');
  const [pawnStoreUrl, setPawnStoreUrl] = useState('');
  const [pawnStoreBulkText, setPawnStoreBulkText] = useState('');
  const [pawnStoreSaving, setPawnStoreSaving] = useState(false);
  const [pawnStoreMessage, setPawnStoreMessage] = useState('');
  const [pawnStoreError, setPawnStoreError] = useState('');
  const [pawnStoresModalOpen, setPawnStoresModalOpen] = useState(false);

  const [productType, setProductType] = useState('all');
  const [productCondition, setProductCondition] = useState('');
  const [productBuyingOptions, setProductBuyingOptions] = useState('BEST_OFFER');
  const [productResult, setProductResult] = useState(EMPTY_RESULT);
  const [ipadForm, setIpadForm] = useState({ screen: '', processor: '', storage: '', connectivity: '' });
  const [iphoneForm, setIphoneForm] = useState({ number: '16', model: '' });
  const [macbookForm, setMacbookForm] = useState({ line: '', screen: '', processor: '', ram: '', storage: '' });

  const [auctionFamily, setAuctionFamily] = useState('all');
  const [auctionCondition, setAuctionCondition] = useState('auction_normal');
  const [auctionResult, setAuctionResult] = useState({ ...EMPTY_RESULT, groups: [], buyingOptions: 'AUCTION' });
  const [analyticsGroups, setAnalyticsGroups] = useState([]);

  const sentinelRef = useRef(null);

  const loadPawnStores = async () => {
    try {
      const data = await api.get('/utils/ebay/pawns');
      setPawnStores(Array.isArray(data?.stores) ? data.stores : []);
    } catch {
      setPawnStores([]);
    }
  };

  const exportPawnStores = () => {
    const lines = pawnStores
      .map((store) => String(store?.originalUrl || store?.storeUrl || '').trim())
      .filter(Boolean);
    if (!lines.length) return;
    const blob = new Blob([`${lines.join('\r\n')}\r\n`], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pawns-ebay.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const loadPawns = async ({ append = false, query = pawnQuery } = {}) => {
    const offset = append ? pawnResult.items.length : 0;
    const trimmedQuery = String(query || '').trim() || 'apple';
    if (append) setAppendLoadingTab('pawns');
    else setLoadingTab('pawns');
    setErrors((prev) => ({ ...prev, pawns: '' }));
    try {
      const data = await api.get(
        `/utils/ebay/store-feed?q=${encodeURIComponent(trimmedQuery)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(pawnCondition)}&buyingOptions=${encodeURIComponent(pawnBuyingOptions)}`,
      );
      setPawnResult((prev) => ({
        items: append ? mergeUniqueItems(prev.items, Array.isArray(data?.items) ? data.items : []) : (Array.isArray(data?.items) ? data.items : []),
        sellers: Array.isArray(data?.sellers) ? data.sellers : [],
        total: Number(data?.total || 0),
        query: String(data?.query || trimmedQuery),
        sort: String(data?.sort || 'newlyListed'),
        limit: Number(data?.limit || PAGE_SIZE),
        offset: Number(data?.offset || offset),
      }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, pawns: String(err?.message || 'No se pudo cargar la busqueda por pawns.') }));
    } finally {
      if (append) setAppendLoadingTab('');
      else setLoadingTab('');
    }
  };

  const productQuery =
    productType === 'ipad'
      ? buildIpadQuery(ipadForm)
      : productType === 'iphone'
        ? buildIphoneQuery(iphoneForm)
        : productType === 'macbook'
          ? buildMacbookQuery(macbookForm)
          : 'apple ipad iphone macbook';

  const loadProductSearch = async ({ append = false } = {}) => {
    const offset = append ? productResult.items.length : 0;
    if (append) setAppendLoadingTab('product');
    else setLoadingTab('product');
    setErrors((prev) => ({ ...prev, product: '' }));
    try {
      const endpoint = productType === 'all'
        ? `/utils/ebay/apple-collection?family=all&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(productCondition)}&buyingOptions=${encodeURIComponent(productBuyingOptions)}`
        : `/utils/ebay/search?q=${encodeURIComponent(productQuery)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(productCondition)}&buyingOptions=${encodeURIComponent(productBuyingOptions)}`;
      const data = await api.get(endpoint);
      const rawItems = Array.isArray(data?.items) ? data.items : [];
      const familyFilteredItems = productType === 'all'
        ? rawItems
        : rawItems.filter((item) => isLikelyAppleDeviceTitle(item?.title || '', productType));
      const filteredItems = productType === 'ipad'
        ? familyFilteredItems.filter((item) => matchIpadItem(item, ipadForm))
        : familyFilteredItems;
      setProductResult((prev) => ({
        items: append ? mergeUniqueItems(prev.items, filteredItems) : filteredItems,
        sellers: [],
        total: Number(data?.total || 0),
        query: String(data?.query || productQuery),
        sort: String(data?.sort || 'newlyListed'),
        limit: Number(data?.limit || PAGE_SIZE),
        offset: Number(data?.offset || offset),
        groups: Array.isArray(data?.groups) ? data.groups : [],
        family: String(data?.family || productType),
        buyingOptions: String(data?.buyingOptions || productBuyingOptions),
      }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, product: String(err?.message || 'No se pudo cargar la busqueda por producto.') }));
    } finally {
      if (append) setAppendLoadingTab('');
      else setLoadingTab('');
    }
  };

  const loadAppleAuctions = async ({ append = false } = {}) => {
    const offset = append ? auctionResult.items.length : 0;
    if (append) setAppendLoadingTab('auctions');
    else setLoadingTab('auctions');
    setErrors((prev) => ({ ...prev, auctions: '' }));
    try {
      const data = await api.get(
        `/utils/ebay/apple-auctions?family=${encodeURIComponent(auctionFamily)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(auctionCondition)}`,
      );
      setAuctionResult((prev) => ({
        items: append ? mergeUniqueItems(prev.items, Array.isArray(data?.items) ? data.items : []) : (Array.isArray(data?.items) ? data.items : []),
        sellers: [],
        total: Number(data?.total || 0),
        query: String(data?.query || 'Apple collection'),
        sort: String(data?.sort || 'endingSoonest'),
        limit: Number(data?.limit || PAGE_SIZE),
        offset: Number(data?.offset || offset),
        groups: Array.isArray(data?.groups) ? data.groups : [],
        buyingOptions: String(data?.buyingOptions || 'AUCTION'),
        family: String(data?.family || auctionFamily),
      }));
    } catch (err) {
      setErrors((prev) => ({ ...prev, auctions: String(err?.message || 'No se pudo cargar la vista de subastas.') }));
    } finally {
      if (append) setAppendLoadingTab('');
      else setLoadingTab('');
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPawns({ append: false, query: 'apple' });
    loadPawnStores();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAnalyticsGroups = async () => {
      try {
        const data = await getAnalyticsSummary();
        if (!cancelled) {
          setAnalyticsGroups(Array.isArray(data?.productGroups) ? data.productGroups : []);
        }
      } catch {
        if (!cancelled) {
          setAnalyticsGroups([]);
        }
      }
    };

    loadAnalyticsGroups();
    return () => {
      cancelled = true;
    };
  }, []);

  const currentResult = activeTab === 'pawns' ? pawnResult : activeTab === 'product' ? productResult : auctionResult;
  const currentError = activeTab === 'pawns' ? errors.pawns : activeTab === 'product' ? errors.product : errors.auctions;
  const currentLoading = loadingTab === activeTab;
  const currentAppending = appendLoadingTab === activeTab;
  const currentHasMore = currentResult.items.length > 0 && currentResult.items.length < currentResult.total;
  const currentItems = useMemo(
    () => currentResult.items.map((item) => ({
      ...item,
      priceReview: buildRecommendationForItem(item, analyticsGroups, activeTab === 'auctions' ? 'bid' : 'standard'),
    })),
    [activeTab, analyticsGroups, currentResult.items],
  );

  const saveSinglePawnStore = async () => {
    if (pawnStoreSaving) return;
    const url = sanitizePawnInput(pawnStoreUrl);
    if (!url) return;
    setPawnStoreSaving(true);
    setPawnStoreError('');
    setPawnStoreMessage('');
    try {
      const data = await api.post('/utils/ebay/pawns', { url });
      setPawnStores(Array.isArray(data?.stores) ? data.stores : []);
      if (data?.duplicate) {
        setPawnStoreMessage(`Ese pawn ya estaba guardado: ${data?.saved?.storeName || 'Tienda'}`);
      } else {
        setPawnStoreUrl('');
        setPawnStoreMessage(`Pawn guardado: ${data?.saved?.storeName || 'Tienda'}`);
        loadPawns({ append: false });
      }
    } catch (err) {
      setPawnStoreError(String(err?.message || 'No se pudo guardar la tienda.'));
    } finally {
      setPawnStoreSaving(false);
    }
  };

  const saveBulkPawnStores = async () => {
    if (pawnStoreSaving) return;
    const text = sanitizePawnBulkText(pawnStoreBulkText);
    if (!text) return;
    setPawnStoreSaving(true);
    setPawnStoreError('');
    setPawnStoreMessage('');
    try {
      const data = await api.post('/utils/ebay/pawns/bulk', { text });
      setPawnStores(Array.isArray(data?.stores) ? data.stores : []);
      setPawnStoreBulkText('');
      const addedCount = Array.isArray(data?.added) ? data.added.length : 0;
      const skippedCount = Array.isArray(data?.skipped) ? data.skipped.length : 0;
      setPawnStoreMessage(`Bulk guardado: ${addedCount} agregadas${skippedCount ? `, ${skippedCount} omitidas` : ''}`);
      loadPawns({ append: false });
    } catch (err) {
      setPawnStoreError(String(err?.message || 'No se pudieron guardar las tiendas.'));
    } finally {
      setPawnStoreSaving(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || currentLoading || currentAppending || !currentHasMore) return () => {};

    const observer = new IntersectionObserver((entries) => {
      if (!entries[0]?.isIntersecting) return;
      if (activeTab === 'pawns') loadPawns({ append: true });
      if (activeTab === 'product') loadProductSearch({ append: true });
      if (activeTab === 'auctions') loadAppleAuctions({ append: true });
    }, { rootMargin: '2600px 0px', threshold: 0.01 });

    observer.observe(node);
    return () => observer.disconnect();
  }, [activeTab, currentHasMore, currentLoading, currentAppending, pawnResult.items.length, productResult.items.length, auctionResult.items.length, pawnCondition, pawnBuyingOptions, productCondition, productBuyingOptions, auctionFamily, auctionCondition, productType]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff_0%,_#f8fafc_45%,_#e2e8f0_100%)] p-4 sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-6 rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">eBay Explorer</div>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900 sm:text-4xl">Busqueda Apple</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">Carga {PAGE_SIZE} resultados y sigue trayendo mas al bajar.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SectionToggle activeTab={activeTab} onChange={setActiveTab} />
              <button
                type="button"
                onClick={() => setVista('home')}
                className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Volver
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr,1fr]">
          <div className={`rounded-[2rem] border p-5 shadow-sm transition ${activeTab === 'pawns' ? 'border-sky-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Buscar por pawns</h2>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr),minmax(0,220px),minmax(0,220px),auto]">
              <FieldShell label="Palabra clave">
                <input
                  value={pawnQuery}
                  onChange={(e) => setPawnQuery(e.target.value)}
                  placeholder="apple"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
                />
              </FieldShell>
              <FieldShell label="Condicion">
                <MappedSelectField value={pawnCondition} onChange={(e) => setPawnCondition(e.target.value)} options={COMMON_CONDITION_OPTIONS} />
              </FieldShell>
              <FieldShell label="Oferta">
                <MappedSelectField value={pawnBuyingOptions} onChange={(e) => setPawnBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} />
              </FieldShell>
              <button
                type="button"
                onClick={() => { setActiveTab('pawns'); loadPawns({ append: false }); }}
                disabled={loadingTab === 'pawns'}
                className="self-end rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingTab === 'pawns' ? 'Buscando...' : 'Buscar pawns'}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPawnStoresModalOpen(true)}
                className="rounded-2xl bg-slate-100/80 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
              >
                {pawnStores.length} pawns guardados
              </button>
              <button
                type="button"
                onClick={exportPawnStores}
                disabled={!pawnStores.length}
                className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Exportar txt
              </button>
              <button
                type="button"
                onClick={() => {
                  setPawnStoreMode((prev) => (prev === 'single' ? '' : 'single'));
                  setPawnStoreMessage('');
                  setPawnStoreError('');
                }}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${pawnStoreMode === 'single' ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-700 hover:text-slate-900'}`}
              >
                Agregar pawn
              </button>
              <button
                type="button"
                onClick={() => {
                  setPawnStoreMode((prev) => (prev === 'bulk' ? '' : 'bulk'));
                  setPawnStoreMessage('');
                  setPawnStoreError('');
                }}
                className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${pawnStoreMode === 'bulk' ? 'bg-sky-100 text-sky-900' : 'bg-slate-100 text-slate-700 hover:text-slate-900'}`}
              >
                Bulk
              </button>
            </div>

            {pawnStoreMode === 'single' && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,1fr),auto]">
                <FieldShell label="Link completo">
                    <input
                      value={pawnStoreUrl}
                      onChange={(e) => setPawnStoreUrl(e.target.value)}
                      onBlur={(e) => setPawnStoreUrl(sanitizePawnInput(e.target.value))}
                      placeholder="https://www.ebay.com/str/... o /usr/..."
                      className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
                    />
                </FieldShell>
                <button
                  type="button"
                  onClick={saveSinglePawnStore}
                  disabled={pawnStoreSaving || !String(pawnStoreUrl || '').trim()}
                  className="self-end rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pawnStoreSaving ? 'Guardando...' : 'Guardar pawn'}
                </button>
              </div>
            )}

            {pawnStoreMode === 'bulk' && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <FieldShell label="Links completos">
                    <textarea
                      value={pawnStoreBulkText}
                      onChange={(e) => setPawnStoreBulkText(normalizeBulkPawnText(e.target.value))}
                      onBlur={(e) => setPawnStoreBulkText(sanitizePawnBulkText(e.target.value))}
                      onPaste={(e) => {
                        const pastedText = e.clipboardData?.getData('text') || '';
                        if (!pastedText) return;
                        e.preventDefault();
                        const { selectionStart = 0, selectionEnd = 0 } = e.currentTarget;
                        const currentText = String(pawnStoreBulkText || '');
                        const nextText = buildBulkPawnPasteText(currentText, pastedText, selectionStart, selectionEnd);
                        setPawnStoreBulkText(sanitizePawnBulkText(normalizeBulkPawnText(nextText)));
                      }}
                    placeholder={'https://www.ebay.com/str/tienda-1\nhttps://www.ebay.com/usr/usuario-2'}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
                  />
                </FieldShell>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={saveBulkPawnStores}
                    disabled={pawnStoreSaving || !String(pawnStoreBulkText || '').trim()}
                    className="rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pawnStoreSaving ? 'Guardando...' : 'Guardar bulk'}
                  </button>
                </div>
              </div>
            )}

            {pawnStoreMessage && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pawnStoreMessage}
              </div>
            )}

            {pawnStoreError && (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {pawnStoreError}
              </div>
            )}
          </div>

          <div className={`rounded-[2rem] border p-5 shadow-sm transition ${activeTab === 'product' ? 'border-amber-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Buscar por producto</h2>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {FAMILY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setProductType(option.id)}
                  className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${productType === option.id ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {productType === 'ipad' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                <FieldShell label="Pantalla"><SelectField value={ipadForm.screen} onChange={(e) => setIpadForm((prev) => ({ ...prev, screen: e.target.value }))} options={IPAD_SCREEN_OPTIONS} /></FieldShell>
                <FieldShell label="Procesador"><SelectField value={ipadForm.processor} onChange={(e) => setIpadForm((prev) => ({ ...prev, processor: e.target.value }))} options={IPAD_PROCESSOR_OPTIONS} /></FieldShell>
                <FieldShell label="Almacenamiento"><SelectField value={ipadForm.storage} onChange={(e) => setIpadForm((prev) => ({ ...prev, storage: e.target.value }))} options={IPAD_STORAGE_OPTIONS} /></FieldShell>
                <FieldShell label="Conectividad"><MappedSelectField value={ipadForm.connectivity} onChange={(e) => setIpadForm((prev) => ({ ...prev, connectivity: e.target.value }))} options={IPAD_CONNECTIVITY_OPTIONS} /></FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={COMMON_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'iphone' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <FieldShell label="Numero">
                  <SelectField
                    value={iphoneForm.number}
                    onChange={(e) => {
                      const nextNumber = e.target.value;
                      const nextAllowed = getIphoneModelOptions(nextNumber).map((option) => option.value);
                      setIphoneForm((prev) => ({ number: nextNumber, model: nextAllowed.includes(prev.model) ? prev.model : '' }));
                    }}
                    options={['13', '14', '15', '16', '17']}
                    placeholder="Numero"
                  />
                </FieldShell>
                <FieldShell label="Modelo"><MappedSelectField value={iphoneForm.model} onChange={(e) => setIphoneForm((prev) => ({ ...prev, model: e.target.value }))} options={getIphoneModelOptions(iphoneForm.number)} /></FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={COMMON_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'macbook' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <FieldShell label="Linea"><MappedSelectField value={macbookForm.line} onChange={(e) => setMacbookForm((prev) => ({ ...prev, line: e.target.value }))} options={MACBOOK_LINE_OPTIONS} /></FieldShell>
                <FieldShell label="Pantalla"><SelectField value={macbookForm.screen} onChange={(e) => setMacbookForm((prev) => ({ ...prev, screen: e.target.value }))} options={MACBOOK_SCREEN_OPTIONS} /></FieldShell>
                <FieldShell label="Procesador"><SelectField value={macbookForm.processor} onChange={(e) => setMacbookForm((prev) => ({ ...prev, processor: e.target.value }))} options={MACBOOK_PROCESSOR_OPTIONS} /></FieldShell>
                <FieldShell label="RAM"><SelectField value={macbookForm.ram} onChange={(e) => setMacbookForm((prev) => ({ ...prev, ram: e.target.value }))} options={MACBOOK_RAM_OPTIONS} /></FieldShell>
                <FieldShell label="Almacenamiento"><SelectField value={macbookForm.storage} onChange={(e) => setMacbookForm((prev) => ({ ...prev, storage: e.target.value }))} options={MACBOOK_STORAGE_OPTIONS} /></FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={COMMON_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'all' && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-100/80 p-4 text-sm text-slate-600">Busca todo junto: iPad, iPhone unlocked y MacBook, ordenado de mas reciente a mas antiguo.</div>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={COMMON_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => { setActiveTab('product'); loadProductSearch({ append: false }); }}
                disabled={loadingTab === 'product'}
                className="rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingTab === 'product' ? 'Buscando...' : 'Buscar producto'}
              </button>
            </div>
          </div>
        </div>

        <div className={`mb-6 rounded-[2rem] border p-5 shadow-sm transition ${activeTab === 'auctions' ? 'border-violet-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Buscar todos en subastas</h2>
              <p className="mt-2 text-sm text-slate-600">Subastas Apple ordenadas por las primeras en terminar. En iPad se limita a 11, 12.9 y 13 pulgadas con chips A16 y M1 a M5.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <MappedSelectField value={auctionFamily} onChange={(e) => setAuctionFamily(e.target.value)} options={FAMILY_OPTIONS.map((item) => ({ value: item.id, label: item.label }))} />
              <MappedSelectField value={auctionCondition} onChange={(e) => setAuctionCondition(e.target.value)} options={AUCTION_CONDITION_OPTIONS} />
              <button
                type="button"
                onClick={() => { setActiveTab('auctions'); loadAppleAuctions({ append: false }); }}
                disabled={loadingTab === 'auctions'}
                className="rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingTab === 'auctions' ? 'Buscando...' : 'Cargar subastas'}
              </button>
            </div>
          </div>
        </div>

        {currentError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{currentError}</div>}

        <div className="mb-4 flex flex-col gap-2 rounded-[2rem] border border-slate-200 bg-white px-5 py-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentLoading && currentResult.items.length === 0 ? 'Cargando resultados...' : `${currentResult.items.length} resultados visibles`}</div>
            <div className="mt-1 text-sm text-slate-600">
              Orden: <strong>{activeTab === 'auctions' ? 'primeros en terminar' : 'mas reciente a mas antiguo'}</strong>
            </div>
          </div>
          <div className="text-sm text-slate-600">
            {currentAppending ? 'Precargando...' : currentHasMore ? 'Carga anticipada activa' : `${currentResult.total} totales`}
          </div>
        </div>

        {!currentLoading && currentResult.items.length > 0 && (
          <ResultsGrid
            items={currentItems}
            titleSource={activeTab === 'pawns' ? 'store' : 'seller'}
            dateField={activeTab === 'auctions' ? 'end' : 'origin'}
            priceMode={activeTab === 'auctions' ? 'bid' : 'standard'}
          />
        )}

        {!currentLoading && !currentError && currentResult.items.length === 0 && (
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
            No se encontraron productos para esa combinacion.
          </div>
        )}

        {pawnStoresModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Pawns guardados</h3>
                  <div className="text-sm text-slate-500">{pawnStores.length} tiendas persistidas</div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={exportPawnStores}
                    disabled={!pawnStores.length}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Exportar txt
                  </button>
                  <button
                    type="button"
                    onClick={() => setPawnStoresModalOpen(false)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(80vh-88px)] overflow-auto p-5">
                {pawnStores.length > 0 ? (
                  <div className="space-y-3">
                    {pawnStores.map((store) => (
                      <div
                        key={`${store.seller}-${store.storeUrl}`}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="text-base font-semibold text-slate-900">{store.storeName}</div>
                        <div className="mt-1 text-sm text-slate-500">Seller: {store.seller}</div>
                        <a
                          href={store.storeUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          Abrir tienda
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    No hay pawns guardados.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={sentinelRef} className="h-10" />
      </div>
    </div>
  );
}

export default Ebay;
