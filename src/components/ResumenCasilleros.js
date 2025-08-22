import React, { useMemo } from 'react';

// Ajusta este listado si agregas/renombras casilleros
const CASILLEROS = ['Walter','Renato','Christian','Alex','MamaRen','Jorge','Kenny'];

// Toma el último tracking del producto (por id)
function lastTracking(p) {
  const arr = p?.tracking || [];
  if (!arr.length) return null;
  return arr.reduce((a, b) => (a.id > b.id ? a : b));
}

export default function CasillerosStrip({ productos = [] }) {
  const stats = useMemo(() => {
    const acc = {};
    CASILLEROS.forEach(c => (acc[c] = { current: 0, total: 0 }));

    productos.forEach(p => {
      const t = lastTracking(p);
      if (!t || !t.casillero) return;
      const c = t.casillero;
      if (!acc[c]) acc[c] = { current: 0, total: 0 };

      // total “histórico” por casillero (a nivel de producto)
      acc[c].total += 1;

      // actuales: todo lo que no sea 'recogido'
      if (t.estado !== 'recogido') acc[c].current += 1;
    });

    return acc;
  }, [productos]);

  return (
    <div className="mb-3">
      <div className="flex flex-wrap gap-2">
        {CASILLEROS.map(name => {
          const s = stats[name] || { current: 0, total: 0 };
          const habilitado = s.current <= 1;

          return (
            <div
              key={name}
              className="px-3 py-2 border rounded-lg bg-white shadow-sm flex items-center gap-3 text-sm"
            >
              <span className="font-medium">{name}</span>

              <div className="text-xs flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-gray-100">Ahora: {s.current}</span>
                <span className="px-2 py-0.5 rounded bg-gray-100">Total: {s.total}</span>
              </div>

              <button
                className={
                  'ml-1 text-xs px-2 py-1 rounded cursor-not-allowed ' +
                  (habilitado ? 'bg-green-600 text-white' : 'bg-red-600 text-white')
                }
                disabled
              >
                {habilitado ? 'Habilitado' : 'No disponible'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
