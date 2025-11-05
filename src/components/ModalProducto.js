// src/components/ModalProducto.js
import React, { useState, useEffect } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';
import api from '../api';

export default function ModalProducto({ producto, onClose, onSaved }) {
  const isEdit = Boolean(producto);
  const [saving, setSaving] = useState(false); // 🔒 evita doble envío

  // ————— Estado e inicialización —————
  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    accesorios: [],    // ['Caja','Cubo','Cable'] o ['Todos']
    casillero: '',
    detalle: {
      gama: '', procesador: '', generacion: '',
      modelo: '', tamaño: '',
      almacenamiento: '', ram: '',
      conexion: '', descripcionOtro: '',
    },
    valor: {
      valorProducto: '', valorDec: '',
      peso: '', fechaCompra: '',
    },
  });

  useEffect(() => {
    if (!isEdit) return;

    setForm({
      tipo: producto.tipo || '',
      estado: producto.estado || '',
      accesorios: Array.isArray(producto.accesorios) ? producto.accesorios : [],
      casillero: producto.tracking?.[0]?.casillero || '',  // si existe tracking relacionado
      detalle: { ...producto.detalle },
      valor: {
        valorProducto: producto.valor?.valorProducto || '',
        valorDec: producto.valor?.valorDec || '',
        peso: producto.valor?.peso || '',
        fechaCompra: producto.valor?.fechaCompra || '',
      },
    });
  }, [isEdit, producto]);

  // ————— Handlers genéricos —————
  const onChange = (section, field, value) => {
    if (section === 'main') {
      setForm(f => ({ ...f, [field]: value }));
    } else {
      setForm(f => ({
        ...f,
        [section]: { ...f[section], [field]: value },
      }));
    }
  };

  // ————— Envío (POST o PATCH) —————
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (saving) return;         // ⛔ evita doble clic / Enter
    setSaving(true);            // 🔒 bloquea UI

    const url = isEdit ? `/productos/${producto.id}` : '/productos';
    const method = isEdit ? 'patch' : 'post';

    // Normalizar accesorios: si marcaron 'Todos' (o estado nuevo), enviar los 3
    let accesorios = Array.isArray(form.accesorios) ? [...form.accesorios] : [];
    const hasTodos = accesorios.includes('Todos');
    const isNuevo = String(form.estado || '').toLowerCase() === 'nuevo';
    if (hasTodos || isNuevo) accesorios = ['Caja','Cubo','Cable'];

    const base = { tipo: form.tipo, estado: form.estado, accesorios };


    const allowedDetalle = ['gama','procesador','generacion','numero','modelo','tamaño','almacenamiento','ram','conexion','descripcionOtro'];
    const cleanDetalle = Object.fromEntries(
      Object.entries(form.detalle || {}).filter(([k]) => allowedDetalle.includes(k))
    );



    const payload = { ...base, detalle: cleanDetalle, valor: form.valor };



    try {
      const res = await api[method](url, payload);
      const saved = res?.data ?? res; // ✅ Producto real (no AxiosResponse)

      // 👇 Crear o actualizar tracking con casillero
      if (form.casillero) {
        await api.put(`/tracking/producto/${saved.id}`, {
          casillero: form.casillero,
          estado: "comprado_sin_tracking",
        });

      }

      onSaved(saved);
      onClose();
    } catch (err) {

      console.error('Error al guardar:', err);
      alert('No se pudo guardar el producto.');
    } finally {
      setSaving(false);         // 🔓 libera UI si el modal sigue abierto
    }
  };

  // ————— Renderizado —————
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-5xl rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cerrar */}
        <button
          className={`absolute top-4 right-4 ${saving ? 'opacity-50 cursor-not-allowed' : 'text-gray-500 hover:text-gray-800'}`}
          onClick={saving ? undefined : onClose}
          disabled={saving}
          aria-disabled={saving}
        >✖</button>

        {/* Título */}
        <h2 className="text-2xl font-semibold mb-4">
          {isEdit ? 'Editar Producto' : 'Agregar Producto'}
        </h2>

        {/* Usa <form> para capturar Enter una sola vez */}
        <form onSubmit={handleSubmit}>
          {/* Fieldset deshabilita TODO cuando saving = true */}
          <fieldset disabled={saving} className={saving ? 'opacity-60 pointer-events-none' : ''}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* — Columna 1: Características — */}
              <div className="space-y-4">
                {/* Tipo */}
                <div>
                  <label className="block font-medium">Tipo de Producto</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.tipo}
                    onChange={e => onChange('main', 'tipo', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="macbook">Macbook</option>
                    <option value="ipad">iPad</option>
                    <option value="iphone">iPhone</option>
                    <option value="watch">Apple Watch</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                {/* Subformularios */}
                {form.tipo === 'macbook' && (
                  <FormProductoMacbook
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'ipad' && (
                  <FormProductoIpad
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'iphone' && (
                  <FormProductoIphone
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'watch' && (
                  <FormProductoWatch
                    detalle={form.detalle}
                    onChange={(f, v) => onChange('detalle', f, v)}
                  />
                )}
                {form.tipo === 'otro' && (
                  <FormProductoOtro
                    value={form.detalle?.descripcionOtro || ''}
                    onChange={v => onChange('detalle', 'descripcionOtro', v)}
                  />
                )}

                {/* Estado */}
                <div>
                  <label className="block font-medium">Estado</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.estado}
                    onChange={e => onChange('main', 'estado', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="nuevo">Nuevo</option>
                    <option value="usado">Usado</option>
                    <option value="roto">Roto</option>
                  </select>
                </div>

                {/* Accesorios */}
                <div>
                  <label className="block font-medium mb-1">Accesorios</label>
                  {(() => {
                    const isNuevo = String(form.estado||'').toLowerCase()==='nuevo';
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
                  {String(form.estado||'').toLowerCase()==='nuevo' && (
                    <p className="text-sm text-gray-500 mt-1">Estado "Nuevo" fuerza Todos (Caja, Cubo y Cable).</p>
                  )}
                </div>

                {/* Casillero */}
                <div>
                  <label className="block font-medium">Casillero</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.casillero}
                    onChange={e => onChange('main', 'casillero', e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="Walter">Walter</option>
                    <option value="Renato">Renato</option>
                    <option value="Christian">Christian</option>
                    <option value="Alex">Alex</option>
                    <option value="MamaRen">MamaRen</option>
                    <option value="Jorge">Jorge</option>
                    <option value="Kenny">Kenny</option>
                  </select>
                </div>


              </div>

              {/* — Columna 2: Valores — */}
              <div className="space-y-4">
                {['valorProducto', 'valorDec', 'peso', 'fechaCompra'].map(field => (
                  <div key={field}>
                    <label className="block font-medium mb-1">
                      {{
                        valorProducto: 'Valor Producto ($)',
                        valorDec: 'Valor DEC ($)',
                        peso: 'Peso (kg)',
                        fechaCompra: 'Fecha de Compra'
                      }[field]}
                    </label>
                    <input
                      type={field === 'fechaCompra' ? 'date' : 'number'}
                      className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={form.valor[field]}
                      onChange={e => onChange('valor', field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </fieldset>

          {/* Botón Guardar */}
          <div className="text-right mt-6">
            <button
              className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              type="submit"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Guardando…' : (isEdit ? 'Guardar cambios' : 'Guardar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



