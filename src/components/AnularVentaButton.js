import React, { useState } from 'react';
import api from '../api';
import { sesionFinanciera, limpiarError } from '../services/finanzas';
import { notifySalesChanged } from '../utils/salesSync';

export const CONFIRMAR_ANULACION = '¿Anular esta venta? Se retirarán sus ingresos de Gastos y sus cobros, y el producto volverá a estar disponible.';
const etiquetaVenta = (venta) => [`Venta #${venta.id}`, venta.fechaVenta && String(venta.fechaVenta).slice(0, 10),
  (venta.precioVenta ?? venta.ventaBruta) != null && `S/ ${Number(venta.precioVenta ?? venta.ventaBruta).toFixed(2)}`].filter(Boolean).join(' · ');

// Anulación completa de la venta (sin monto, cuenta ni destino). Solo administradores.
export default function AnularVentaButton({ venta, onAnulada, className = '' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!venta?.id || venta.anuladaAt || venta.estadoComercial === 'cancelada' || !sesionFinanciera().esAdmin) return null;
  const anular = async () => {
    if (busy || !window.confirm(`${etiquetaVenta(venta)}\n${CONFIRMAR_ANULACION}`)) return;
    setBusy(true); setError('');
    try {
      const anulada = await api.post(`/ventas/${venta.id}/anular`, {});
      notifySalesChanged({ action: 'cancel', anulada: true, ventaId: venta.id, productoId: venta.productoId });
      onAnulada?.(anulada || { ...venta, estadoComercial: 'cancelada' });
    } catch (e) {
      setError(limpiarError(e) || 'No se pudo anular la venta.');
    } finally { setBusy(false); }
  };
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" disabled={busy} onClick={anular}
        className={className || 'px-3 py-2 rounded border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60'}>
        {busy ? 'Anulando…' : 'Anular venta'}
      </button>
      {error && <span role="alert" className="text-xs text-red-700">{error}</span>}
    </span>
  );
}
