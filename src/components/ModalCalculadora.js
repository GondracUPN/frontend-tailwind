// src/components/ModalCalculadora.js
import React, { useMemo, useState } from 'react';

const fmtSoles = (v) => (isNaN(v) ? '-' : `S/ ${Number(v).toFixed(2)}`);
const roundUp10 = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return NaN;
  return Math.ceil(x / 10) * 10;
};

export default function ModalCalculadora({ producto, onClose }) {
  if (!producto) return null;

  // Valores base del producto
  const costoTotalBase = Number(producto?.valor?.costoTotal ?? 0);
  const valorUSD = Number(producto?.valor?.valorProducto ?? 0);
  const envioSoles = Number(producto?.valor?.costoEnvio ?? 0);

  const [precioCustom, setPrecioCustom] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');

  // costo usado: si hay TC válido, (valorUSD * TC) + envío; si no, costoBase
  const costoUsado = useMemo(() => {
    const tc = Number(tipoCambio);
    if (isFinite(tc) && tc > 0) return (valorUSD * tc) + envioSoles;
    return costoTotalBase;
  }, [tipoCambio, valorUSD, envioSoles, costoTotalBase]);

  // Sugerencias basadas en costo base
  const { pvMin, pvMed } = useMemo(() => {
    const pvMinRounded = roundUp10(costoTotalBase * 1.20); // +20%
    const pvMedRounded = roundUp10(costoTotalBase * 1.40); // +40%
    return { pvMin: pvMinRounded, pvMed: pvMedRounded };
  }, [costoTotalBase]);

  // Personalizado con redondeo a 10 hacia arriba
  const customOut = useMemo(() => {
    const pcRaw = Number(precioCustom);
    const pc = isNaN(pcRaw) ? NaN : roundUp10(pcRaw);
    const ganancia = isNaN(pc) ? 0 : (pc - costoUsado);
    const pct = (!isNaN(pc) && costoUsado > 0) ? (ganancia / costoUsado) * 100 : 0;
    return { precio: pc, ganancia, pct };
  }, [precioCustom, costoUsado]);

  const gananciaMin = pvMin - costoTotalBase;
  const gananciaMed = pvMed - costoTotalBase;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cerrar */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >×</button>

        <h2 className="text-xl font-semibold mb-1">Calculadora rápida</h2>
        <p className="text-sm text-gray-600 mb-4">
          Producto: <span className="font-medium">{producto?.tipo}</span> — Costo total base:{' '}
          <span className="font-semibold">{fmtSoles(costoTotalBase)}</span>
        </p>

        {/* Sugerencias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">Precio mínimo (+20%)</div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMin)}</div>
            <div className="text-sm text-gray-700 mt-1">
              Ganancia: <strong>{fmtSoles(gananciaMin)}</strong>
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">Precio medio (+40%)</div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMed)}</div>
            <div className="text-sm text-gray-700 mt-1">
              Ganancia: <strong>{fmtSoles(gananciaMed)}</strong>
            </div>
          </div>
        </div>

        {/* Personalizado con Tipo de Cambio */}
        <div className="border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Precio personalizado (S/)</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full border rounded-lg p-2"
                placeholder="Ingresa un precio en soles"
                value={precioCustom}
                onChange={(e) => setPrecioCustom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de cambio (US$ → S/)</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full border rounded-lg p-2"
                placeholder="Opcional: p.ej. 3.80"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
              />
              <div className="text-xs text-gray-600 mt-1">
                Si ingresas TC, costo = (valor US$ × TC) + envío.
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-700 mt-3 space-y-1">
            <div className="flex justify-between"><span>Valor (US$):</span><strong>{isNaN(valorUSD) ? '-' : `$ ${valorUSD.toFixed(2)}`}</strong></div>
            <div className="flex justify-between"><span>Envío (S/):</span><strong>{fmtSoles(envioSoles)}</strong></div>
            <div className="flex justify-between"><span>Costo usado:</span><strong>{fmtSoles(costoUsado)}</strong></div>
            <div className="flex justify-between pt-1"><span>Precio aplicado (x10 arriba):</span><strong>{isNaN(customOut.precio) ? '-' : fmtSoles(customOut.precio)}</strong></div>
            <div className="flex justify-between"><span>Ganancia estimada:</span><strong>{fmtSoles(customOut.ganancia)}</strong></div>
            <div className="flex justify-between"><span>Margen sobre costo:</span><strong>{isNaN(customOut.pct) ? '-' : `${customOut.pct.toFixed(2)} %`}</strong></div>
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

