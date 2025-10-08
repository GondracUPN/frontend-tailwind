// src/utils/tipoCambio.js
// Utilidad para obtener tipo de cambio SUNAT por día con cache local.
import { useEffect, useState } from 'react';
import { API_URL } from '../api';

const EXCHANGE_API = 'https://api.decolecta.com/v1/tipo-cambio/sunat';
const ALLORIGINS = 'https://api.allorigins.win/raw?url='; // Solo como fallback de desarrollo
const PROXY_ENV = process.env.REACT_APP_TC_PROXY; // Opcional: endpoint propio que hace proxy

function normalizePayload(obj) {
  if (!obj || typeof obj !== 'object') return null;
  // Aceptar distintos nombres de campos (buy/sell o compra/venta)
  const compra = Number(obj.compra ?? obj.buy ?? obj.compra_promedio ?? obj.tc_compra);
  const venta = Number(obj.venta ?? obj.sell ?? obj.venta_promedio ?? obj.tc_venta);
  const date = String(obj.date || obj.fecha || '').slice(0, 10);
  if (!isFinite(venta) || venta <= 0) return null;
  return { date, compra: isFinite(compra) ? compra : venta, venta };
}

function buildUrl(base, date) {
  if (!base) return null;
  if (!date) return base;
  return base.includes('?') ? `${base}&date=${encodeURIComponent(date)}` : `${base}?date=${encodeURIComponent(date)}`;
}

async function fetchTipoCambioRaw(date) {
  // Orden de intento para evitar CORS: 1) Proxy env 2) Backend propio 3) Directo
  const candidates = [];
  if (PROXY_ENV) candidates.push(buildUrl(PROXY_ENV, date));
  candidates.push(buildUrl(`${API_URL}/tipo-cambio/sunat`, date));
  candidates.push(buildUrl(`${API_URL}/tipo-cambio`, date));
  // Fallback con proxy público con CORS habilitado (para dev).
  const direct = buildUrl(EXCHANGE_API, date);
  candidates.push(direct ? `${ALLORIGINS}${encodeURIComponent(direct)}` : null);
  candidates.push(buildUrl(EXCHANGE_API, date));

  const urls = [...new Set(candidates.filter(Boolean))];
  let lastErr = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, mode: 'cors' });
      const ct = res.headers.get('content-type') || '';
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }
      const data = ct.includes('application/json') ? await res.json() : null;
      const norm = normalizePayload(data);
      if (norm) return norm;
    } catch (e) {
      lastErr = e;
    }
  }
  if (lastErr) throw lastErr;
  throw new Error('No exchange payload');
}

export async function getTipoCambio(date) {
  const key = `tc_sunat_${date || 'today'}`;
  // 8h cache
  const now = Date.now();
  try {
    const cached = JSON.parse(localStorage.getItem(key) || 'null');
    if (cached && (now - Number(cached.savedAt || 0) < 8 * 60 * 60 * 1000)) {
      return cached.value;
    }
  } catch {}
  const value = await fetchTipoCambioRaw(date);
  try { localStorage.setItem(key, JSON.stringify({ savedAt: now, value })); } catch {}
  return value;
}

export function useTipoCambio(date) {
  const [state, setState] = useState({ loading: true, error: '', compra: null, venta: null });
  useEffect(() => {
    let alive = true;
    (async () => {
      setState((s) => ({ ...s, loading: true, error: '' }));
      try {
        const tc = await getTipoCambio(date);
        if (!alive) return;
        setState({ loading: false, error: '', compra: tc.compra, venta: tc.venta });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: 'No se pudo obtener el tipo de cambio.', compra: null, venta: null });
      }
    })();
    return () => { alive = false; };
  }, [date]);
  return state;
}

export function convertUsdToPen(usd, venta) {
  const u = Number(usd);
  const v = Number(venta);
  if (!isFinite(u) || !isFinite(v) || v <= 0) return null;
  return u * v;
}

export function convertPenToUsd(pen, venta) {
  const p = Number(pen);
  const v = Number(venta);
  if (!isFinite(p) || !isFinite(v) || v <= 0) return null;
  return p / v;
}

export const EXCHANGE_API_URL = EXCHANGE_API;

