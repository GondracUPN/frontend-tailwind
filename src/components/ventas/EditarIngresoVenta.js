import React, { useState } from 'react';
import api from '../../api';

// Gastos conserva las filas contables, pero una reserva siempre se gestiona
// desde su panel, incluso cuando el ingreso ya tiene un saleId.
export default function EditarIngresoVenta({ ingreso, onAdvance, onSale }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const match = String(ingreso.notas || '').match(/^__SALE_ADVANCE__:(\d+):(\d+)$/);
  const open = async () => {
    setError('');
    if (match) { onAdvance({ id: Number(match[1]), index: Number(match[2]) }); return; }
    setLoading(true);
    try {
      const data = await api.get(`/ventas/${ingreso.saleId}/cobros`);
      if (data.adelantoId) onAdvance({ id: data.adelantoId });
      else onSale(ingreso.saleId);
    } catch (err) { setError(err.message || 'No se pudo abrir la venta. Intenta otra vez.'); }
    finally { setLoading(false); }
  };
  const label = match ? `Editar adelanto ${Number(match[2]) + 1} de ${ingreso.saleSku || 'la venta'}` : `Editar venta ${ingreso.saleSku || ingreso.saleId}`;
  return <span>
    <button type="button" title={label} aria-label={label} onClick={open} disabled={loading} className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-slate-500">
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><path d="m16 3 5 5-12 12-6 1 1-6L16 3Zm0 3L6 16l-.4 2.4L8 18 18 8l-2-2Z" /></svg>
    </button>
    {error && <span aria-live="polite" className="block text-xs text-red-700">{error}</span>}
  </span>;
}
