import React, { useState } from 'react';
import api from '../api';

export default function ModalAdelantoCompletar({ adelanto, producto, onClose, onSaved }) {
  const [fechaVenta, setFechaVenta] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  const [saving, setSaving] = useState(false);

  if (!adelanto || !producto) return null;

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
    setSaving(true);
    try {
      const saved = await api.post(`/ventas/adelanto/${adelanto.id}/completar`, {
        fechaVenta,
        tipoCambio: Number(tipoCambio),
      });
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
