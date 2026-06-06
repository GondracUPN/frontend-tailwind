/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';
import { TC_FIJO } from '../utils/tipoCambio';

const PAGE_SIZE = 140;
const PRODUCT_SEARCH_BATCH_REQUEST_LIMIT = 10;
const PRODUCT_SEARCH_MIN_VISIBLE_RESULTS = 14;
const PRODUCT_SEARCH_SCAN_PAGES_PER_REQUEST = 1;
const EBAY_VIEWED_ITEMS_KEY = 'ebay:viewed-items:v1';
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
  hasMore: false,
  cacheOffset: 0,
  preferCache: false,
  queryStates: [],
  nextQueryIndex: 0,
  pendingItems: [],
};

const FAMILY_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'ipad', label: 'iPad' },
  { id: 'iphone', label: 'iPhone' },
  { id: 'macbook', label: 'MacBook' },
  { id: 'imac', label: 'iMac' },
  { id: 'mac-mini', label: 'Mac mini' },
  { id: 'apple-watch', label: 'Apple Watch' },
  { id: 'keyword', label: 'Palabra clave' },
];
const AUCTION_FAMILY_OPTIONS = [
  { id: 'all', label: 'Todos' },
  { id: 'ipad', label: 'iPad' },
  { id: 'iphone', label: 'iPhone 13-17' },
  { id: 'macbook', label: 'MacBook' },
  { id: 'imac', label: 'iMac' },
  { id: 'mac-mini', label: 'Mac mini' },
  { id: 'apple-watch', label: 'Watch S11/SE3' },
  { id: 'apple-watch-ultra', label: 'Apple Watch Ultra' },
];

const IPAD_LINE_OPTIONS = [
  { value: '', label: 'Cualquiera' },
  { value: 'normal', label: 'Normal' },
  { value: 'air', label: 'Air' },
  { value: 'pro', label: 'Pro' },
];
const IPAD_NUMBER_OPTIONS = ['', '10', '11'];
const IPAD_SCREEN_OPTIONS = ['', '11', '12.9', '13'];
const IPAD_AIR_SCREEN_OPTIONS = ['', '10.9', '11', '13'];
const IPAD_PRO_SCREEN_OPTIONS = ['', '11', '12.9', '13'];
const IPAD_PROCESSOR_OPTIONS = ['', 'A16', 'M1', 'M2', 'M3', 'M4', 'M5'];
const IPAD_AIR_PROCESSOR_OPTIONS = ['', 'M1', 'M2', 'M3', 'M4', 'M5'];
const IPAD_PRO_PROCESSOR_OPTIONS = ['', 'M1', 'M2', 'M4', 'M5'];
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
const MACBOOK_AIR_SCREEN_OPTIONS = ['', '13', '15'];
const MACBOOK_PRO_SCREEN_OPTIONS = ['', '13', '14', '16'];
const MACBOOK_PROCESSOR_OPTIONS = [
  '',
  'M1',
  'M1 Pro',
  'M1 Max',
  'M1 Ultra',
  'M2',
  'M2 Pro',
  'M2 Max',
  'M2 Ultra',
  'M3',
  'M3 Pro',
  'M3 Max',
  'M3 Ultra',
  'M4',
  'M4 Pro',
  'M4 Max',
  'M4 Ultra',
  'M5',
  'M5 Pro',
  'M5 Max',
  'M5 Ultra',
];
const MACBOOK_AIR_PROCESSOR_OPTIONS = ['', 'M1', 'M2', 'M3', 'M4', 'M5'];
const MACBOOK_PRO_PROCESSOR_OPTIONS = MACBOOK_PROCESSOR_OPTIONS;
const MACBOOK_RAM_OPTIONS = ['', '8GB', '16GB', '18GB', '24GB', '32GB', '36GB', '48GB', '64GB'];
const MACBOOK_STORAGE_OPTIONS = ['', '256GB', '512GB', '1TB', '2TB', '4TB', '8TB'];
const TARGET_MACBOOK_MODEL_NUMBERS = [
  'a2337', 'a2338', 'a2442', 'a2485', 'a2681', 'a2779', 'a2780', 'a2918',
  'a2941', 'a2991', 'a2992', 'a3112', 'a3113', 'a3114', 'a3185', 'a3186',
  'a3240', 'a3241', 'a3401', 'a3403', 'a3426', 'a3427', 'a3428', 'a3429',
  'a3434', 'a3448', 'a3449',
];
const TARGET_IPAD_MODEL_NUMBERS = [
  'a2316', 'a2324', 'a2072', 'a2325', 'a2588', 'a2589', 'a2591',
  'a2377', 'a2301', 'a2459', 'a2460', 'a2378', 'a2379', 'a2461', 'a2462',
  'a2759', 'a2435', 'a2761', 'a2762', 'a2436', 'a2764', 'a2437', 'a2766',
  'a2836', 'a2837', 'a3006', 'a2925', 'a2926', 'a3007',
  'a2902', 'a2903', 'a2904', 'a2898', 'a2899', 'a2900',
  'a3266', 'a3267', 'a3270', 'a3268', 'a3269', 'a3271',
  'a3459', 'a3460', 'a3463', 'a3461', 'a3462', 'a3464',
  'a3354', 'a3355', 'a3356', 'a3357', 'a3358', 'a3359', 'a3360', 'a3361', 'a3362',
];
const TARGET_IPHONE_MODEL_NUMBERS = [
  'a2482', 'a2631', 'a2633', 'a2634', 'a2635', 'a2483', 'a2636', 'a2638', 'a2639', 'a2640',
  'a2484', 'a2641', 'a2643', 'a2644', 'a2645', 'a2649', 'a2881', 'a2882', 'a2883', 'a2884',
  'a2632', 'a2885', 'a2886', 'a2887', 'a2888', 'a2650', 'a2889', 'a2890', 'a2891', 'a2892',
  'a2651', 'a2893', 'a2894', 'a2895', 'a2896', 'a2846', 'a3089', 'a3090', 'a3092',
  'a2847', 'a3093', 'a3094', 'a3096', 'a2848', 'a3101', 'a3102', 'a3104',
  'a2849', 'a3105', 'a3106', 'a3108', 'a3081', 'a3286', 'a3287', 'a3288',
  'a3082', 'a3289', 'a3290', 'a3291', 'a3083', 'a3292', 'a3293', 'a3294',
  'a3084', 'a3295', 'a3296', 'a3297', 'a3212', 'a3408', 'a3409', 'a3410',
  'a3258', 'a3519', 'a3520', 'a3521', 'a3256', 'a3522', 'a3523', 'a3524',
  'a3257', 'a3525', 'a3526', 'a3527', 'a3260', 'a3516', 'a3517', 'a3518',
  'a3575', 'a3634', 'a3635',
];
const TARGET_IMAC_MODEL_NUMBERS = ['a2438', 'a2439', 'a2873', 'a2874', 'a3137', 'a3247'];
const TARGET_MAC_MINI_MODEL_NUMBERS = ['a2348', 'a2686', 'a2816', 'a3238', 'a3239'];
const TARGET_WATCH_SERIES_11_MODEL_NUMBERS = ['a3331', 'a3333', 'a3450', 'a3451', 'a3335', 'a3337', 'a3452', 'a3453'];
const TARGET_WATCH_SE3_MODEL_NUMBERS = ['a3324', 'a3325', 'a3391', 'a3392', 'a3326', 'a3328', 'a3327', 'a3329'];
const TARGET_WATCH_ULTRA_MODEL_NUMBERS = ['a2622', 'a2684', 'a2859', 'a2986', 'a2987', 'a3281', 'a3282'];
const TARGET_MACBOOK_ORDER_CODES = [
  'mgn63', 'mgn73', 'mly33', 'mly43', 'mqkw3', 'mrxv3', 'mrxw3', 'mryu3',
  'mc6t4', 'mc6u4', 'mc7a4', 'mdhh4', 'mdhj4', 'mdvq4', 'myda2', 'mkgr3',
  'mkgt3', 'mk1e3', 'mk1h3', 'mneh3', 'mphe3', 'mphf3', 'mphg3', 'mnw83',
  'mnwa3', 'mtl73', 'mrx33', 'mrx43', 'mrx53', 'mrw13', 'mrw33', 'muw63',
  'mw2w3', 'mx2e3', 'mx2f3', 'mx2g3', 'mx2t3', 'mx2v3', 'mx2w3', 'mde44',
  'mgdn4', 'mgdp4', 'mgdq4', 'mge44', 'mge74', 'mge94',
];
const TARGET_IPAD_ORDER_CODES = [
  'mhqt3', 'mhmu3', 'mhw63', 'mhwh3', 'mhng3', 'mhnt3', 'mhr53', 'mhrg3',
  'mnxe3', 'mp563', 'mnyd3', 'mnyp3', 'mnxq3', 'mp5y3', 'mp1y3', 'mp293',
  'mvv93', 'mvw23', 'mvwa3', 'mvx33', 'mvxt3', 'mvy23', 'mdwl4', 'me2p4',
  'me6f4', 'mdyk4', 'me7x4', 'me8q4', 'myfn2', 'myhy2', 'mygx2', 'myhm2',
  'mm9c3', 'mm6r3', 'mm753', 'muwd3', 'muxe3', 'muxx3', 'mv283', 'mv6r3',
  'mv793', 'mc9x4', 'mcfw4', 'mcge4', 'mcnj4', 'mcj24', 'mcjk4', 'mh314',
  'mh794', 'mh8c4', 'mh5p4', 'mh9e4', 'mh9x4', 'md3y4', 'md7f4', 'md7u4',
];
const TARGET_IMAC_ORDER_CODES = [
  'mjv93', 'mgpk3', 'mqrc3', 'mqrq3', 'mwuf3', 'mwue3', 'mwug3', 'mwuc3', 'mwv13',
];
const TARGET_MAC_MINI_ORDER_CODES = ['mgnr3', 'mgnt3', 'mnh73', 'mu9d3', 'mu9e3', 'mcyt4'];
const COMMON_CONDITION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'used', label: 'Used' },
  { value: 'for_parts', label: 'For parts or not working' },
  { value: 'open_box', label: 'Open box' },
  { value: 'new', label: 'New' },
];
const PRODUCT_CONDITION_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'full', label: 'Full' },
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

const getItemListedTime = (item) =>
  Date.parse(item?.itemOriginDate || item?.itemCreationDate || '') || 0;

const sortItemsByListedDate = (items) =>
  [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const timeDifference = getItemListedTime(b) - getItemListedTime(a);
    if (timeDifference !== 0) return timeDifference;
    return getItemKey(b).localeCompare(getItemKey(a));
  });

const keepItemsOlderThanVisibleTail = (visibleItems, nextItems) => {
  if (!Array.isArray(visibleItems) || visibleItems.length === 0) return nextItems;
  const tailTime = getItemListedTime(visibleItems[visibleItems.length - 1]);
  if (!tailTime) return nextItems;
  return nextItems.filter((item) => {
    const itemTime = getItemListedTime(item);
    return !itemTime || itemTime <= tailTime;
  });
};

const formatNumber = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('en-US').format(num);
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

const getIpadNumberOptions = () => IPAD_NUMBER_OPTIONS;

const getIpadScreenOptions = (line) => {
  if (line === 'air') return IPAD_AIR_SCREEN_OPTIONS;
  if (line === 'pro') return IPAD_PRO_SCREEN_OPTIONS;
  return IPAD_SCREEN_OPTIONS;
};

const getIpadProcessorOptions = (line) => {
  if (line === 'air') return IPAD_AIR_PROCESSOR_OPTIONS;
  if (line === 'pro') return IPAD_PRO_PROCESSOR_OPTIONS;
  return IPAD_PROCESSOR_OPTIONS;
};

const getMacbookScreenOptions = (line) => {
  if (line === 'Air') return MACBOOK_AIR_SCREEN_OPTIONS;
  if (line === 'Pro') return MACBOOK_PRO_SCREEN_OPTIONS;
  return MACBOOK_SCREEN_OPTIONS;
};

const getMacbookProcessorOptions = (line) => {
  if (line === 'Air') return MACBOOK_AIR_PROCESSOR_OPTIONS;
  if (line === 'Pro') return MACBOOK_PRO_PROCESSOR_OPTIONS;
  return MACBOOK_PROCESSOR_OPTIONS;
};

const buildIpadQuery = (form) => {
  const parts = ['apple', 'ipad'];
  if (compactValue(form.line) && form.line !== 'normal') parts.push(form.line);
  if (compactValue(form.number)) {
    const number = compactValue(form.number);
    parts.push(form.line === 'mini' ? `${number}th generation` : `${number}th generation`);
  }
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

const uniqueStrings = (values) => Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const textIncludesKeyword = (title, keyword) => {
  const normalizedTitle = normalizeTitleText(title);
  const tokens = normalizeTitleText(keyword).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  return tokens.every((token) => normalizedTitle.includes(token));
};

const hasAnyProductFormValue = (form) =>
  Object.values(form || {}).some((value) => compactValue(value));

const buildProductSearchQueries = ({ productType, ipadForm, iphoneForm, macbookForm, keyword }) => {
  if (productType === 'keyword') {
    return uniqueStrings([compactValue(keyword) || 'apple']);
  }
  if (productType === 'ipad') {
    const queries = hasAnyProductFormValue(ipadForm) ? [buildIpadQuery(ipadForm)] : ['apple ipad'];
    return uniqueStrings(queries);
  }
  if (productType === 'iphone') {
    const queries = hasAnyProductFormValue(iphoneForm) ? [buildIphoneQuery(iphoneForm)] : ['apple iphone'];
    return uniqueStrings(queries);
  }
  if (productType === 'macbook') {
    const queries = hasAnyProductFormValue(macbookForm) ? [buildMacbookQuery(macbookForm)] : ['apple macbook'];
    return uniqueStrings(queries);
  }
  if (productType === 'imac') {
    return ['apple imac'];
  }
  if (productType === 'mac-mini') {
    return ['apple mac mini'];
  }
  if (productType === 'apple-watch') {
    return ['apple watch'];
  }
  return ['apple'];
};

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

const titleHasStorage = (title, storage) => {
  const normalized = normalizeTitleText(title);
  const target = compactValue(storage).toLowerCase();
  if (!target) return true;
  const spaced = target.replace('gb', ' gb').replace('tb', ' tb').trim();
  return normalized.includes(spaced) || normalized.includes(target);
};

const titleHasRam = (title, ram) => {
  const normalized = normalizeTitleText(title);
  const target = compactValue(ram).toLowerCase();
  if (!target) return true;
  const spaced = target.replace('gb', ' gb').trim();
  return normalized.includes(spaced) || normalized.includes(target);
};

const titleHasProcessor = (title, processor) => {
  const normalized = normalizeTitleText(title);
  const target = compactValue(processor).toLowerCase();
  if (!target) return true;
  const pattern = target.split(/\s+/).map((part) => escapeRegex(part)).join('\\s+');
  return new RegExp(`\\b${pattern}\\b`).test(normalized);
};

const titleHasGenerationNumber = (title, number) => {
  const normalized = normalizeTitleText(title);
  const target = compactValue(number);
  if (!target) return true;
  const ordinal = `${target}(?:st|nd|rd|th)`;
  return new RegExp(`\\b(?:${ordinal}\\s*(?:gen|generation)?|gen(?:eration)?\\s*${target}|${target}\\s*(?:gen|generation))\\b`).test(normalized);
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
  'charging station',
  'charging stand',
  'charging dock',
  'cable',
  'adapter',
  'stand',
  'dock',
  'station',
  'holder',
  'mount',
  'cradle',
  'protector',
  'screen protector',
  'stylus',
  'pen',
  'band',
  'strap',
  'loop',
  'replacement',
  'housing',
  'digitizer',
  'lcd',
  'glass',
  'empty box',
  'box only',
  'bundle only',
];

const ACCESSORY_PRIMARY_PATTERNS = [
  /^(?:apple\s+)?(?:(?:laptop|tablet|phone|cell\s+phone|smartphone)\s+)?(?:case|sleeve|cover|folio|keyboard|magic keyboard|smart folio|screen protector|protector|pencil|charger|adapter|cable|bag|shell|skin|band|strap|loop|stand|dock|station|holder|mount|cradle|housing|digitizer|lcd|glass)\b/,
  /\b(?:laptop|tablet|phone|cell\s+phone|smartphone)\s+(?:case|sleeve|cover|folio|keyboard|screen protector|protector|bag|shell)\b/,
  /\b(?:case|sleeve|cover|folio|keyboard|screen protector|protector|bag|shell|band|strap|loop|stand|dock|station|holder|mount|cradle)\b.{0,80}\bfor\s+(?:new\s+)?(?:the\s+)?(?:apple\s+)?(?:macbook|ipad|iphone|watch|airpods?)\b/,
  /\b(?:charging|wireless|alarm\s+clock).{0,40}(?:station|stand|dock|base|holder|mount|cradle)\b/,
  /\b(?:station|stand|dock|base|holder|mount|cradle)\b.{0,80}\b(?:iphone|ipad|apple\s+watch|watch|airpods?)\b/,
  /\b(?:3\s*-?\s*in\s*-?\s*1|2\s*-?\s*in\s*-?\s*1|multi\s*device)\b.{0,80}\b(?:charger|charging|station|stand|dock)\b/,
  /\b(?:empty\s+box|box\s+only|no\s+(?:airpods?|iphone|ipad|watch|macbook)|packaging\s+only|retail\s+box\s+only)\b/,
  /\bcompatible with\b/,
  /\bdesigned for\b/,
  /\bfits?\s+(?:new\s+)?(?:the\s+)?(?:apple\s+)?(?:macbook|ipad|iphone|watch|airpods?)\b/,
  /\bfor\s+(?:new\s+)?(?:the\s+)?(?:apple\s+)?(?:macbook|ipad|iphone|watch|airpods?)\b/,
  /\breplacement\b/,
];

const EXCLUDED_APPLE_PRODUCT_TITLE_PATTERNS = [
  /\b(?:empty\s+box|box\s+only|no\s+(?:airpods?|iphone|ipad|watch|macbook)|packaging\s+only|retail\s+box\s+only)\b/,
  /\b(?:charging|wireless|alarm\s+clock).{0,50}(?:station|stand|dock|base|holder|mount|cradle)\b/,
  /\b(?:station|stand|dock|base|holder|mount|cradle)\b.{0,100}\b(?:iphone|ipad|apple\s+watch|watch|airpods?)\b/,
  /\b(?:3\s*-?\s*in\s*-?\s*1|2\s*-?\s*in\s*-?\s*1|multi\s*device)\b.{0,100}\b(?:charger|charging|station|stand|dock)\b/,
];

const isExcludedAppleProductTitle = (title) => {
  const normalized = normalizeTitleText(title);
  return EXCLUDED_APPLE_PRODUCT_TITLE_PATTERNS.some((pattern) => pattern.test(normalized));
};

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

const MACBOOK_ALLOWED_CHIP_PATTERN = /\bm[1-5](?:\s+(?:pro|max|ultra))?\b/;
const MACBOOK_INTEL_PATTERN = /\b(?:intel|core\s+i[3579]|i[3579][-\s]?\d{3,5})\b/;
const MACBOOK_BAD_SCREEN_PATTERN = /\b(?:11|12)(?:\.\d+)?\s*(?:inch|in|")?\b/;
const IPHONE_ALLOWED_PATTERN = /\biphone\s*(?:13|14|15|16|17)\b|\biphone\s*(?:16|17)\s*e\b|\b(?:16|17)e\b/;
const BLOCKED_IPHONE_PATTERN =
  /\b(?:carrier|network|sim|activation|icloud|finance|financed|mdm)\s*locked\b|\b(?:verizon|at\s*&?\s*t|att|t[\s-]*mobile|sprint|cricket|boost|metro(?:pcs)?|xfinity|spectrum|tracfone|straight\s+talk|us\s+cellular)\b|\bbad\s+esn\b|\bblacklisted\b|\bnot\s+unlocked\b/;
const EXTERNAL_BRAND_PATTERN =
  /\b(?:samsung|galaxy|google\s+pixel|motorola|moto|xiaomi|huawei|oneplus|oppo|vivo|dell|lenovo|thinkpad|hp|hewlett\s+packard|asus|acer|microsoft|surface|sony|nokia|lg)\b/;

const hasTargetModelNumber = (normalized, modelNumbers) =>
  modelNumbers.some((model) => new RegExp(`\\b${model}\\b`).test(normalized));

const hasTargetOrderCode = (title, orderCodes) => {
  const compact = normalizeTitleText(title).replace(/[^a-z0-9]/g, '');
  return orderCodes.some((code) => compact.includes(String(code).toLowerCase()));
};

const isTargetIpadTitle = (normalized) => {
  if (
    hasTargetModelNumber(normalized, TARGET_IPAD_MODEL_NUMBERS) ||
    hasTargetOrderCode(normalized, TARGET_IPAD_ORDER_CODES)
  ) return true;
  if (!normalized.includes('ipad') || /\bipad\s+mini\b/.test(normalized)) return false;
  if (/\bipad\b.*\b(?:a16|11th|eleventh)\b|\b(?:a16|11th|eleventh)\b.*\bipad\b/.test(normalized)) return true;
  if (/\bipad\s+air\b/.test(normalized)) {
    return /\b(?:4th|fourth|5th|fifth)\b/.test(normalized) || /\bm[1-4]\b/.test(normalized);
  }
  if (/\bipad\s+pro\b/.test(normalized)) {
    if (/\bm[1-5]\b/.test(normalized)) return true;
    if (/\b11(?:\.\d+)?\s*(?:inch|in)?\b/.test(normalized)) {
      return /\b(?:3rd|third|4th|fourth|5th|fifth|6th|sixth|7th|seventh)\b/.test(normalized);
    }
    if (/\b(?:12\.9|13)(?:\s*(?:inch|in))?\b/.test(normalized)) {
      return /\b(?:5th|fifth|6th|sixth|7th|seventh)\b/.test(normalized);
    }
  }
  return false;
};

const isTargetImacTitle = (normalized) =>
  !EXTERNAL_BRAND_PATTERN.test(normalized) &&
  !isPrimaryAccessoryTitle(normalized) &&
  !MACBOOK_INTEL_PATTERN.test(normalized) && (
    hasTargetModelNumber(normalized, TARGET_IMAC_MODEL_NUMBERS) ||
    hasTargetOrderCode(normalized, TARGET_IMAC_ORDER_CODES) ||
    ((/\bimac\b|\bi\s+mac\b/.test(normalized)) && /\bm[1-5]\b/.test(normalized))
  );

const isTargetMacMiniTitle = (normalized) =>
  !EXTERNAL_BRAND_PATTERN.test(normalized) &&
  !isPrimaryAccessoryTitle(normalized) &&
  !MACBOOK_INTEL_PATTERN.test(normalized) && (
    hasTargetModelNumber(normalized, TARGET_MAC_MINI_MODEL_NUMBERS) ||
    hasTargetOrderCode(normalized, TARGET_MAC_MINI_ORDER_CODES) ||
    ((/\bmac\s*mini\b|\bmacmini\b/.test(normalized)) && /\bm[1-5](?:\s+pro)?\b/.test(normalized))
  );

const isTargetAppleWatchTitle = (normalized) => {
  if (EXTERNAL_BRAND_PATTERN.test(normalized)) return false;
  if (isPrimaryAccessoryTitle(normalized)) return false;
  if (hasTargetModelNumber(normalized, TARGET_WATCH_ULTRA_MODEL_NUMBERS)) return true;
  if (hasTargetModelNumber(normalized, TARGET_WATCH_SERIES_11_MODEL_NUMBERS)) return true;
  if (hasTargetModelNumber(normalized, TARGET_WATCH_SE3_MODEL_NUMBERS)) return true;
  if (!/\bapple\s+watch\b|\biwatch\b/.test(normalized)) return false;
  if (/\bultra(?:\s*[123])?\b/.test(normalized)) return true;
  if (/\bse\s*(?:3|third|3rd)\b/.test(normalized)) return true;
  if (/\b(?:series\s*)?11\b|\bs11\b/.test(normalized)) {
    const statedSize = normalized.match(/\b(\d{2})\s*mm\b/)?.[1];
    return !statedSize || statedSize === '42' || statedSize === '46';
  }
  return false;
};

const isLikelyAppleCatalogTitle = (title) => {
  const normalized = normalizeTitleText(title);
  const compact = normalized.replace(/[\s.+-]+/g, '');
  if (/\bhome\s*pod\b/.test(normalized) || compact.includes('homepod')) return false;
  if (EXTERNAL_BRAND_PATTERN.test(normalized)) return false;
  if (isExcludedAppleProductTitle(normalized)) return false;
  if (isPrimaryAccessoryTitle(normalized)) return false;
  if (isLikelyAppleDeviceTitle(normalized, 'ipad')) return true;
  if (isLikelyAppleDeviceTitle(normalized, 'iphone')) return true;
  if (isLikelyAppleDeviceTitle(normalized, 'macbook')) return true;
  if (isTargetImacTitle(normalized)) return true;
  if (isTargetMacMiniTitle(normalized)) return true;
  if (isTargetAppleWatchTitle(normalized)) return true;
  return false;
};

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
  if (EXTERNAL_BRAND_PATTERN.test(normalized)) return false;
  if (isPrimaryAccessoryTitle(normalized, family)) return false;
  if (family === 'ipad') return isTargetIpadTitle(normalized);
  if (family === 'iphone') {
    if (/\bmini\b/.test(normalized) || BLOCKED_IPHONE_PATTERN.test(normalized)) return false;
    return (normalized.includes('iphone') && IPHONE_ALLOWED_PATTERN.test(normalized)) ||
      hasTargetModelNumber(normalized, TARGET_IPHONE_MODEL_NUMBERS);
  }
  if (family === 'macbook') {
    const hasModelNumber = hasTargetModelNumber(normalized, TARGET_MACBOOK_MODEL_NUMBERS);
    const hasOrderCode = hasTargetOrderCode(normalized, TARGET_MACBOOK_ORDER_CODES);
    return (normalized.includes('macbook') || hasModelNumber || hasOrderCode) &&
      (MACBOOK_ALLOWED_CHIP_PATTERN.test(normalized) || hasModelNumber || hasOrderCode) &&
      !MACBOOK_INTEL_PATTERN.test(normalized) &&
      !MACBOOK_BAD_SCREEN_PATTERN.test(normalized);
  }
  return false;
};

const matchIpadItem = (item, form) => {
  const title = normalizeTitleText(item?.title || '');
  if (!isLikelyAppleDeviceTitle(title, 'ipad')) return false;
  if (form.line === 'normal' && /\b(air|pro|mini)\b/.test(title)) return false;
  if (form.line === 'air' && !/\bair\b/.test(title)) return false;
  if (form.line === 'pro' && !/\bpro\b/.test(title)) return false;
  if (form.line === 'mini' && !/\bmini\b/.test(title)) return false;
  if ((form.line === 'normal' || form.line === 'mini') && !titleHasGenerationNumber(title, form.number)) return false;
  if ((form.line === 'air' || form.line === 'pro' || !form.line) && !titleHasProcessor(title, form.processor)) return false;
  if (compactValue(form.screen) && !titleHasScreen(title, form.screen)) return false;
  if (!titleHasStorage(title, form.storage)) return false;
  if (form.connectivity === 'wifi' && !/\bwifi\b|\bwi fi\b/.test(title)) return false;
  if (form.connectivity === 'cellular' && !/\bcellular\b|\b5g\b|\blte\b|\bunlocked\b/.test(title)) return false;
  return true;
};

const matchMacbookItem = (item, form) => {
  const title = normalizeTitleText(item?.title || '');
  if (!isLikelyAppleDeviceTitle(title, 'macbook')) return false;
  if (form.line === 'Air' && !/\bair\b/.test(title)) return false;
  if (form.line === 'Pro' && !/\bpro\b/.test(title)) return false;
  if (!titleHasProcessor(title, form.processor)) return false;
  if (compactValue(form.screen) && !titleHasScreen(title, form.screen)) return false;
  if (!titleHasRam(title, form.ram)) return false;
  if (!titleHasStorage(title, form.storage)) return false;
  return true;
};

const normalizeIpadFormForLine = (prev, nextLine) => {
  const next = { ...prev, line: nextLine };
  const numberOptions = getIpadNumberOptions(nextLine);
  const screenOptions = getIpadScreenOptions(nextLine);
  const processorOptions = getIpadProcessorOptions(nextLine);
  if (nextLine !== 'normal' && nextLine !== 'mini') next.number = '';
  if ((nextLine === 'normal' || nextLine === 'mini')) next.processor = '';
  if (!numberOptions.includes(next.number)) next.number = '';
  if (!screenOptions.includes(next.screen)) next.screen = '';
  if (!processorOptions.includes(next.processor)) next.processor = '';
  return next;
};

const normalizeMacbookFormForLine = (prev, nextLine) => {
  const next = { ...prev, line: nextLine };
  const screenOptions = getMacbookScreenOptions(nextLine);
  const processorOptions = getMacbookProcessorOptions(nextLine);
  if (!screenOptions.includes(next.screen)) next.screen = '';
  if (!processorOptions.includes(next.processor)) next.processor = '';
  return next;
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

const getItemKey = (item) => String(item?.itemId || item?.legacyItemId || item?.itemWebUrl || '');

const extractEbayLegacyId = (value) => {
  const text = String(value || '');
  const match = text.match(/(?:\/itm\/(?:[^/?#]+\/)?|[?&]item=|[|])(\d{9,15})(?:[|/?#&]|$)/i) ||
    text.match(/\b(\d{9,15})\b/);
  return match?.[1] || '';
};

const getItemViewedKeys = (item) => {
  const keys = [
    item?.itemId,
    item?.legacyItemId,
    item?.itemWebUrl,
    extractEbayLegacyId(item?.itemId),
    extractEbayLegacyId(item?.legacyItemId),
    extractEbayLegacyId(item?.itemWebUrl),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return Array.from(new Set(keys));
};

const getViewedAtForItem = (viewedItems, item) => {
  const keys = getItemViewedKeys(item);
  return keys.map((key) => viewedItems?.[key]).find(Boolean) || '';
};

const readViewedEbayItems = () => {
  try {
    const raw = localStorage.getItem(EBAY_VIEWED_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeViewedEbayItems = (items) => {
  try {
    const entries = Object.entries(items || {})
      .filter(([key, value]) => key && value)
      .sort((left, right) => Date.parse(String(right[1])) - Date.parse(String(left[1])))
      .slice(0, 3000);
    localStorage.setItem(EBAY_VIEWED_ITEMS_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* ignore */
  }
};

const mergeViewedMaps = (...maps) => {
  const merged = {};
  maps.forEach((map) => {
    Object.entries(map || {}).forEach(([key, value]) => {
      if (!key || !value) return;
      const current = merged[key];
      if (!current || Date.parse(String(value)) > Date.parse(String(current))) {
        merged[key] = value;
      }
    });
  });
  return merged;
};

const mergeUniqueItems = (prevItems, nextItems) => {
  const seen = new Set(prevItems.map((item) => getItemKey(item)));
  const merged = [...prevItems];
  nextItems.forEach((item) => {
    const key = getItemKey(item);
    if (!key || seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });
  return merged;
};

const getNextResultOffset = (result) =>
  Number.isFinite(Number(result?.nextOffset))
    ? Math.max(0, Number(result.nextOffset))
    : Math.max(0, Number(result?.offset || 0) + Number(result?.limit || PAGE_SIZE));

const getResponseNextOffset = (data, fallbackOffset) => {
  const currentOffset = Number(data?.offset ?? fallbackOffset);
  const limit = Number(data?.limit || PAGE_SIZE);
  const inferred = (Number.isFinite(currentOffset) ? currentOffset : fallbackOffset) + (Number.isFinite(limit) ? limit : PAGE_SIZE);
  const explicit = Number(data?.nextOffset);
  if (Number.isFinite(explicit) && explicit > fallbackOffset) return explicit;
  return Math.max(fallbackOffset + 1, inferred);
};

function SectionToggle({ activeTab, onChange }) {
  const tabs = [
    { id: 'pawns', label: 'Buscar Por Pawns' },
    { id: 'product', label: 'Buscar Por Producto' },
    { id: 'auctions', label: 'Subastas Apple' },
  ];

  return (
    <div className="grid w-full grid-cols-2 rounded-2xl bg-slate-200 p-1 sm:inline-flex sm:w-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-2xl px-2 py-2 text-xs font-semibold leading-tight transition sm:px-4 sm:text-sm ${
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
    <label className="block min-w-0">
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

function ResultsGrid({ items, titleSource = 'store', dateField = 'origin', priceMode = 'standard', onItemOpen }) {
  const recommendationTone = {
    go: 'bg-emerald-100 text-emerald-800',
    limit: 'bg-amber-100 text-amber-800',
    stop: 'bg-rose-100 text-rose-800',
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7">
      {items.map((item) => {
        const sellerLabel = titleSource === 'seller' ? (item.seller || 'eBay') : (item.storeName || item.seller || 'eBay');
        const feedbackPercent = Number(item.sellerFeedbackPercentage);
        const feedbackScore = Number(item.sellerFeedbackScore);
        const bidAmount = Number.isFinite(Number(item.currentBidPriceUSD)) ? item.currentBidPriceUSD : 0;
        const isViewed = Boolean(item.viewedAt);
        return (
          <a
            key={item.itemId || item.itemWebUrl}
            href={item.itemWebUrl}
            target="_blank"
            rel="noopener noreferrer"
            onMouseDown={(event) => {
              if (event.button === 0 || event.button === 1) onItemOpen?.(item);
            }}
            onAuxClick={() => onItemOpen?.(item)}
            onClick={() => onItemOpen?.(item)}
            className={`group relative overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md sm:rounded-2xl ${
              isViewed ? 'border-slate-300 bg-slate-50 opacity-80' : 'border-slate-200 bg-white'
            }`}
          >
            {isViewed && (
              <div className="absolute right-2 top-2 z-10 rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                Visto
              </div>
            )}
            <div className="aspect-square bg-slate-100">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  loading="lazy"
                  className={`h-full w-full object-cover transition duration-300 group-hover:scale-[1.03] ${isViewed ? 'grayscale-[35%]' : ''}`}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-xs text-slate-400">Sin imagen</div>
              )}
            </div>

            <div className="min-w-0 space-y-1.5 p-2 sm:space-y-2 sm:p-3">
              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:text-[11px]">{sellerLabel}</div>
                {(Number.isFinite(feedbackPercent) || Number.isFinite(feedbackScore)) && (
                  <div className="mt-1 text-[10px] text-slate-500 sm:text-[11px]">
                    {Number.isFinite(feedbackPercent) ? `${feedbackPercent.toFixed(1)}%` : '-'} | {Number.isFinite(feedbackScore) ? `${Math.round(feedbackScore)} reviews` : '0 reviews'}
                  </div>
                )}
              </div>

              <div className="line-clamp-3 min-h-[3rem] break-words text-xs font-semibold leading-4 text-slate-900 sm:min-h-[3.6rem] sm:text-sm sm:leading-5">{item.title}</div>

              {item.priceReview && (
                <div className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] sm:px-2.5 sm:py-1 sm:text-[11px] ${recommendationTone[item.priceReview.tone] || 'bg-slate-100 text-slate-700'}`}>
                  {item.priceReview.label}
                </div>
              )}

              <div className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 sm:rounded-xl sm:px-2.5 sm:py-1.5 sm:text-sm">
                {priceMode === 'bid' ? `Oferta: ${formatPrice(bidAmount, item.currency)}` : formatPrice(item.priceUSD, item.currency)}
              </div>

              <div className="space-y-0.5 break-words text-[10px] text-slate-500 sm:space-y-1 sm:text-[11px]">
                <div>{item.condition || 'Sin condicion'}</div>
                <div>{dateField === 'end' ? `Restante: ${formatRemainingTime(item.itemEndDate)}` : formatDate(item.itemOriginDate || item.itemCreationDate)}</div>
                {item.viewedAt && <div>Visto: {formatDate(item.viewedAt)}</div>}
                {item.status === 'sold_or_ended' && <div className="font-semibold text-rose-600">Vendido o finalizado</div>}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function EbayRateLimitPanel({ data, loading, error, onRefresh }) {
  const primary = data?.summary?.primary || data?.summary?.resources?.[0] || null;
  const used = Number(primary?.count);
  const limit = Number(primary?.limit);
  const remaining = Number(primary?.remaining);
  const percent = Number.isFinite(Number(primary?.usedPercent))
    ? Number(primary.usedPercent)
    : (Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? (used / limit) * 100 : 0);
  const boundedPercent = Math.min(100, Math.max(0, percent));
  const exhausted = Boolean(data?.browseExhausted) || remaining === 0;
  const tone = exhausted
    ? 'border-red-200 bg-red-50'
    : boundedPercent >= 85
      ? 'border-amber-200 bg-amber-50'
      : 'border-emerald-200 bg-emerald-50';
  const barTone = exhausted ? 'bg-red-500' : boundedPercent >= 85 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className={`mb-4 rounded-2xl border px-4 py-4 shadow-sm sm:mb-6 sm:rounded-[2rem] sm:px-5 ${tone}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900">Limite eBay Browse API</div>
            {loading && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-600">Actualizando...</span>}
            {exhausted && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">Sin cuota</span>}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/80">
            <div className={`h-full rounded-full ${barTone}`} style={{ width: `${boundedPercent}%` }} />
          </div>
          <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-4">
            <div>Usado: <strong>{formatNumber(primary?.count)}</strong></div>
            <div>Limite: <strong>{formatNumber(primary?.limit)}</strong></div>
            <div>Queda: <strong>{formatNumber(primary?.remaining)}</strong></div>
            <div>Reset: <strong>{primary?.reset ? formatDate(primary.reset) : '-'}</strong></div>
          </div>
          {error && <div className="mt-2 text-xs font-semibold text-red-700">{error}</div>}
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
        >
          Actualizar limite
        </button>
      </div>
    </div>
  );
}

function EbayLoadingPanel({ progress, tab, compact = false }) {
  if (!progress?.visible) return null;

  const labels = {
    pawns: progress.mode === 'append' ? 'Cargando mas pawns' : 'Buscando en tiendas pawn',
    product: progress.mode === 'append' ? 'Cargando mas productos' : 'Buscando productos',
    auctions: progress.mode === 'append' ? 'Cargando mas subastas' : 'Buscando subastas',
  };
  const percent = Math.max(0, Math.min(100, Math.round(Number(progress.percent || 0))));
  const statusText = percent >= 100
    ? 'Finalizando resultados...'
    : progress.mode === 'append'
      ? 'Cargando el siguiente bloque de resultados...'
      : 'Consultando eBay y preparando resultados...';
  const shellClass = compact
    ? 'mt-3 w-full max-w-md overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm'
    : 'mb-4 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-sm';

  return (
    <div className={shellClass}>
      <div className={`flex gap-3 px-4 ${compact ? 'py-3' : 'py-4'} ${compact ? 'items-center justify-between' : 'flex-col sm:flex-row sm:items-center sm:justify-between'}`}>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{labels[tab] || 'Cargando eBay'}</div>
          <div className="mt-1 text-xs text-slate-500">
            {statusText}
          </div>
        </div>
        <div className="shrink-0 text-right text-sm font-bold text-sky-700">
          {percent}%
          {!compact && (
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-600">
              {progress.mode === 'append' ? 'Cargando mas' : 'En proceso'}
            </div>
          )}
        </div>
      </div>
      <div className="h-2 bg-slate-100">
        <div
          className="h-full rounded-r-full bg-sky-500 transition-all duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Ebay({ setVista }) {
  const [activeTab, setActiveTab] = useState('pawns');
  const [loadingTab, setLoadingTab] = useState('');
  const [appendLoadingTab, setAppendLoadingTab] = useState('');
  const [loadingProgress, setLoadingProgress] = useState({ visible: false, tab: '', mode: '', percent: 0 });
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
  const [productPawnOnly, setProductPawnOnly] = useState(false);
  const [productMinReviewsOnly, setProductMinReviewsOnly] = useState(false);
  const [productKeyword, setProductKeyword] = useState('');
  const [productResult, setProductResult] = useState(EMPTY_RESULT);
  const [ipadForm, setIpadForm] = useState({ line: '', number: '', screen: '', processor: '', storage: '', connectivity: '' });
  const [iphoneForm, setIphoneForm] = useState({ number: '', model: '' });
  const [macbookForm, setMacbookForm] = useState({ line: '', screen: '', processor: '', ram: '', storage: '' });

  const [auctionFamily, setAuctionFamily] = useState('all');
  const [auctionCondition, setAuctionCondition] = useState('auction_normal');
  const [auctionResult, setAuctionResult] = useState({ ...EMPTY_RESULT, groups: [], buyingOptions: 'AUCTION' });
  const [analyticsGroups, setAnalyticsGroups] = useState([]);
  const [ebayRateLimits, setEbayRateLimits] = useState(null);
  const [ebayRateLoading, setEbayRateLoading] = useState(false);
  const [ebayRateError, setEbayRateError] = useState('');
  const [viewedItems, setViewedItems] = useState(readViewedEbayItems);

  const sentinelRef = useRef(null);
  const appendRequestKeyRef = useRef('');
  const requestSeqRef = useRef({ pawns: 0, product: 0, auctions: 0 });
  const progressHideTimeoutRef = useRef(null);
  const activeProgressTab = appendLoadingTab || loadingTab;
  const activeProgressMode = appendLoadingTab ? 'append' : loadingTab ? 'initial' : '';
  const ipadUsesNumber = ipadForm.line === 'normal' || ipadForm.line === 'mini';
  const ipadNumberOptions = getIpadNumberOptions(ipadForm.line);
  const ipadScreenOptions = getIpadScreenOptions(ipadForm.line);
  const ipadProcessorOptions = getIpadProcessorOptions(ipadForm.line);
  const macbookScreenOptions = getMacbookScreenOptions(macbookForm.line);
  const macbookProcessorOptions = getMacbookProcessorOptions(macbookForm.line);

  const beginEbayRequest = (tab) => {
    requestSeqRef.current[tab] = Number(requestSeqRef.current[tab] || 0) + 1;
    return requestSeqRef.current[tab];
  };

  const isCurrentEbayRequest = (tab, requestId) =>
    requestSeqRef.current[tab] === requestId;

  const clearLoadingForRequest = (tab, requestId, append) => {
    if (!isCurrentEbayRequest(tab, requestId)) return;
    if (append) {
      setAppendLoadingTab((current) => (current === tab ? '' : current));
      return;
    }
    setLoadingTab((current) => (current === tab ? '' : current));
  };

  const loadEbayRateLimits = async ({ silent = false } = {}) => {
    if (!silent) setEbayRateLoading(true);
    setEbayRateError('');
    try {
      const data = await api.get('/utils/ebay/rate-limits');
      setEbayRateLimits(data);
    } catch (err) {
      setEbayRateError(String(err?.message || 'No se pudo leer el limite de eBay.'));
    } finally {
      if (!silent) setEbayRateLoading(false);
    }
  };

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
    const requestId = beginEbayRequest('pawns');
    const initialOffset = append ? getNextResultOffset(pawnResult) : 0;
    const trimmedQuery = String(query || '').trim() || 'apple';
    if (append) setAppendLoadingTab('pawns');
    else setLoadingTab('pawns');
    loadEbayRateLimits({ silent: false });
    setErrors((prev) => ({ ...prev, pawns: '' }));
    try {
      let offset = initialOffset;
      let data = null;
      let receivedItems = [];

      if (!append) {
        data = await api.get(
          `/utils/ebay/store-feed?q=${encodeURIComponent(trimmedQuery)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(pawnCondition)}&buyingOptions=${encodeURIComponent(pawnBuyingOptions)}`,
        );
        receivedItems = Array.isArray(data?.items) ? data.items : [];
      } else {
        const seen = new Set(pawnResult.items.map((item) => getItemKey(item)).filter(Boolean));
        const maxAppendPages = 5;

        for (let page = 0; page < maxAppendPages; page += 1) {
          data = await api.get(
            `/utils/ebay/store-feed?q=${encodeURIComponent(trimmedQuery)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(pawnCondition)}&buyingOptions=${encodeURIComponent(pawnBuyingOptions)}`,
          );
          const pageItems = Array.isArray(data?.items) ? data.items : [];
          const newItems = pageItems.filter((item) => {
            const key = getItemKey(item);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          receivedItems = [...receivedItems, ...newItems];
          if (newItems.length > 0 || !data?.hasMore) break;
          offset = Number(data?.offset || offset) + Number(data?.limit || PAGE_SIZE);
        }
      }

      const finalOffset = Number(data?.offset || initialOffset);
      if (!isCurrentEbayRequest('pawns', requestId)) return;
      setPawnResult((prev) => ({
        items: append ? mergeUniqueItems(prev.items, receivedItems) : receivedItems,
        sellers: Array.isArray(data?.sellers) ? data.sellers : [],
        total: Number(data?.total || 0),
        query: String(data?.query || trimmedQuery),
        sort: String(data?.sort || 'newlyListed'),
        limit: Number(data?.limit || PAGE_SIZE),
        offset: finalOffset,
        hasMore: Boolean(data?.hasMore),
      }));
    } catch (err) {
      if (!isCurrentEbayRequest('pawns', requestId)) return;
      if (/429|limitando|too many requests/i.test(String(err?.message || err))) {
        setPawnResult((prev) => ({ ...prev, hasMore: false }));
      }
      setErrors((prev) => ({ ...prev, pawns: String(err?.message || 'No se pudo cargar la busqueda por pawns.') }));
    } finally {
      loadEbayRateLimits({ silent: false });
      clearLoadingForRequest('pawns', requestId, append);
    }
  };

  const productQueries = buildProductSearchQueries({
    productType,
    ipadForm,
    iphoneForm,
    macbookForm,
    keyword: productKeyword,
  });
  const productQuery = productQueries[0] || 'apple';

  const loadProductSearch = async ({ append = false } = {}) => {
    const requestId = beginEbayRequest('product');
    const initialOffset = append ? getNextResultOffset(productResult) : 0;
    if (append) setAppendLoadingTab('product');
    else setLoadingTab('product');
    loadEbayRateLimits({ silent: false });
    setErrors((prev) => ({ ...prev, product: '' }));
    try {
      const pawnOnlyParam = productPawnOnly ? '&pawnOnly=1' : '';
      const minReviewsParam = productMinReviewsOnly ? '&minSellerReviews=10000' : '';
      const activeProductQueries = productQueries.length > 0 ? productQueries : [productQuery];
      const isMultiQuerySearch = activeProductQueries.length > 1;
      const buildEndpoint = (query, offset, options = {}) => {
        const cacheOffset = Number(options.cacheOffset || 0);
        const preferCache = options.preferCache ? '1' : '';
        return `/utils/ebay/search?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}&cacheOffset=${cacheOffset}&preferCache=${preferCache}&condition=${encodeURIComponent(productCondition)}&buyingOptions=${encodeURIComponent(productBuyingOptions)}${pawnOnlyParam}${minReviewsParam}&sort=newlyListed&scanPages=${PRODUCT_SEARCH_SCAN_PAGES_PER_REQUEST}`;
      };
      const filterProductItems = (rawItems) => {
        if (productType === 'keyword') {
          const deviceItems = rawItems.filter((item) => isLikelyAppleCatalogTitle(item?.title || ''));
          return compactValue(productKeyword)
            ? deviceItems.filter((item) => textIncludesKeyword(item?.title || '', productKeyword))
            : deviceItems;
        }
        const familyFilteredItems = productType === 'all'
          ? rawItems.filter((item) => isLikelyAppleCatalogTitle(item?.title || ''))
          : productType === 'imac'
            ? rawItems.filter((item) => isTargetImacTitle(normalizeTitleText(item?.title || '')))
            : productType === 'mac-mini'
              ? rawItems.filter((item) => isTargetMacMiniTitle(normalizeTitleText(item?.title || '')))
              : productType === 'apple-watch'
                ? rawItems.filter((item) => isTargetAppleWatchTitle(normalizeTitleText(item?.title || '')))
                : rawItems.filter((item) => isLikelyAppleDeviceTitle(item?.title || '', productType));
        return productType === 'ipad'
          ? familyFilteredItems.filter((item) => matchIpadItem(item, ipadForm))
          : productType === 'macbook'
            ? familyFilteredItems.filter((item) => matchMacbookItem(item, macbookForm))
            : familyFilteredItems;
      };

      let filteredItems = sortItemsByListedDate(
        append && Array.isArray(productResult.pendingItems)
          ? productResult.pendingItems
          : [],
      );
      const seen = new Set(
        append
          ? [...productResult.items, ...filteredItems].map((item) => getItemKey(item)).filter(Boolean)
          : [],
      );
      const previousQueryStates = append && Array.isArray(productResult.queryStates)
        ? productResult.queryStates
        : [];
      const canReuseQueryStates = append &&
        previousQueryStates.length === activeProductQueries.length &&
        previousQueryStates.every((state, index) => String(state?.query || '') === String(activeProductQueries[index] || ''));
      const queryStates = canReuseQueryStates
        ? previousQueryStates.map((state) => ({
            query: String(state?.query || ''),
            offset: Math.max(0, Number(state?.offset || 0)),
            cacheOffset: Math.max(0, Number(state?.cacheOffset || 0)),
            preferCache: Boolean(state?.preferCache),
            exhausted: Boolean(state?.exhausted),
          }))
        : activeProductQueries.map((query) => ({
            query,
            offset: initialOffset,
            cacheOffset: !isMultiQuerySearch && append ? Number(productResult.cacheOffset || 0) : 0,
            preferCache: !isMultiQuerySearch && append ? Boolean(productResult.preferCache) : false,
            exhausted: false,
          }));
      let nextQueryIndex = canReuseQueryStates ? Number(productResult.nextQueryIndex || 0) : 0;
      let lastHasMore = false;
      let lastNextCacheOffset = !isMultiQuerySearch && append ? Number(productResult.cacheOffset || 0) : 0;
      let lastPreferCache = !isMultiQuerySearch && append ? Boolean(productResult.preferCache) : false;
      let lastRateLimited = false;
      let totalEstimate = append ? Number(productResult.total || 0) : 0;
      let completedBatches = 0;
      let latestResult = null;

      while (queryStates.some((state) => !state.exhausted)) {
        completedBatches += 1;
        let requestsInBatch = 0;

        while (
          requestsInBatch < PRODUCT_SEARCH_BATCH_REQUEST_LIMIT &&
          queryStates.some((state) => !state.exhausted)
        ) {
          let state = null;
          let stateIndex = -1;
          for (let attempt = 0; attempt < queryStates.length; attempt += 1) {
            const index = ((nextQueryIndex % queryStates.length) + queryStates.length) % queryStates.length;
            nextQueryIndex = (index + 1) % queryStates.length;
            if (!queryStates[index]?.exhausted) {
              state = queryStates[index];
              stateIndex = index;
              break;
            }
          }
          if (!state || stateIndex < 0) break;

          const result = await api.get(buildEndpoint(state.query, state.offset, {
            cacheOffset: isMultiQuerySearch ? 0 : state.cacheOffset,
            preferCache: isMultiQuerySearch ? false : state.preferCache,
          }));
          requestsInBatch += 1;
          latestResult = result;
          const previousOffset = Number(state.offset || 0);
          const resultHasMore = typeof result?.hasMore === 'boolean'
            ? result.hasMore
            : Number(result?.items?.length || 0) > 0;
          totalEstimate = Math.max(totalEstimate, Number(result?.total || 0), filteredItems.length);
          state.offset = Number.isFinite(Number(result?.nextOffset))
            ? Math.max(0, Number(result.nextOffset))
            : getResponseNextOffset(result, previousOffset);
          state.cacheOffset = !isMultiQuerySearch && Number.isFinite(Number(result?.nextCacheOffset))
            ? Number(result.nextCacheOffset)
            : state.cacheOffset;
          state.preferCache = !isMultiQuerySearch && Boolean(result?.nextPreferCache);
          state.exhausted = Boolean(result?.rateLimited) || (!resultHasMore && !state.preferCache);
          lastRateLimited = lastRateLimited || Boolean(result?.rateLimited);

          const pageItems = sortItemsByListedDate(
            filterProductItems(Array.isArray(result?.items) ? result.items : []),
          );
          const newItems = pageItems.filter((item) => {
            const key = getItemKey(item);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          filteredItems = sortItemsByListedDate([...filteredItems, ...newItems]);
          lastHasMore = queryStates.some((queryState) => !queryState.exhausted);
          lastNextCacheOffset = !isMultiQuerySearch && Number.isFinite(Number(result?.nextCacheOffset))
            ? Number(result.nextCacheOffset)
            : lastNextCacheOffset;
          lastPreferCache = !isMultiQuerySearch && Boolean(result?.nextPreferCache);

        }

        const appendableItems = append
          ? keepItemsOlderThanVisibleTail(productResult.items, filteredItems)
          : filteredItems;
        if (isCurrentEbayRequest('product', requestId)) {
          const visibleItems = append
            ? mergeUniqueItems(productResult.items, appendableItems)
            : appendableItems;
          const resultMetadata = latestResult || productResult;
          setProductResult({
            items: visibleItems,
            sellers: Array.isArray(resultMetadata?.sellers) ? resultMetadata.sellers : [],
            total: Math.max(totalEstimate, visibleItems.length),
            query: String(resultMetadata?.query || productQuery),
            sort: String(resultMetadata?.sort || 'newlyListed'),
            limit: Number(resultMetadata?.limit || PAGE_SIZE),
            offset: Number(queryStates[0]?.offset || initialOffset),
            nextOffset: Number(queryStates[0]?.offset || initialOffset),
            cacheOffset: lastNextCacheOffset,
            preferCache: lastPreferCache,
            groups: Array.isArray(resultMetadata?.groups) ? resultMetadata.groups : [],
            family: String(resultMetadata?.family || productType),
            buyingOptions: String(resultMetadata?.buyingOptions || productBuyingOptions),
            hasMore: !lastRateLimited && queryStates.some((state) => !state.exhausted),
            rateLimited: lastRateLimited,
            queryStates: queryStates.map((queryState) => ({ ...queryState })),
            nextQueryIndex,
            pendingItems: [],
          });
        }
        if (
          lastRateLimited ||
          appendableItems.length >= PRODUCT_SEARCH_MIN_VISIBLE_RESULTS ||
          !queryStates.some((state) => !state.exhausted)
        ) break;
      }

      if ((completedBatches || filteredItems.length > 0) && isCurrentEbayRequest('product', requestId)) {
        const orderedNewItems = sortItemsByListedDate(
          append
            ? keepItemsOlderThanVisibleTail(productResult.items, filteredItems)
            : filteredItems,
        );
        const visibleItems = append
          ? mergeUniqueItems(productResult.items, orderedNewItems)
          : orderedNewItems;
        const resultMetadata = latestResult || productResult;
        setProductResult({
          items: visibleItems,
          sellers: Array.isArray(resultMetadata?.sellers) ? resultMetadata.sellers : [],
          total: Math.max(totalEstimate, visibleItems.length),
          query: String(resultMetadata?.query || productQuery),
          sort: String(resultMetadata?.sort || 'newlyListed'),
          limit: Number(resultMetadata?.limit || PAGE_SIZE),
          offset: Number(queryStates[0]?.offset || initialOffset),
          nextOffset: Number(queryStates[0]?.offset || initialOffset),
          cacheOffset: lastNextCacheOffset,
          preferCache: lastPreferCache,
          groups: Array.isArray(resultMetadata?.groups) ? resultMetadata.groups : [],
          family: String(resultMetadata?.family || productType),
          buyingOptions: String(resultMetadata?.buyingOptions || productBuyingOptions),
          hasMore: !lastRateLimited && lastHasMore,
          rateLimited: lastRateLimited,
          queryStates: queryStates.map((queryState) => ({ ...queryState })),
          nextQueryIndex,
          pendingItems: [],
        });
      }

      if (!completedBatches && isCurrentEbayRequest('product', requestId)) {
        setProductResult((prev) => append ? prev : EMPTY_RESULT);
      }
    } catch (err) {
      if (!isCurrentEbayRequest('product', requestId)) return;
      if (/429|limitando|too many requests/i.test(String(err?.message || err))) {
        setProductResult((prev) => ({ ...prev, hasMore: false, rateLimited: true }));
      }
      setErrors((prev) => ({ ...prev, product: String(err?.message || 'No se pudo cargar la busqueda por producto.') }));
    } finally {
      loadEbayRateLimits({ silent: false });
      clearLoadingForRequest('product', requestId, append);
    }
  };

  const loadAppleAuctions = async ({ append = false } = {}) => {
    const requestId = beginEbayRequest('auctions');
    const offset = append ? getNextResultOffset(auctionResult) : 0;
    if (append) setAppendLoadingTab('auctions');
    else setLoadingTab('auctions');
    loadEbayRateLimits({ silent: false });
    setErrors((prev) => ({ ...prev, auctions: '' }));
    try {
      const data = await api.get(
        `/utils/ebay/apple-auctions?family=${encodeURIComponent(auctionFamily)}&limit=${PAGE_SIZE}&offset=${offset}&condition=${encodeURIComponent(auctionCondition)}`,
      );
      if (!isCurrentEbayRequest('auctions', requestId)) return;
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
        hasMore: typeof data?.hasMore === 'boolean' ? data.hasMore : undefined,
      }));
    } catch (err) {
      if (!isCurrentEbayRequest('auctions', requestId)) return;
      setErrors((prev) => ({ ...prev, auctions: String(err?.message || 'No se pudo cargar la vista de subastas.') }));
    } finally {
      loadEbayRateLimits({ silent: false });
      clearLoadingForRequest('auctions', requestId, append);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadPawnStores();
    loadEbayRateLimits({ silent: false });
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

  useEffect(() => {
    if (progressHideTimeoutRef.current) {
      clearTimeout(progressHideTimeoutRef.current);
      progressHideTimeoutRef.current = null;
    }

    if (activeProgressTab) {
      setLoadingProgress({ visible: true, tab: activeProgressTab, mode: activeProgressMode, percent: 4 });
      return undefined;
    }

    setLoadingProgress((prev) => {
      if (!prev.visible) return prev;
      return { ...prev, percent: 100 };
    });
    progressHideTimeoutRef.current = setTimeout(() => {
      setLoadingProgress((prev) => {
        if (!prev.visible || prev.percent < 100) return prev;
        return { visible: false, tab: '', mode: '', percent: 0 };
      });
      progressHideTimeoutRef.current = null;
    }, 650);

    return undefined;
  }, [activeProgressMode, activeProgressTab]);

  useEffect(() => {
    if (!loadingProgress.visible || loadingProgress.percent >= 99) return undefined;

    const timer = setInterval(() => {
      setLoadingProgress((prev) => {
        if (!prev.visible || prev.percent >= 99) return prev;
        const current = Number(prev.percent || 0);
        const step = current < 55
          ? 6
          : current < 82
            ? 3
            : current < 94
              ? 1
              : 0.35;
        const nextPercent = Math.min(99, +(current + step).toFixed(2));
        return { ...prev, percent: nextPercent };
      });
    }, 420);

    return () => clearInterval(timer);
  }, [loadingProgress.mode, loadingProgress.tab, loadingProgress.visible]);

  useEffect(() => () => {
    if (progressHideTimeoutRef.current) clearTimeout(progressHideTimeoutRef.current);
  }, []);

  useEffect(() => {
    let alive = true;
    api.get('/utils/ebay/viewed')
      .then((data) => {
        if (!alive) return;
        const fromDb = {};
        (Array.isArray(data?.items) ? data.items : []).forEach((row) => {
          const viewedAt = row?.viewedAt || '';
          if (row?.itemKey && viewedAt) fromDb[String(row.itemKey)] = viewedAt;
          if (row?.itemUrl && viewedAt) {
            getItemViewedKeys({ itemWebUrl: row.itemUrl }).forEach((key) => {
              fromDb[key] = viewedAt;
            });
          }
        });
        const merged = mergeViewedMaps(readViewedEbayItems(), fromDb);
        setViewedItems(merged);
        writeViewedEbayItems(merged);
      })
      .catch(() => {
        /* localStorage remains as fallback */
      });
    return () => {
      alive = false;
    };
  }, []);

  const markItemViewed = (item) => {
    const keys = getItemViewedKeys(item);
    if (!keys.length) return;
    const viewedAt = new Date().toISOString();
    setViewedItems((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        next[key] = viewedAt;
      });
      writeViewedEbayItems(next);
      return next;
    });
    api.post('/utils/ebay/viewed', {
      keys,
      itemUrl: item?.itemWebUrl || '',
      title: item?.title || '',
    }).catch(() => {
      /* localStorage keeps the visible marker if the network save fails */
    });
  };

  const currentResult = activeTab === 'pawns' ? pawnResult : activeTab === 'product' ? productResult : auctionResult;
  const currentError = activeTab === 'pawns' ? errors.pawns : activeTab === 'product' ? errors.product : errors.auctions;
  const currentLoading = loadingTab === activeTab;
  const currentAppending = appendLoadingTab === activeTab;
  const currentHasMore = typeof currentResult.hasMore === 'boolean'
    ? currentResult.hasMore
    : currentResult.items.length < currentResult.total;
  const currentInitialProgress = loadingProgress.visible && loadingProgress.mode === 'initial' && loadingProgress.tab === activeTab
    ? loadingProgress
    : null;
  const currentAppendProgress = loadingProgress.visible && loadingProgress.mode === 'append' && loadingProgress.tab === activeTab
    ? loadingProgress
    : null;
  const showLoadMoreControls = (
    currentResult.items.length > 0 || currentHasMore || currentAppending || Boolean(currentAppendProgress)
  ) && (
    currentHasMore || currentAppending || currentLoading || Boolean(currentAppendProgress)
  );
  const currentItems = useMemo(
    () => currentResult.items.map((item) => ({
      ...item,
      viewedAt: getViewedAtForItem(viewedItems, item) || item.viewedAt,
      priceReview: buildRecommendationForItem(item, analyticsGroups, activeTab === 'auctions' ? 'bid' : 'standard'),
    })),
    [activeTab, analyticsGroups, currentResult.items, viewedItems],
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

  const loadMoreCurrent = async () => {
    if (currentLoading || currentAppending || !currentHasMore) return;
    const nextOffset = getNextResultOffset(currentResult);
    const requestKey = [
      activeTab,
      currentResult.query,
      nextOffset,
      pawnCondition,
      pawnBuyingOptions,
      productCondition,
      productBuyingOptions,
      productPawnOnly,
      productMinReviewsOnly,
      productKeyword,
      productType,
      auctionFamily,
      auctionCondition,
    ].join('|');
    if (appendRequestKeyRef.current === requestKey) return;
    appendRequestKeyRef.current = requestKey;
    try {
      if (activeTab === 'pawns') await loadPawns({ append: true });
      if (activeTab === 'product') await loadProductSearch({ append: true });
      if (activeTab === 'auctions') await loadAppleAuctions({ append: true });
    } finally {
      if (appendRequestKeyRef.current === requestKey) {
        appendRequestKeyRef.current = '';
      }
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff_0%,_#f8fafc_45%,_#e2e8f0_100%)] p-3 sm:p-6">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-4 rounded-2xl border border-white/70 bg-white/85 p-4 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.35)] backdrop-blur sm:mb-6 sm:rounded-[2rem] sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:tracking-[0.24em]">eBay Explorer</div>
              <h1 className="mt-2 text-2xl font-semibold text-slate-900 sm:text-4xl">Busqueda Apple</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">Carga {PAGE_SIZE} resultados por bloque. Tu decides cuando cargar mas.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
              <SectionToggle activeTab={activeTab} onChange={setActiveTab} />
              <button
                type="button"
                onClick={() => setVista('home')}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:w-auto"
              >
                Volver
              </button>
            </div>
          </div>
        </div>

        <EbayRateLimitPanel
          data={ebayRateLimits}
          loading={ebayRateLoading}
          error={ebayRateError}
          onRefresh={() => loadEbayRateLimits({ silent: false })}
        />

        <div className="mb-4 grid gap-4 sm:mb-6 xl:grid-cols-[1.2fr,1fr]">
          <div className={`rounded-2xl border p-4 shadow-sm transition sm:rounded-[2rem] sm:p-5 ${activeTab === 'pawns' ? 'border-sky-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
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
                className="w-full self-end rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
              >
                {loadingTab === 'pawns' ? 'Buscando...' : 'Buscar pawns'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
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
                  className="w-full self-end rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 lg:w-auto"
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
                    className="w-full rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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

          <div className={`rounded-2xl border p-4 shadow-sm transition sm:rounded-[2rem] sm:p-5 ${activeTab === 'product' ? 'border-amber-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Buscar por producto</h2>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {FAMILY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setProductType(option.id)}
                  className={`rounded-2xl px-3 py-2 text-sm font-semibold transition sm:px-4 ${productType === option.id ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600 hover:text-slate-900'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {productType === 'ipad' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <FieldShell label="Linea">
                  <MappedSelectField
                    value={ipadForm.line}
                    onChange={(e) => setIpadForm((prev) => normalizeIpadFormForLine(prev, e.target.value))}
                    options={IPAD_LINE_OPTIONS}
                  />
                </FieldShell>
                <FieldShell label={ipadUsesNumber ? 'Numero' : 'Procesador'}>
                  {ipadUsesNumber ? (
                    <SelectField
                      value={ipadForm.number}
                      onChange={(e) => setIpadForm((prev) => ({ ...prev, number: e.target.value }))}
                      options={ipadNumberOptions}
                      placeholder="Numero"
                    />
                  ) : (
                    <SelectField
                      value={ipadForm.processor}
                      onChange={(e) => setIpadForm((prev) => ({ ...prev, processor: e.target.value }))}
                      options={ipadProcessorOptions}
                    />
                  )}
                </FieldShell>
                <FieldShell label="Pantalla"><SelectField value={ipadForm.screen} onChange={(e) => setIpadForm((prev) => ({ ...prev, screen: e.target.value }))} options={ipadScreenOptions} /></FieldShell>
                <FieldShell label="Almacenamiento"><SelectField value={ipadForm.storage} onChange={(e) => setIpadForm((prev) => ({ ...prev, storage: e.target.value }))} options={IPAD_STORAGE_OPTIONS} /></FieldShell>
                <FieldShell label="Conectividad"><MappedSelectField value={ipadForm.connectivity} onChange={(e) => setIpadForm((prev) => ({ ...prev, connectivity: e.target.value }))} options={IPAD_CONNECTIVITY_OPTIONS} /></FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
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
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'macbook' && (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
                <FieldShell label="Linea"><MappedSelectField value={macbookForm.line} onChange={(e) => setMacbookForm((prev) => normalizeMacbookFormForLine(prev, e.target.value))} options={MACBOOK_LINE_OPTIONS} /></FieldShell>
                <FieldShell label="Pantalla"><SelectField value={macbookForm.screen} onChange={(e) => setMacbookForm((prev) => ({ ...prev, screen: e.target.value }))} options={macbookScreenOptions} /></FieldShell>
                <FieldShell label="Procesador"><SelectField value={macbookForm.processor} onChange={(e) => setMacbookForm((prev) => ({ ...prev, processor: e.target.value }))} options={macbookProcessorOptions} /></FieldShell>
                <FieldShell label="RAM"><SelectField value={macbookForm.ram} onChange={(e) => setMacbookForm((prev) => ({ ...prev, ram: e.target.value }))} options={MACBOOK_RAM_OPTIONS} /></FieldShell>
                <FieldShell label="Almacenamiento"><SelectField value={macbookForm.storage} onChange={(e) => setMacbookForm((prev) => ({ ...prev, storage: e.target.value }))} options={MACBOOK_STORAGE_OPTIONS} /></FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'all' && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-100/80 p-4 text-sm text-slate-600">Busca Apple en una sola lista de eBay, ordenada por los mas nuevos primero.</div>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {['imac', 'mac-mini', 'apple-watch'].includes(productType) && (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-100/80 p-4 text-sm text-slate-600">
                  Busca por nombre, chip y numeros de modelo oficiales.
                </div>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            {productType === 'keyword' && (
              <div className="grid gap-3 md:grid-cols-3">
                <FieldShell label="Palabra clave">
                  <input
                    type="text"
                    value={productKeyword}
                    onChange={(e) => setProductKeyword(e.target.value)}
                    placeholder="Ej. MacBook A2337, iPad Pro M4, iPhone 16 Pro"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-500"
                  />
                </FieldShell>
                <FieldShell label="Condicion"><MappedSelectField value={productCondition} onChange={(e) => setProductCondition(e.target.value)} options={PRODUCT_CONDITION_OPTIONS} /></FieldShell>
                <FieldShell label="Oferta"><MappedSelectField value={productBuyingOptions} onChange={(e) => setProductBuyingOptions(e.target.value)} options={PAWN_OFFER_OPTIONS} /></FieldShell>
              </div>
            )}

            <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3">
              <label className="inline-flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto">
                <input
                  type="checkbox"
                  checked={productPawnOnly}
                  onChange={(e) => setProductPawnOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                Solo tiendas Pawn
              </label>
              <label className="inline-flex w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 sm:w-auto">
                <input
                  type="checkbox"
                  checked={productMinReviewsOnly}
                  onChange={(e) => setProductMinReviewsOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                +10k reviews
              </label>
              <button
                type="button"
                onClick={() => { setActiveTab('product'); loadProductSearch({ append: false }); }}
                disabled={loadingTab === 'product'}
                className="w-full rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {loadingTab === 'product' ? 'Buscando...' : 'Buscar producto'}
              </button>
            </div>
          </div>
        </div>

        <div className={`mb-4 rounded-2xl border p-4 shadow-sm transition sm:mb-6 sm:rounded-[2rem] sm:p-5 ${activeTab === 'auctions' ? 'border-violet-200 bg-white' : 'border-slate-200 bg-white/80'}`}>
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">Buscar todos en subastas</h2>
              <p className="mt-2 text-sm text-slate-600">Subastas Apple ordenadas por las primeras en terminar. Incluye Apple Watch Ultra por nombre o modelo Apple.</p>
            </div>
            <div className="grid w-full gap-2 sm:grid-cols-3 xl:w-auto">
              <MappedSelectField value={auctionFamily} onChange={(e) => setAuctionFamily(e.target.value)} options={AUCTION_FAMILY_OPTIONS.map((item) => ({ value: item.id, label: item.label }))} />
              <MappedSelectField value={auctionCondition} onChange={(e) => setAuctionCondition(e.target.value)} options={AUCTION_CONDITION_OPTIONS} />
              <button
                type="button"
                onClick={() => { setActiveTab('auctions'); loadAppleAuctions({ append: false }); }}
                disabled={loadingTab === 'auctions'}
                className="w-full rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingTab === 'auctions' ? 'Buscando...' : 'Cargar subastas'}
              </button>
            </div>
          </div>
        </div>

        {currentError && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{currentError}</div>}

        <EbayLoadingPanel
          progress={currentInitialProgress}
          tab={activeTab}
        />

        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:rounded-[2rem] sm:px-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mt-1 text-lg font-semibold text-slate-900">{currentLoading && currentResult.items.length === 0 ? 'Cargando resultados...' : `${currentResult.items.length} resultados visibles`}</div>
            <div className="mt-1 text-sm text-slate-600">
              Orden: <strong>{activeTab === 'auctions' ? 'primeros en terminar' : 'mas nuevos a mas antiguos'}</strong>
            </div>
          </div>
          <div className="text-sm text-slate-600 md:text-right">
            {currentAppending ? `Precargando... ${currentResult.total} totales` : `${currentResult.total} totales`}
          </div>
        </div>

        {currentResult.items.length > 0 && (
          <ResultsGrid
            items={currentItems}
            titleSource={activeTab === 'pawns' ? 'store' : 'seller'}
            dateField={activeTab === 'auctions' ? 'end' : 'origin'}
            priceMode={activeTab === 'auctions' ? 'bid' : 'standard'}
            onItemOpen={markItemViewed}
          />
        )}

        {showLoadMoreControls && (
          <div className="my-6 flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={loadMoreCurrent}
              disabled={currentLoading || currentAppending || !currentHasMore}
              className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {activeTab === 'product' && (currentLoading || currentAppending)
                ? 'Cargar mas en pausa...'
                : currentLoading || currentAppending
                  ? 'Cargando mas...'
                  : 'Cargar mas'}
            </button>
            <EbayLoadingPanel
              progress={currentAppendProgress}
              tab={activeTab}
              compact
            />
          </div>
        )}

        {!currentLoading && !currentError && currentResult.items.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm sm:rounded-[2rem] sm:p-10">
            No se encontraron productos para esa combinacion.
          </div>
        )}

        {pawnStoresModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-2 sm:items-center sm:p-4">
            <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:max-h-[80vh] sm:rounded-[2rem]">
              <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h3 className="text-lg font-semibold text-slate-900">Pawns guardados</h3>
                  <div className="text-sm text-slate-500">{pawnStores.length} tiendas persistidas</div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex">
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

              <div className="max-h-[calc(92vh-132px)] overflow-auto p-4 sm:max-h-[calc(80vh-88px)] sm:p-5">
                {pawnStores.length > 0 ? (
                  <div className="space-y-3">
                    {pawnStores.map((store) => (
                      <div
                        key={`${store.seller}-${store.storeUrl}`}
                        className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="break-words text-base font-semibold text-slate-900">{store.storeName}</div>
                        <div className="mt-1 break-words text-sm text-slate-500">Seller: {store.seller}</div>
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
