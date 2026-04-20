import api from '../api';

const buildParams = (params = {}) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const responseCache = new Map();
const inflight = new Map();

const readCache = (key, ttlMs) => {
  const hit = responseCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.ts > ttlMs) {
    responseCache.delete(key);
    return null;
  }
  return hit.value;
};

const cachedGet = async (path, ttlMs = 60_000) => {
  const cached = readCache(path, ttlMs);
  if (cached) return cached;

  if (inflight.has(path)) return inflight.get(path);

  const promise = api
    .get(path)
    .then((res) => {
      responseCache.set(path, { value: res, ts: Date.now() });
      return res;
    })
    .finally(() => {
      inflight.delete(path);
    });

  inflight.set(path, promise);
  return promise;
};

export async function getAnalyticsSummary(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/summary?${qs}` : '/analytics/summary';
  return cachedGet(path, 90_000);
}

export async function getSunatExchangeRate(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/sunat/exchange-rate?${qs}` : '/analytics/sunat/exchange-rate';
  return cachedGet(path, 6 * 60_000);
}

export async function getProfitSeries(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/profit?${qs}` : '/analytics/profit';
  return cachedGet(path, 90_000);
}

export async function getProfitComparison(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/profit/compare?${qs}` : '/analytics/profit/compare';
  return cachedGet(path, 90_000);
}
