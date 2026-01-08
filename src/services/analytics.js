import api from '../api';

const buildParams = (params = {}) =>
  Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

export async function getProfitSeries(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/profit?${qs}` : '/analytics/profit';
  return api.get(path);
}

export async function getProfitComparison(params = {}) {
  const qs = buildParams(params);
  const path = qs ? `/analytics/profit/compare?${qs}` : '/analytics/profit/compare';
  return api.get(path);
}
