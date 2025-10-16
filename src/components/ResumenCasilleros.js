﻿// src/components/CasillerosResumen.jsx
import React, { useMemo } from 'react';

// Casilleros a mostrar (orden fijo)
const CASILLEROS = ['Walter','Renato','Christian','Alex','MamaRen','Jorge','Kenny'];

/**
 * Espera productos con p.tracking?.[0]?.casillero y p.tracking?.[0]?.estado
 * Estados esperados: 'comprado_sin_tracking' | 'comprado_en_camino' | 'en_eshopex' | 'recogido'
 */
export default function CasillerosResumen({ productos = [], loading = false }) {

  const stats = useMemo(() => {
    const base = CASILLEROS.reduce((acc, c) => {
      acc[c] = { total: 0, actuales: 0 }; // total histórico (en la lista) y activos (≠ 'recogido')
      return acc;
    }, {});

    for (const p of productos || []) {
      const t = p?.tracking?.[0];
      const cas = t?.casillero;
      if (!cas || !base[cas]) continue;

      base[cas].total += 1;
      if (t.estado !== 'recogido') base[cas].actuales += 1;
    }
    return base;
  }, [productos]);

  if (loading) {
    // Skeleton compacto con “barra que se mueve”
    return (
      <div className="mb-4 -mx-2 px-2 flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory flex-nowrap">
        {CASILLEROS.slice(0,4).map((k) => (
          <div key={k} className="snap-start flex-[1_1_12rem] min-w-[10.5rem] p-3 rounded-md border bg-white">
            <div className="h-4 w-24 mb-2 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-full bg-gray-100 rounded overflow-hidden">
              <div className="h-3 w-1/2 bg-gray-300 animate-pulse" />
            </div>
            <div className="mt-2 h-3 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mb-4 -mx-2 px-2 flex items-stretch gap-2 overflow-x-auto snap-x snap-mandatory flex-nowrap">
      {CASILLEROS.map((cas) => {
        const { total, actuales } = stats[cas] || { total: 0, actuales: 0 };
        const capacidadMax = 2;                     // regla: < 2 habilitado
        const habilitado = actuales < capacidadMax; // 0 o 1 => OK; 2+ => NO
        const pct = Math.min((actuales / capacidadMax) * 100, 100);

        return (
          <div key={cas} className="snap-start flex-[1_1_12rem] min-w-[10.5rem] p-3 rounded-md border bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">{cas}</span>
              <span
                className={`text-[11px] px-2 py-[2px] rounded-full 
                ${habilitado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                title={habilitado ? 'Menos de 2 paquetes' : 'Tiene 2 o más paquetes'}
              >
                {habilitado ? 'Habilitado' : 'No disponible'}
              </span>
            </div>

            {/* Barra de ocupación */}
            <div className="h-2 w-full bg-gray-100 rounded overflow-hidden">
              <div
                className={`h-2 ${habilitado ? 'bg-green-500' : 'bg-red-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>

            <div className="mt-2 flex justify-between text-[12px] text-gray-600">
              <span>Ahora: <strong>{actuales}</strong></span>
              <span>Total: <strong>{total}</strong></span>
            </div>

            {/* Botón no clickeable que cambia de color */}
            <button
              type="button"
              disabled
              className={`mt-2 w-full text-[11px] py-1 rounded cursor-not-allowed 
                ${habilitado ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
            >
              {habilitado ? 'Disponible' : 'Ocupado'}
            </button>
          </div>
        );
      })}
    </div>
  );
}



