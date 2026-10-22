import React from 'react';
import CobroVentaForm from './CobroVentaForm';

export default function ModalCobroVenta({ gasto, onClose, onSaved }) {
  const isX500 = gasto.salePaymentType === 'debt';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={`Cobro de venta ${gasto.saleSku || gasto.saleId}`}>
      <div className="max-h-[90vh] w-full max-w-md space-y-4 overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-xl font-semibold">{isX500 ? 'Cobros x500' : 'Cobro de deuda'}</h2><p className="text-sm text-slate-600">SKU: {gasto.saleSku || `Venta #${gasto.saleId}`}</p></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-xl text-slate-500">×</button>
        </div>
        <CobroVentaForm gasto={gasto} onCancel={onClose} onSaved={onSaved} />
      </div>
    </div>
  );
}
