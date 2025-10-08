// src/utils/tipoCambio.js (sin llamadas externas)
// Tipo de cambio fijo y helpers de conversión.
import { useMemo } from 'react';

export const TC_FIJO = 3.7;

// Hook de compatibilidad: devuelve el TC fijo sin loading
export function useTipoCambio() {
  return useMemo(() => ({ loading: false, error: '', compra: TC_FIJO, venta: TC_FIJO }), []);
}

// Función async de compatibilidad: resuelve al TC fijo
export async function getTipoCambio() {
  return { compra: TC_FIJO, venta: TC_FIJO };
}

export function convertUsdToPen(usd, venta = TC_FIJO) {
  const u = Number(usd);
  const v = Number(venta);
  if (!isFinite(u) || !isFinite(v) || v <= 0) return null;
  return u * v;
}

export function convertPenToUsd(pen, venta = TC_FIJO) {
  const p = Number(pen);
  const v = Number(venta);
  if (!isFinite(p) || !isFinite(v) || v <= 0) return null;
  return p / v;
}

