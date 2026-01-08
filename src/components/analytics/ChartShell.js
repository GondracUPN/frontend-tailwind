import React from 'react';

export default function ChartShell({
  title,
  loading,
  error,
  empty,
  onRetry,
  onShowMock,
  showMock,
  children,
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {showMock ? <span className="text-xs text-gray-500">Ejemplo</span> : null}
      </div>
      {loading ? (
        <div className="h-64 bg-gray-100 rounded animate-pulse" />
      ) : error ? (
        <div className="text-sm text-red-600 flex items-center justify-between">
          <span>{error}</span>
          <button className="text-xs px-2 py-1 rounded border" onClick={onRetry}>
            Reintentar
          </button>
        </div>
      ) : empty ? (
        <div className="text-sm text-gray-500 flex items-center justify-between">
          <span>No hay datos para el rango seleccionado.</span>
          {onShowMock ? (
            <button className="text-xs px-2 py-1 rounded border" onClick={onShowMock}>
              Ver ejemplo
            </button>
          ) : null}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
