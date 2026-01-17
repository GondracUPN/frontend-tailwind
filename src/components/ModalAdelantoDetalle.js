import React from 'react';

const fmt = (v) => (v != null ? Number(v).toFixed(2) : '0.00');

export default function ModalAdelantoDetalle({ adelanto, producto, onClose, onCompletar }) {
  if (!adelanto || !producto) return null;

  const montoAdelanto = Number(adelanto.montoAdelanto || 0);
  const montoVenta = Number(adelanto.montoVenta || 0);
  const restante = Math.max(montoVenta - montoAdelanto, 0);

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
        <div className="space-y-2 text-sm">
          <div>
            <span className="font-medium">Monto adelantado: </span>
            <span>S/ {fmt(montoAdelanto)}</span>
          </div>
          <div>
            <span className="font-medium">Fecha del adelanto: </span>
            <span>{adelanto.fechaAdelanto || '-'}</span>
          </div>
          <div>
            <span className="font-medium">Monto de la venta: </span>
            <span>S/ {fmt(montoVenta)}</span>
          </div>
          <div>
            <span className="font-medium">Restante por pagar: </span>
            <span>S/ {fmt(restante)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4">
          <button
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Cerrar
          </button>
          <button
            className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700"
            onClick={onCompletar}
          >
            Venta
          </button>
        </div>
      </div>
    </div>
  );
}
