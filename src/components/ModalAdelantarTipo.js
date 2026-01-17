import React from 'react';

export default function ModalAdelantarTipo({ producto, onClose, onVentaCompleta, onAdelanto }) {
  if (!producto) return null;

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
        <h2 className="text-xl font-semibold mb-4">Adelantar venta</h2>
        <div className="text-sm text-gray-600 mb-6">
          Selecciona el tipo de registro para {producto?.tipo || 'producto'}.
        </div>
        <div className="flex flex-col gap-3">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={onVentaCompleta}
          >
            Venta Completa
          </button>
          <button
            className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
            onClick={onAdelanto}
          >
            Adelanto
          </button>
        </div>
      </div>
    </div>
  );
}
