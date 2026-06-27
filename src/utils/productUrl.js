export const normalizeProductLookupUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{9,15}$/.test(raw)) return `https://www.ebay.com/itm/${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^(?:(?:www|m)\.)?(?:ebay\.[a-z.]+|amazon\.[a-z.]+)\//i.test(raw)) {
    return `https://${raw}`;
  }
  return raw;
};
