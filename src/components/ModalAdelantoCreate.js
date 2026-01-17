import React, { useState } from 'react';
import api from '../api';

export default function ModalAdelantoCreate({ producto, onClose, onSaved }) {
  const [form, setForm] = useState({
    montoAdelanto: '',
    fechaAdelanto: '',
    montoVenta: '',
  });
  const [saving, setSaving] = useState(false);

  if (!producto) return null;

  const onChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.montoAdelanto || !form.fechaAdelanto || !form.montoVenta) {
      alert('Completa monto adelantado, fecha y monto de venta.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (saving) return;
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        productoId: producto.id,
        montoAdelanto: Number(form.montoAdelanto),
        fechaAdelanto: form.fechaAdelanto,
        montoVenta: Number(form.montoVenta),
      };
      const saved = await api.post('/ventas/adelanto', payload);
      onSaved?.(saved);
    } catch (e) {
      console.error('[ModalAdelantoCreate] Error al guardar adelanto:', e);
      alert('No se pudo guardar el adelanto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg rounded-xl shadow-lg p-6 relative mx-4">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          x
        </button>
        <h2 className="text-2xl font-semibold mb-4">Adelanto</h2>

        <div className="space-y-4">
          <div>
            <label className="block font-medium mb-1">Monto adelantado (S/)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={form.montoAdelanto}
              onChange={(e) => onChange('montoAdelanto', e.target.value)}
              placeholder="Ej. 500.00"
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Fecha del adelanto</label>
            <input
              type="date"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={form.fechaAdelanto}
              onChange={(e) => onChange('fechaAdelanto', e.target.value)}
            />
          </div>
          <div>
            <label className="block font-medium mb-1">Monto de venta (S/)</label>
            <input
              type="number"
              step="0.01"
              className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              value={form.montoVenta}
              onChange={(e) => onChange('montoVenta', e.target.value)}
              placeholder="Ej. 2200.00"
            />
          </div>
        </div>

        <div className="text-right pt-4">
          <button
            className={`bg-amber-600 text-white px-6 py-2 rounded hover:bg-amber-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
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
