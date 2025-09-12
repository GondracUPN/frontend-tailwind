// src/components/ModalCalculadora.js
import React, { useMemo, useState } from 'react';

const fmtSoles = (v) => (isNaN(v) ? '—' : `S/ ${Number(v).toFixed(2)}`);
const roundUp10 = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return NaN;
  return Math.ceil(x / 10) * 10;
};

export default function ModalCalculadora({ producto, onClose }) {
  // Hooks siempre primero
  const costoTotal = Number(producto?.valor?.costoTotal ?? 0);
  const [precioCustom, setPrecioCustom] = useState('');

  const { pvMin, pvMed, customOut } = useMemo(() => {
    // precios sugeridos (base) → redondeados hacia arriba al múltiplo de 10
    const pvMinRounded = roundUp10(costoTotal * 1.20); // +20%
    const pvMedRounded = roundUp10(costoTotal * 1.40); // +40%

    // precio personalizado ingresado → también se aplica redondeo hacia arriba x10
    const pcRaw = Number(precioCustom);
    const pc = isNaN(pcRaw) ? NaN : roundUp10(pcRaw);

    const ganancia = isNaN(pc) ? 0 : pc - costoTotal;
    const pct = !isNaN(pc) && costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0;

    return {
      pvMin: pvMinRounded,
      pvMed: pvMedRounded,
      customOut: {
        precio: pc,      // precio personalizado aplicado (ya redondeado a x10)
        ganancia,
        pct,
      },
    };
  }, [costoTotal, precioCustom]);

  if (!producto) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-lg p-6 relative">
        {/* Cerrar */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >✖</button>

        <h2 className="text-xl font-semibold mb-1">Calculadora rápida</h2>
        <p className="text-sm text-gray-600 mb-4">
          Producto: <span className="font-medium">{producto?.tipo}</span> — Costo total base:{' '}
          <span className="font-semibold">{fmtSoles(costoTotal)}</span>
        </p>

        {/* Sugerencias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">
              Precio mínimo (+20%) <span className="italic text-xs">(redondeado ×10)</span>
            </div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMin)}</div>
          </div>
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">
              Precio medio (+40%) <span className="italic text-xs">(redondeado ×10)</span>
            </div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMed)}</div>
          </div>
        </div>

        {/* Personalizado */}
        <div className="border rounded-lg p-4">
          <label className="block text-sm font-medium mb-2">Precio personalizado (S/)</label>
          <input
            type="number"
            inputMode="decimal"
            className="w-full border rounded-lg p-2 mb-3"
            placeholder="Ingresa un precio en soles…"
            value={precioCustom}
            onChange={(e) => setPrecioCustom(e.target.value)}
          />

          {/* Mostrar el precio que realmente se aplica (redondeado ×10) */}
          <div className="text-sm mb-2">
            <div className="flex justify-between">
              <span>Precio aplicado (×10 arriba):</span>
              <strong>{isNaN(customOut.precio) ? '—' : fmtSoles(customOut.precio)}</strong>
            </div>
          </div>

          <div className="text-sm">
            <div className="flex justify-between mb-1">
              <span>Ganancia estimada:</span>
              <strong>{fmtSoles(customOut.ganancia)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Margen sobre costo:</span>
              <strong>
                {isNaN(customOut.pct) ? '—' : `${customOut.pct.toFixed(2)} %`}
              </strong>
            </div>
          </div>
        </div>

        <div className="text-right mt-5">
          <button
            onClick={onClose}
            className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
