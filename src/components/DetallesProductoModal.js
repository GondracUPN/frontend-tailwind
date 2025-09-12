// src/components/DetallesProductoModal.js

import React, { useState, useEffect } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';
import api from '../api';


export default function DetallesProductoModal({ producto, onClose, onSaved }) {
  // ----- 1. Estado e inicialización -----
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    conCaja: '',           // 'si' | 'no'
    detalle: {},           // dinámico según tipo
  });

  // ----- 2. Cargar datos al montar / cambiar producto -----
  useEffect(() => {
    if (!producto) return;
    setForm({
      tipo: producto.tipo,
      estado: producto.estado,
      conCaja: producto.conCaja ? 'si' : 'no',
      detalle: { ...producto.detalle },
    });
    setIsEditing(false);
  }, [producto]);

  // ----- 3. Handlers genéricos -----
  const handleMainChange = (field, value) =>
    setForm(f => ({ ...f, [field]: value }));
  const handleDetalleChange = (field, value) =>
    setForm(f => ({ ...f, detalle: { ...f.detalle, [field]: value } }));


  // ----- 4. Guardar cambios (PATCH) -----
  const handleSave = async () => {
    // convierte "si"/"no" a booleano
    const conCajaBool = form.conCaja === 'si';

    // payload completo con todos los campos editables
    const payload = {
      tipo: form.tipo,
      estado: form.estado,
      conCaja: conCajaBool,
      detalle: form.detalle,
    };

    console.log('📝 payload:', payload);
    try {
      const updated = await api.patch(`/productos/${producto.id}`, payload);
      onSaved(updated);
      setIsEditing(false);
    } catch (e) {
      console.error('[DetallesProductoModal] Error al guardar:', e);
      alert('No se pudo actualizar el producto.');
    }

  };

  // ----- 5. Renderizado -----
  if (!producto) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-3xl rounded-xl shadow-lg p-6 relative">
        {/* Cerrar modal */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >✖</button>

        {!isEditing ? (
          <>
            {/* --- Vista solo lectura --- */}
            <h2 className="text-2xl font-semibold mb-4">{producto.tipo}</h2>

            <section className="mb-4">
              <h3 className="font-medium mb-2">Especificaciones</h3>
              <ul className="list-disc list-inside text-gray-700 space-y-1">
                {Object.entries(producto.detalle)
                  .filter(([k, v]) => k !== 'id' && v)   // ⬅️ esta línea es el cambio
                  .map(([k, v]) => (
                    <li key={k}>
                      <span className="capitalize">
                        {k.replace(/([A-Z])/g, ' $1')}:
                      </span>{' '}
                      {v}
                    </li>
                  ))}
              </ul>
            </section>



            <div className="flex justify-end space-x-2">
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                onClick={() => setIsEditing(true)}
              >Editar</button>
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >Cerrar</button>
            </div>
          </>
        ) : (
          <>
            {/* --- Vista edición --- */}
            <h2 className="text-2xl font-semibold mb-4">Editar Producto</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna 1: tipo, detalle, estado, conCaja */}
              <div className="space-y-4">
                <div>
                  <label className="block font-medium">Tipo</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={form.tipo}
                    onChange={e => handleMainChange('tipo', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="macbook">Macbook</option>
                    <option value="ipad">iPad</option>
                    <option value="iphone">iPhone</option>
                    <option value="watch">Apple Watch</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {form.tipo === 'macbook' && (
                  <FormProductoMacbook detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'ipad' && (
                  <FormProductoIpad detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'iphone' && (
                  <FormProductoIphone detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'watch' && (
                  <FormProductoWatch detalle={form.detalle} onChange={handleDetalleChange} />
                )}
                {form.tipo === 'otro' && (
                  <FormProductoOtro onChange={v => handleDetalleChange('descripcionOtro', v)} />
                )}

                <div>
                  <label className="block font-medium">Estado</label>
                  <select
                    className="w-full border p-2 rounded"
                    value={form.estado}
                    onChange={e => handleMainChange('estado', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="roto">Roto</option>
                  </select>
                </div>

                {form.estado === 'usado' && (
                  <div>
                    <label className="block font-medium">¿Tiene caja?</label>
                    <select
                      className="w-full border p-2 rounded"
                      value={form.conCaja}
                      onChange={e => handleMainChange('conCaja', e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                )}
              </div>


            </div>

            <div className="text-right mt-6 space-x-2">
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                onClick={handleSave}
              >Guardar cambios</button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={() => setIsEditing(false)}
              >Cancelar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
