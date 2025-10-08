// src/components/ModalRecurrentesCuotas.jsx
import React, { useState } from 'react';

export default function ModalRecurrentesCuotas({ onClose }) {
  const [tab, setTab] = useState('debito'); // debito | credito
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if(e.target===e.currentTarget) onClose?.(); }}>
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6 relative" onClick={(e)=>e.stopPropagation()}>
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>×</button>
        <h2 className="text-lg font-semibold mb-3">Recurrentes y cuotas</h2>

        <div className="flex gap-2 mb-4">
          <button className={`px-3 py-1.5 rounded ${tab==='debito'?'bg-gray-900 text-white':'bg-gray-100'}`} onClick={()=>setTab('debito')}>Débito</button>
          <button className={`px-3 py-1.5 rounded ${tab==='credito'?'bg-gray-900 text-white':'bg-gray-100'}`} onClick={()=>setTab('credito')}>Crédito</button>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <section className="border rounded p-3">
            <h3 className="font-semibold mb-2">Gastos recurrentes ({tab})</h3>
            <div className="text-sm text-gray-600 mb-2">Lista de recurrentes (monto, fecha de cobro, última ejecución).</div>
            <div className="text-xs text-gray-500">Sin datos por ahora. Este módulo se conectará cuando el backend esté listo.</div>
          </section>
          <section className="border rounded p-3">
            <h3 className="font-semibold mb-2">Cuotas ({tab})</h3>
            <div className="text-sm text-gray-600 mb-2">Lista de deudas en cuotas (monto, cuotas, cronograma).</div>
            <div className="text-xs text-gray-500">Sin datos por ahora. Este módulo se conectará cuando el backend esté listo.</div>
          </section>
        </div>
      </div>
    </div>
  );
}

