// src/components/ModalProducto.js
import React, { useState, useEffect } from 'react';
import FormProductoMacbook from './formParts/FormProductoMacbook';
import FormProductoIpad from './formParts/FormProductoIpad';
import FormProductoIphone from './formParts/FormProductoIphone';
import FormProductoWatch from './formParts/FormProductoWatch';
import FormProductoOtro from './formParts/FormProductoOtro';

export default function ModalProducto({ producto, onClose, onSaved }) {
  const isEdit = Boolean(producto);

  // ————— Estado e inicialización —————
  const [form, setForm] = useState({
    tipo: '',
    estado: '',
    conCaja: '',       // '' obliga a seleccionar
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
      conCaja: producto.conCaja ? 'si' : 'no',
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
  const handleSubmit = async () => {
    const url = isEdit
      ? `/productos/${producto.id}`
      : '/productos';
    const method = isEdit ? 'PATCH' : 'POST';

    // convertimos 'si'/'no' → booleano
    const conCajaBool = form.conCaja === 'si';

    // payload: siempre enviamos estos campos
    const base = {
      tipo: form.tipo,
      estado: form.estado,
      conCaja: form.conCaja === 'si',
    };

    const payload = isEdit
      ? { ...base, detalle: form.detalle, valor: form.valor }
      : { ...base, detalle: form.detalle, valor: form.valor };

    console.log('📝 [ModalProducto] → PATCH payload:', payload);

    try {
      console.log(payload)
      const res = await fetch(`http://localhost:3000${url}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      onSaved(saved);
      onClose();
    } catch (err) {
      console.error('Error al guardar:', err);
      alert('No se pudo guardar el producto.');
    }
  };

  // ————— Renderizado —————
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded-xl shadow-lg p-6 relative">
        {/* Cerrar */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >✖</button>

        {/* Título */}
        <h2 className="text-2xl font-semibold mb-4">
          {isEdit ? 'Editar Producto' : 'Agregar Producto'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* — Columna 1: Características — */}
          <div className="space-y-4">
            {/* Tipo */}
            <div>
              <label className="block font-medium">Tipo de Producto</label>
              <select
                className="w-full border p-2 rounded"
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
                className="w-full border p-2 rounded"
                value={form.estado}
                onChange={e => onChange('main', 'estado', e.target.value)}
              >
                <option value="">Selecciona</option>
                <option value="nuevo">Nuevo</option>
                <option value="usado">Usado</option>
                <option value="roto">Roto</option>
              </select>
            </div>

            {/* ConCaja */}
            {form.estado === 'usado' && (
              <div>
                <label className="block font-medium">¿Tiene caja?</label>
                <select
                  className="w-full border p-2 rounded"
                  value={form.conCaja}
                  onChange={e => onChange('main', 'conCaja', e.target.value)}
                >
                  <option value="">Selecciona</option>
                  <option value="si">Sí</option>
                  <option value="no">No</option>
                </select>
              </div>
            )}
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
                  type={field === 'fechaCompra' ? 'date' : (field === 'tracking' ? 'text' : 'number')}
                  className="w-full border p-2 rounded"
                  value={form.valor[field]}
                  onChange={e => onChange('valor', field, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="text-right mt-6">
          <button
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
            onClick={handleSubmit}
          >
            {isEdit ? 'Guardar cambios' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
