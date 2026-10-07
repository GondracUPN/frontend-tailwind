import React, { useState } from 'react';
import api from '../api';
import { notifyGastosChanged } from '../utils/gastosSync';
import { notifySalesChanged } from '../utils/salesSync';

export default function ModalAdelantoCompletar({ adelanto, producto, onClose, onSaved }) {
  const [fechaVenta, setFechaVenta] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [incomeBank, setIncomeBank] = useState('bcp');
  const [incomePaymentType, setIncomePaymentType] = useState('direct');
  const [mixedPayment, setMixedPayment] = useState(false);
  const [paymentParts, setPaymentParts] = useState({});
  const [saving, setSaving] = useState(false);

  if (!adelanto || !producto) return null;
  const remaining = Math.max(0, Math.round((Number(adelanto.montoVenta || 0) - Number(adelanto.montoAdelanto || 0)) * 100) / 100);
  const selectedParts = ['direct', 'card', 'debt', 'cash'].filter((type) => paymentParts[type] !== undefined && paymentParts[type] !== '')
    .map((type) => ({ type, amount: Number(paymentParts[type]) }));

  const handleSave = async () => {
    if (!fechaVenta) {
      alert('Selecciona la fecha del pago.');
      return;
    }
    if (!tipoCambio) {
      alert('Ingresa el tipo de cambio.');
      return;
    }
    if (saving) return;
    if (mixedPayment && (selectedParts.length === 0 || selectedParts.some((part) => !Number.isFinite(part.amount) || part.amount <= 0)
      || selectedParts.reduce((sum, part) => sum + Math.round(part.amount * 100), 0) !== Math.round(remaining * 100))) {
      alert(`Los pagos del saldo deben sumar S/ ${remaining.toFixed(2)}.`);
      return;
    }
    setSaving(true);
    try {
      const saved = await api.post(`/ventas/adelanto/${adelanto.id}/completar`, {
        fechaVenta,
        tipoCambio: Number(tipoCambio),
        incomeBank,
        incomePaymentType,
        ...(mixedPayment && remaining > 0 ? { incomeParts: selectedParts } : {}),
      });
      try { localStorage.removeItem('ganancias:cache:v1'); } catch {}
      notifySalesChanged({
        action: 'create',
        venta: { ...saved, producto: saved?.producto || producto },
        producto,
        productoId: producto.id,
      });
      notifyGastosChanged({ action: 'sale-income', ventaId: saved?.id, seller: saved?.vendedor || producto?.vendedor });
      onSaved?.(saved);
    } catch (e) {
      console.error('[ModalAdelantoCompletar] Error al completar venta:', e);
      alert('No se pudo completar la venta.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-md rounded-xl shadow-lg p-6 relative mx-4">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          x
        </button>
        <h2 className="text-2xl font-semibold mb-4">Completar venta</h2>
        <div>
          <label className="block font-medium mb-1">Fecha del pago</label>
          <input
            type="date"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={fechaVenta}
            onChange={(e) => setFechaVenta(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <label className="block font-medium mb-1">Tipo de cambio</label>
          <input
            type="number"
            step="0.0001"
            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
            placeholder="Ej. 3.85"
          />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block font-medium">Pago del saldo<select value={incomePaymentType} onChange={(event) => setIncomePaymentType(event.target.value)} className="mt-1 w-full border p-2 rounded"><option value="direct">Directo</option><option value="card">Tarjeta</option></select></label>
          <label className="block font-medium">Cuenta de destino<select value={incomeBank} onChange={(event) => setIncomeBank(event.target.value)} className="mt-1 w-full border p-2 rounded"><option value="bcp">BCP</option><option value="interbank">Interbank</option><option value="bbva">BBVA</option></select></label>
        </div>
        {remaining > 0 && <div className="mt-3 rounded border border-amber-200 p-3 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" checked={mixedPayment} onChange={(event) => setMixedPayment(event.target.checked)} />Combinar pagos del saldo (S/ {remaining.toFixed(2)})</label>
          {mixedPayment && <div className="mt-2 grid grid-cols-2 gap-2">{[
            ['direct', 'Directo'], ['card', 'Tarjeta'], ['debt', 'x500'], ['cash', 'Efectivo'],
          ].map(([type, label]) => <label key={type}>{label}<input aria-label={`${label} del saldo`} type="number" min="0" step="0.01" value={paymentParts[type] || ''} onChange={(event) => setPaymentParts((current) => ({ ...current, [type]: event.target.value }))} className="mt-1 w-full rounded border p-2" /></label>)}</div>}
        </div>}
        <div className="flex items-center justify-end gap-2 pt-4">
          <button
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            onClick={onClose}
            disabled={saving}
          >
            Cerrar
          </button>
          <button
            className={`bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
