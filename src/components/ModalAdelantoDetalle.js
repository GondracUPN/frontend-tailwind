import React, { useMemo, useState } from 'react';
import api from '../api';

const fmt = (value) => Number(value || 0).toFixed(2);

export default function ModalAdelantoDetalle({
  adelanto,
  producto,
  onClose,
  onCompletar,
  onSaved,
}) {
  const [mostrarNuevaCuota, setMostrarNuevaCuota] = useState(false);
  const [fechaCuota, setFechaCuota] = useState('');
  const [montoCuota, setMontoCuota] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const montoAdelanto = Number(adelanto?.montoAdelanto || 0);
  const montoVenta = Number(adelanto?.montoVenta || 0);
  const restante = Math.max(+(montoVenta - montoAdelanto).toFixed(2), 0);

  const cuotas = useMemo(() => {
    if (!adelanto) return [];
    if (Array.isArray(adelanto.cuotas) && adelanto.cuotas.length > 0) {
      return adelanto.cuotas;
    }
    return montoAdelanto > 0
      ? [{ fecha: adelanto.fechaAdelanto, monto: montoAdelanto }]
      : [];
  }, [adelanto, montoAdelanto]);

  if (!adelanto || !producto) return null;

  const handleGuardarCuota = async (event) => {
    event.preventDefault();
    setError('');

    const monto = Number(montoCuota);
    if (!fechaCuota || !Number.isFinite(monto) || monto <= 0) {
      setError('Ingresa la fecha y un monto mayor a cero.');
      return;
    }
    if (monto > restante) {
      setError(`El nuevo adelanto no puede superar el saldo pendiente de S/ ${fmt(restante)}.`);
      return;
    }

    setSaving(true);
    try {
      const saved = await api.post(`/ventas/adelanto/${adelanto.id}/cuotas`, {
        fechaCuota,
        montoCuota: monto,
      });
      setFechaCuota('');
      setMontoCuota('');
      setMostrarNuevaCuota(false);
      onSaved?.(saved);
    } catch (err) {
      console.error('[ModalAdelantoDetalle] Error al guardar nuevo adelanto:', err);
      setError(err?.message || 'No se pudo guardar el nuevo adelanto.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-xl shadow-lg p-6 relative">
        <button
          type="button"
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          x
        </button>

        <h2 className="text-2xl font-semibold mb-5">Adelanto</h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <div className="text-xs text-amber-800">Total adelantado</div>
            <div className="text-lg font-semibold">S/ {fmt(montoAdelanto)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 border p-3">
            <div className="text-xs text-gray-600">Total de venta</div>
            <div className="text-lg font-semibold">S/ {fmt(montoVenta)}</div>
          </div>
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
            <div className="text-xs text-emerald-800">Restante</div>
            <div className="text-lg font-semibold">S/ {fmt(restante)}</div>
          </div>
        </div>

        <div className="mt-5">
          <h3 className="font-semibold mb-2">Adelantos registrados</h3>
          <div className="border rounded-lg divide-y">
            {cuotas.map((cuota, index) => (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                key={`${cuota.fecha}-${index}`}
              >
                <div>
                  <span className="font-medium">Adelanto {index + 1}</span>
                  <span className="text-gray-500 ml-2">{cuota.fecha || '-'}</span>
                </div>
                <span className="font-semibold">S/ {fmt(cuota.monto)}</span>
              </div>
            ))}
          </div>
        </div>

        {mostrarNuevaCuota && (
          <form onSubmit={handleGuardarCuota} className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="font-semibold mb-3">Nuevo adelanto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="adelanto-fecha-cuota" className="block text-sm font-medium mb-1">
                  Fecha
                </label>
                <input
                  id="adelanto-fecha-cuota"
                  type="date"
                  className="w-full border bg-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={fechaCuota}
                  onChange={(event) => setFechaCuota(event.target.value)}
                  disabled={saving}
                />
              </div>
              <div>
                <label htmlFor="adelanto-monto-cuota" className="block text-sm font-medium mb-1">
                  Nuevo monto adelantado (S/)
                </label>
                <input
                  id="adelanto-monto-cuota"
                  type="number"
                  min="0.01"
                  max={restante}
                  step="0.01"
                  className="w-full border bg-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={montoCuota}
                  onChange={(event) => setMontoCuota(event.target.value)}
                  placeholder={`Máximo ${fmt(restante)}`}
                  disabled={saving}
                />
              </div>
            </div>
            {error && <p className="text-sm text-red-700 mt-3" role="alert">{error}</p>}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                className="px-4 py-2 rounded bg-white border hover:bg-gray-50"
                onClick={() => {
                  setMostrarNuevaCuota(false);
                  setError('');
                }}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Guardando...' : 'Guardar adelanto'}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 pt-5">
          <button
            type="button"
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300"
            onClick={onClose}
          >
            Cerrar
          </button>
          {restante > 0 && !mostrarNuevaCuota && (
            <button
              type="button"
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700"
              onClick={() => setMostrarNuevaCuota(true)}
            >
              Nuevo adelanto
            </button>
          )}
          <button
            type="button"
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
