import React, { useMemo, useState } from 'react';

const LUGARES = [
  { value: 'almacen', label: 'Almacen' },
  { value: 'coordinar', label: 'Coordinar' },
  { value: 'centro_comercial', label: 'Centro comercial' },
];

const normalizePhonePe = (raw) => {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('51') && digits.length >= 11) return digits.slice(-9);
  if (digits.length >= 9) return digits.slice(-9);
  return digits;
};

const copyText = async (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export default function ModalVentaMensaje({ onClose, productos = [] }) {
  const [telefono, setTelefono] = useState('');
  const [productoId, setProductoId] = useState('');
  const [precio, setPrecio] = useState('');
  const [lugar, setLugar] = useState('almacen');
  const [copied, setCopied] = useState('');

  const tel9 = useMemo(() => normalizePhonePe(telefono), [telefono]);
  const numeroPe = tel9 ? `+51${tel9}` : '';
  const selectedProduct = useMemo(
    () => productos.find((p) => String(p.id) === String(productoId)) || null,
    [productos, productoId],
  );
  const lugarLabel = useMemo(
    () => LUGARES.find((x) => x.value === lugar)?.label || 'Coordinar',
    [lugar],
  );

  const waBase = numeroPe ? `wa.me/${numeroPe}` : '';
  const waText = [
    waBase,
    `Producto: ${selectedProduct?.label || '-'}`,
    `Precio acordado: ${precio ? `S/ ${precio}` : '-'}`,
    `Lugar: ${lugarLabel}`,
    tel9 || '-',
  ].join('\n');

  const canGenerate = Boolean(numeroPe && selectedProduct && String(precio || '').trim());

  const onCopy = async (key, value) => {
    const ok = await copyText(value);
    if (!ok) {
      alert('No se pudo copiar automaticamente.');
      return;
    }
    setCopied(key);
    setTimeout(() => setCopied(''), 1200);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg p-4 sm:p-6 relative max-h-[92dvh] overflow-auto">
        <button
          className="absolute right-3 top-3 w-10 h-10 flex items-center justify-center text-2xl font-bold rounded-full border border-gray-300 bg-white hover:bg-gray-100"
          onClick={onClose}
          aria-label="Cerrar"
        >
          &times;
        </button>

        <h3 className="text-xl font-semibold mb-4">Venta</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Numero de la persona</span>
            <input
              type="text"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 987654321 o +51..."
              className="w-full border rounded px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Lugar</span>
            <select className="w-full border rounded px-3 py-2" value={lugar} onChange={(e) => setLugar(e.target.value)}>
              {LUGARES.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <label className="text-sm sm:col-span-2">
            <span className="block text-gray-600 mb-1">Producto</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
            >
              <option value="">Selecciona un producto</option>
              {productos.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.label}</option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Precio acordado (S/)</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
              placeholder="0.00"
              className="w-full border rounded px-3 py-2"
            />
          </label>

          <label className="text-sm">
            <span className="block text-gray-600 mb-1">Numero final</span>
            <input
              type="text"
              value={numeroPe}
              readOnly
              className="w-full border rounded px-3 py-2 bg-gray-50"
            />
          </label>
        </div>

        <div className="mt-4 border rounded-lg p-3 bg-gray-50">
          <div className="text-sm font-medium mb-1">Texto para copiar</div>
          <textarea
            className="w-full min-h-[130px] border rounded px-3 py-2 text-sm font-mono"
            readOnly
            value={canGenerate ? waText : ''}
            placeholder="Completa numero, producto y precio para generar el texto."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
              disabled={!canGenerate}
              onClick={() => onCopy('wa', waText)}
            >
              {copied === 'wa' ? 'Copiado' : 'Copiar texto'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
