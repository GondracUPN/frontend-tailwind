// src/components/ModalVenta.jsx
import React, { useEffect, useState } from 'react';
import api from '../api';

export default function ModalVenta({
  producto,
  venta,
  onClose,
  onSaved,
  allowVendedorOnCreate = false, // permite elegir vendedor al crear
  presetVendedor = '',           // valor inicial del vendedor
}) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    tipoCambio: '',
    fechaVenta: '',
    precioVenta: '',
    vendedor: '',
  });
  const [saving, setSaving] = useState(false);

  const isReadOnly = Boolean(venta) && !editMode;

  useEffect(() => {
    if (venta) {
      setForm({
        tipoCambio: venta.tipoCambio != null ? String(venta.tipoCambio) : '',
        fechaVenta: venta.fechaVenta ?? '',
        precioVenta: venta.precioVenta != null ? String(venta.precioVenta) : '',
        vendedor: (venta.vendedor ?? '') + '',
      });
    } else {
      setForm({
        tipoCambio: '',
        fechaVenta: '',
        precioVenta: '',
        vendedor: allowVendedorOnCreate ? (presetVendedor || '') : '',
      });
    }
  }, [venta, editMode, allowVendedorOnCreate, presetVendedor]);

  if (!producto) return null;

  const onChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const validate = () => {
    if (!form.tipoCambio || !form.fechaVenta || !form.precioVenta) {
      alert('Completa Tipo de cambio, Fecha de venta y Precio de venta.');
      return false;
    }
    return true;
  };

  const handleSaveCreate = async () => {
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        productoId: producto.id,
        tipoCambio: Number(form.tipoCambio),
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
      };
      if (allowVendedorOnCreate && form.vendedor?.trim()) {
        body.vendedor = form.vendedor.trim();
      }
      const saved = await api.post(`/ventas`, body);
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al guardar venta:', e);
      alert('No se pudo guardar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!venta) return;
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const updated = await api.patch(`/ventas/${venta.id}`, {
        tipoCambio: Number(form.tipoCambio),
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
        vendedor: form.vendedor?.trim() ? form.vendedor.trim() : null,
      });
      onSaved?.(updated);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al actualizar venta:', e);
      alert('No se pudo actualizar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => setEditMode(true);
  const cancelEdit = () => setEditMode(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative">
        {/* Cerrar (X) */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          ✖
        </button>

        {/* Título */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">
            {venta ? (isReadOnly ? 'Detalle de Venta' : 'Editar Venta') : 'Registrar Venta'}
          </h2>
          {/* ❌ Ya no mostramos el botón Editar aquí en modo lectura */}
        </div>

        {/* Crear nueva venta */}
        {!venta && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Tipo de cambio</label>
              <input
                type="number"
                step="0.0001"
                className="w-full border p-2 rounded"
                value={form.tipoCambio}
                onChange={e => onChange('tipoCambio', e.target.value)}
                placeholder="Ej. 3.85"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Fecha de venta</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={form.fechaVenta}
                onChange={e => onChange('fechaVenta', e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Precio de venta (S/)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border p-2 rounded"
                value={form.precioVenta}
                onChange={e => onChange('precioVenta', e.target.value)}
                placeholder="Ej. 2499.90"
              />
            </div>

            {allowVendedorOnCreate && (
              <div>
                <label className="block font-medium mb-1">Vendedor (opcional)</label>
                <select
                  className="w-full border p-2 rounded"
                  value={form.vendedor}
                  onChange={e => onChange('vendedor', e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  <option value="Gonzalo">Gonzalo</option>
                  <option value="Renato">Renato</option>
                </select>
              </div>
            )}

            <div className="text-right">
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveCreate}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Modo lectura (ver información) */}
        {venta && isReadOnly && (
          <div className="space-y-3">
            <div>
              <span className="font-medium">Fecha de venta: </span>
              <span className="text-gray-700">{venta.fechaVenta}</span>
            </div>
            <div>
              <span className="font-medium">Tipo de cambio: </span>
              <span className="text-gray-700">{Number(venta.tipoCambio).toFixed(4)}</span>
            </div>
            <div>
              <span className="font-medium">Precio de venta (S/): </span>
              <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
            </div>
            <div>
              <span className="font-medium">% Ganancia: </span>
              <span className="text-gray-700">{Number(venta.porcentajeGanancia).toFixed(3)}%</span>
            </div>
            <div>
              <span className="font-medium">Ganancia neta (S/): </span>
              <span className="text-gray-700">{Number(venta.ganancia).toFixed(2)}</span>
            </div>
            {venta.vendedor != null && (
              <div>
                <span className="font-medium">Vendedor: </span>
                <span className="text-gray-700">{String(venta.vendedor || '')}</span>
              </div>
            )}

            {/* ✅ Botones: Cerrar y Editar juntos */}
            <div className="text-right pt-2 flex items-center justify-end gap-2">
              
              <button
                className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                onClick={startEdit}
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Modo edición */}
        {venta && !isReadOnly && (
          <div className="space-y-4">
            <div>
              <label className="block font-medium mb-1">Tipo de cambio</label>
              <input
                type="number"
                step="0.0001"
                className="w-full border p-2 rounded"
                value={form.tipoCambio}
                onChange={e => onChange('tipoCambio', e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Fecha de venta</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
                value={form.fechaVenta}
                onChange={e => onChange('fechaVenta', e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Precio de venta (S/)</label>
              <input
                type="number"
                step="0.01"
                className="w-full border p-2 rounded"
                value={form.precioVenta}
                onChange={e => onChange('precioVenta', e.target.value)}
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Vendedor (opcional)</label>
              <select
                className="w-full border p-2 rounded"
                value={form.vendedor}
                onChange={e => onChange('vendedor', e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                <option value="Gonzalo">Gonzalo</option>
                <option value="Renato">Renato</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
