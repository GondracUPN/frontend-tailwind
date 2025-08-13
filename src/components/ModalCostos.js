// src/components/ModalCostos.js
import React, { useState, useEffect } from 'react';

export default function ModalCostos({ producto, onClose, onSaved }) {
  const [form, setForm] = useState({
    valorProducto: '',
    valorDec:       '',
    peso:           '',
    fechaCompra:    '',
    tracking:       '',
  });

  useEffect(() => {
    if (!producto) return;
    const v = producto.valor || {};
    setForm({
      valorProducto: v.valorProducto ?? '',
      valorDec:       v.valorDec       ?? '',
      peso:           v.peso           ?? '',
      fechaCompra:    v.fechaCompra    ?? '',
      tracking:       v.tracking       ?? '',
    });
  }, [producto]);

  if (!producto) return null;

  const onChange = (f,v) => setForm(fm => ({ ...fm, [f]: v }));

  const handleSave = async () => {
    try {
      const res = await fetch(
        `http://localhost:3000/productos/${producto.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valor: form }),
        }
      );
      if (!res.ok) throw new Error();
      const updated = await res.json();
      onSaved(updated);
      onClose();
    } catch {
      alert('Error al guardar costos');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md relative">
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >✖</button>
        <h2 className="text-2xl font-semibold mb-4">Editar Costos</h2>
        <div className="space-y-4">
          {['valorProducto','valorDec','peso','fechaCompra'].map(field => (
            <div key={field}>
              <label className="block font-medium mb-1">
                {field === 'valorProducto' && 'Valor Producto ($)'}
                {field === 'valorDec' && 'Valor DEC (USD)'}
                {field === 'peso' && 'Peso (kg)'}
                {field === 'fechaCompra' && 'Fecha de Compra'}
              </label>
              <input
                type={field==='fechaCompra' ? 'date' : field==='tracking' ? 'text' : 'number'}
                className="w-full border p-2 rounded"
                value={form[field]}
                onChange={e => onChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6 space-x-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleSave}
          >
            Guardar
          </button>
          <button
            className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
