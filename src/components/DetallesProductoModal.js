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
    accesorios: [],        // ['Caja','Cubo','Cable'] o ['Todos']
    detalle: {},           // dinámico según tipo
  });

  // ----- 2. Cargar datos al montar / cambiar producto -----
  useEffect(() => {
    if (!producto) return;
    setForm({
      tipo: producto.tipo,
      estado: producto.estado,
      accesorios: Array.isArray(producto.accesorios) ? producto.accesorios : [],
      detalle: { ...producto.detalle }, // viene con 'id' -> se filtrará en handleSave
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
    // Normaliza accesorios para backend
    let accesorios = Array.isArray(form.accesorios) ? [...form.accesorios] : [];
    const hasTodos = accesorios.includes('Todos');
    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
    if (hasTodos || isNuevo) accesorios = ['Caja','Cubo','Cable'];

    // Lista blanca de campos permitidos en 'detalle' (sin 'id')
    const cleanDetalle = Object.fromEntries(
      Object.entries(form.detalle || {}).filter(([k]) => k !== 'id')
    );
    // payload completo con todos los campos editables (sin 'detalle.id')
    const payload = { tipo: form.tipo, estado: form.estado, accesorios, detalle: cleanDetalle };

    try {
    
      const res = await api.patch('/productos/' + producto.id, payload);
      const updated = res?.data ?? res;
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
      <div className="bg-white w-full sm:max-w-3xl rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
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
                {Object
                  .entries(producto.detalle)
                  .filter(([k, v]) => k !== 'id' && v) // no mostrar 'id'
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
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            {/* --- Vista edición --- */}
            <h2 className="text-2xl font-semibold mb-4">Editar Producto</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Columna 1: tipo, detalle, estado, accesorios */}
              <div className="space-y-4">
                <div>
                  <label className="block font-medium">Tipo</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
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
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.estado}
                    onChange={e => handleMainChange('estado', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="roto">Roto</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Accesorios</label>
                  {(() => {
                    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
                    const todos = Array.isArray(form.accesorios) && form.accesorios.includes('Todos');
                    const disabledGroup = isNuevo || todos;
                    return (
                      <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 ${disabledGroup ? 'opacity-60' : ''}`}>
                        {['Caja','Cubo','Cable','Todos'].map(opt => (
                          <label key={opt} className={`flex items-center gap-2 border rounded px-3 py-2 cursor-pointer ${isNuevo ? 'pointer-events-none' : ''}`}>
                            <input
                              type="checkbox"
                              className="accent-indigo-600"
                              checked={isNuevo ? true : (opt==='Todos' ? todos : (todos ? true : (form.accesorios||[]).includes(opt)))}
                              disabled={opt!=='Todos' && (isNuevo || todos)}
                              onChange={e => {
                                const checked = e.target.checked;
                                setForm(f => {
                                  let next = Array.isArray(f.accesorios) ? [...f.accesorios] : [];
                                  if (opt==='Todos') {
                                    // toggle 'Todos' únicamente; el resto se muestra marcado visualmente
                                    return { ...f, accesorios: checked ? Array.from(new Set([...next,'Todos'])) : next.filter(x=>x!=='Todos') };
                                  }
                                  if (checked) next = Array.from(new Set([...next, opt])); else next = next.filter(x=>x!==opt);
                                  return { ...f, accesorios: next };
                                });
                              }}
                            />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })()}
                  {String(form.estado || '').toLowerCase() === 'nuevo' && (
                    <p className="text-sm text-gray-500 mt-1">Estado "Nuevo" fuerza Todos (Caja, Cubo y Cable).</p>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right mt-6 space-x-2">
              <button
                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                onClick={handleSave}
              >
                Guardar cambios
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


