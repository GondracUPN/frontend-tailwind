// src/components/ModalVenta.jsx
import React, { useEffect, useState } from 'react';
import api from '../api';

export default function ModalVenta({
  producto,
  venta,
  onClose,
  onSaved,
  allowVendedorOnCreate = false, // permite elegir vendedor al crear
  presetVendedor = '',           // valor inicial del vendedor
}) {
  const [editMode, setEditMode] = useState(false);
  const [modoVenta, setModoVenta] = useState(''); // 'gonzalo' | 'renato' | 'ambos'
  const [form, setForm] = useState({
    tipoCambio: '',
    tipoCambioGonzalo: '',
    tipoCambioRenato: '',
    fechaVenta: '',
    precioVenta: '',
    vendedor: '',
  });
  const [saving, setSaving] = useState(false);

  const isReadOnly = Boolean(venta) && !editMode;
  const isSplitVenta = Boolean(
    venta &&
    (String(venta?.vendedor || '').trim().toLowerCase() === 'ambos' ||
      venta?.tipoCambioGonzalo != null ||
      venta?.tipoCambioRenato != null),
  );
  const isSplitCreate = !venta && modoVenta === 'ambos';

  useEffect(() => {
    if (venta) {
      setForm({
        tipoCambio: venta.tipoCambio != null ? String(venta.tipoCambio) : '',
        tipoCambioGonzalo: venta.tipoCambioGonzalo != null ? String(venta.tipoCambioGonzalo) : '',
        tipoCambioRenato: venta.tipoCambioRenato != null ? String(venta.tipoCambioRenato) : '',
        fechaVenta: venta.fechaVenta ?? '',
        precioVenta: venta.precioVenta != null ? String(venta.precioVenta) : '',
        vendedor: (venta.vendedor ?? '') + '',
      });
    } else {
      setForm({
        tipoCambio: '',
        tipoCambioGonzalo: '',
        tipoCambioRenato: '',
        fechaVenta: '',
        precioVenta: '',
        vendedor: allowVendedorOnCreate ? (presetVendedor || '') : '',
      });
    }
  }, [venta, editMode, allowVendedorOnCreate, presetVendedor]);

  useEffect(() => {
    if (!venta) setModoVenta('');
    setEditMode(false);
  }, [producto?.id, venta?.id, venta]);

  if (!producto) return null;

  const onChange = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const selectModoVenta = (modo) => {
    setModoVenta(modo);
    const vendedor =
      modo === 'gonzalo' ? 'Gonzalo' : modo === 'renato' ? 'Renato' : 'ambos';
    setForm((prev) => ({
      ...prev,
      tipoCambio: '',
      tipoCambioGonzalo: '',
      tipoCambioRenato: '',
      vendedor,
    }));
  };

  const validate = () => {
    const splitMode = isSplitCreate || (venta && !isReadOnly && isSplitVenta);
    if (splitMode) {
      if (!form.fechaVenta || !form.precioVenta || !form.tipoCambioGonzalo || !form.tipoCambioRenato) {
        alert('Completa Fecha de venta, Precio de venta y tipo de cambio para ambos.');
        return false;
      }
      return true;
    }
    if (!form.tipoCambio || !form.fechaVenta || !form.precioVenta) {
      alert('Completa Tipo de cambio, Fecha de venta y Precio de venta.');
      return false;
    }
    return true;
  };

  const handleSaveCreate = async () => {
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const body = {
        productoId: producto.id,
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
      };

      if (isSplitCreate) {
        const tcG = Number(form.tipoCambioGonzalo);
        const tcR = Number(form.tipoCambioRenato);
        const avg = (tcG + tcR) / 2;
        body.tipoCambio = Number(avg.toFixed(4));
        body.tipoCambioGonzalo = tcG;
        body.tipoCambioRenato = tcR;
        body.vendedor = 'ambos';
      } else {
        body.tipoCambio = Number(form.tipoCambio);
        if (modoVenta === 'gonzalo') body.vendedor = 'Gonzalo';
        if (modoVenta === 'renato') body.vendedor = 'Renato';
        if (allowVendedorOnCreate && form.vendedor?.trim()) {
          body.vendedor = form.vendedor.trim();
        }
      }
      const saved = await api.post(`/ventas`, body);
      onSaved?.(saved);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al guardar venta:', e);
      alert('No se pudo guardar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!venta) return;
    if (saving) return;
    if (!validate()) return;

    setSaving(true);
    try {
      const payload = {
        fechaVenta: form.fechaVenta,
        precioVenta: Number(form.precioVenta),
      };

      if (isSplitVenta) {
        const tcG = Number(form.tipoCambioGonzalo || form.tipoCambio || 0);
        const tcR = Number(form.tipoCambioRenato || form.tipoCambio || 0);
        const avg = (tcG + tcR) / 2;
        payload.tipoCambio = Number(avg.toFixed(4));
        payload.tipoCambioGonzalo = tcG;
        payload.tipoCambioRenato = tcR;
        payload.vendedor = 'ambos';
      } else {
        payload.tipoCambio = Number(form.tipoCambio);
        payload.vendedor = form.vendedor?.trim() ? form.vendedor.trim() : null;
      }

      const updated = await api.patch(`/ventas/${venta.id}`, payload);
      onSaved?.(updated);
      onClose?.();
    } catch (e) {
      console.error('[ModalVenta] Error al actualizar venta:', e);
      alert('No se pudo actualizar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = () => setEditMode(true);
  const cancelEdit = () => setEditMode(false);

  const valorUsd = Number(producto?.valor?.valorProducto ?? 0);
  const envioSoles = Number(
    producto?.valor?.costoEnvioProrrateado ?? producto?.valor?.costoEnvio ?? 0,
  );
  const ventaTotalSoles = Number(form.precioVenta || 0);
  const mitadVentaSoles = ventaTotalSoles ? ventaTotalSoles / 2 : 0;
  const toPositiveNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const baseTc = toPositiveNumber(form.tipoCambio) ?? toPositiveNumber(venta?.tipoCambio) ?? 0;
  const tcG =
    toPositiveNumber(form.tipoCambioGonzalo) ??
    toPositiveNumber(venta?.tipoCambioGonzalo) ??
    baseTc;
  const tcR =
    toPositiveNumber(form.tipoCambioRenato) ??
    toPositiveNumber(venta?.tipoCambioRenato) ??
    baseTc;

  const calcSplit = (tc) => {
    if (!tc) return null;
    const costo = (valorUsd / 2) * tc + (envioSoles / 2);
    const ganancia = mitadVentaSoles - costo;
    const porcentaje = costo > 0 ? (ganancia / costo) * 100 : 0;
    return { costo, ganancia, porcentaje };
  };

  const splitG = calcSplit(tcG);
  const splitR = calcSplit(tcR);

  const fmtMoney = (n) => (Number.isFinite(n) ? Number(n).toFixed(2) : '--');
  const fmtPct = (n) => (Number.isFinite(n) ? `${Number(n).toFixed(2)}%` : '--');
  const fmtTc = (n) => (Number.isFinite(n) && n > 0 ? Number(n).toFixed(4) : '--');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cerrar (X) */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
          aria-label="Cerrar modal"
        >
          ✖
        </button>

        {/* Título */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">
            {venta ? (isReadOnly ? 'Detalle de Venta' : 'Editar Venta') : 'Registrar Venta'}
          </h2>
          {/* ❌ Ya no mostramos el botón Editar aquí en modo lectura */}
        </div>

        {/* Crear nueva venta */}
        {!venta && (
          <div className="space-y-4">
            {!modoVenta && (
              <div className="space-y-3">
                <div className="text-sm text-gray-600">Selecciona el tipo de venta</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
                    onClick={() => selectModoVenta('gonzalo')}
                  >
                    Venta Gonzalo
                  </button>
                  <button
                    className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
                    onClick={() => selectModoVenta('renato')}
                  >
                    Venta Renato
                  </button>
                  <button
                    className="px-3 py-2 rounded border bg-white hover:bg-gray-50"
                    onClick={() => selectModoVenta('ambos')}
                  >
                    Venta conjunta
                  </button>
                </div>
              </div>
            )}

            {modoVenta && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Modo: {modoVenta === 'ambos' ? 'Venta conjunta' : `Venta ${modoVenta.charAt(0).toUpperCase() + modoVenta.slice(1)}`}
                  </div>
                  <button
                    className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
                    onClick={() => setModoVenta('')}
                  >
                    Cambiar tipo
                  </button>
                </div>

                {modoVenta !== 'ambos' && (
                  <>
                    <div>
                      <label className="block font-medium mb-1">Tipo de cambio</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.tipoCambio}
                        onChange={e => onChange('tipoCambio', e.target.value)}
                        placeholder="Ej. 3.85"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Fecha de venta</label>
                      <input
                        type="date"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.fechaVenta}
                        onChange={e => onChange('fechaVenta', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Precio de venta (S/)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.precioVenta}
                        onChange={e => onChange('precioVenta', e.target.value)}
                        placeholder="Ej. 2499.90"
                      />
                    </div>
                  </>
                )}

                {modoVenta === 'ambos' && (
                  <>
                    <div>
                      <label className="block font-medium mb-1">Precio de venta (S/)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.precioVenta}
                        onChange={e => onChange('precioVenta', e.target.value)}
                        placeholder="Ej. 2499.90"
                      />
                    </div>
                    <div>
                      <label className="block font-medium mb-1">Fecha de venta</label>
                      <input
                        type="date"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.fechaVenta}
                        onChange={e => onChange('fechaVenta', e.target.value)}
                      />
                    </div>

                    <div className="border rounded-lg divide-y">
                      <div className="p-3 space-y-2">
                        <div className="font-semibold">Gonzalo</div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
                          <input
                            type="number"
                            step="0.0001"
                            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            value={form.tipoCambioGonzalo}
                            onChange={e => onChange('tipoCambioGonzalo', e.target.value)}
                            placeholder="Ej. 3.85"
                          />
                        </div>
                        <div className="text-xs text-gray-600">
                          Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="font-semibold">Renato</div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
                          <input
                            type="number"
                            step="0.0001"
                            className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                            value={form.tipoCambioRenato}
                            onChange={e => onChange('tipoCambioRenato', e.target.value)}
                            placeholder="Ej. 3.85"
                          />
                        </div>
                        <div className="text-xs text-gray-600">
                          Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {allowVendedorOnCreate && modoVenta !== 'ambos' && (
                  <div>
                    <label className="block font-medium mb-1">Vendedor (opcional)</label>
                    <select
                      className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      value={form.vendedor}
                      onChange={e => onChange('vendedor', e.target.value)}
                    >
                      <option value="">— Seleccionar —</option>
                      <option value="Gonzalo">Gonzalo</option>
                      <option value="Renato">Renato</option>
                    </select>
                  </div>
                )}

                <div className="text-right">
                  <button
                    className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                    onClick={handleSaveCreate}
                    disabled={saving}
                  >
                    {saving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modo lectura (ver información) */}
        {venta && isReadOnly && (
          <div className="space-y-3">
            <div>
              <span className="font-medium">Fecha de venta: </span>
              <span className="text-gray-700">{venta.fechaVenta}</span>
            </div>

            {isSplitVenta ? (
              <>
                <div>
                  <span className="font-medium">Precio de venta total (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div className="border rounded-lg divide-y">
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Gonzalo</div>
                    <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcG)}</div>
                    <div className="text-xs text-gray-600">
                      Venta: S/ {fmtMoney(mitadVentaSoles)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-semibold">Renato</div>
                    <div className="text-sm text-gray-700">Tipo de cambio: {fmtTc(tcR)}</div>
                    <div className="text-xs text-gray-600">
                      Venta: S/ {fmtMoney(mitadVentaSoles)}
                    </div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="font-medium">Tipo de cambio: </span>
                  <span className="text-gray-700">{Number(venta.tipoCambio).toFixed(4)}</span>
                </div>
                <div>
                  <span className="font-medium">Precio de venta (S/): </span>
                  <span className="text-gray-700">{Number(venta.precioVenta).toFixed(2)}</span>
                </div>
                <div>
                  <span className="font-medium">% Ganancia: </span>
                  <span className="text-gray-700">{Number(venta.porcentajeGanancia).toFixed(3)}%</span>
                </div>
                <div>
                  <span className="font-medium">Ganancia neta (S/): </span>
                  <span className="text-gray-700">{Number(venta.ganancia).toFixed(2)}</span>
                </div>
              </>
            )}

            {venta.vendedor != null && (
              <div>
                <span className="font-medium">Vendedor: </span>
                <span className="text-gray-700">{String(venta.vendedor || '')}</span>
              </div>
            )}

            <div className="text-right pt-2 flex items-center justify-end gap-2">
              <button
                className="px-3 py-2 rounded bg-amber-500 text-white hover:bg-amber-600"
                onClick={startEdit}
              >
                Editar
              </button>
              <button
                className="bg-gray-300 text-gray-800 px-6 py-2 rounded hover:bg-gray-400"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Modo edición */}
        {venta && !isReadOnly && (
          <div className="space-y-4">
            {isSplitVenta ? (
              <>
                <div>
                  <label className="block font-medium mb-1">Precio de venta (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.precioVenta}
                    onChange={e => onChange('precioVenta', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Fecha de venta</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.fechaVenta}
                    onChange={e => onChange('fechaVenta', e.target.value)}
                  />
                </div>
                <div className="border rounded-lg divide-y">
                  <div className="p-3 space-y-2">
                    <div className="font-semibold">Gonzalo</div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.tipoCambioGonzalo}
                        onChange={e => onChange('tipoCambioGonzalo', e.target.value)}
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitG ? fmtMoney(splitG.costo) : '--'} | Ganancia: S/ {splitG ? fmtMoney(splitG.ganancia) : '--'} | %: {splitG ? fmtPct(splitG.porcentaje) : '--'}
                    </div>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="font-semibold">Renato</div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Tipo de cambio</label>
                      <input
                        type="number"
                        step="0.0001"
                        className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        value={form.tipoCambioRenato}
                        onChange={e => onChange('tipoCambioRenato', e.target.value)}
                      />
                    </div>
                    <div className="text-xs text-gray-600">
                      Costo: S/ {splitR ? fmtMoney(splitR.costo) : '--'} | Ganancia: S/ {splitR ? fmtMoney(splitR.ganancia) : '--'} | %: {splitR ? fmtPct(splitR.porcentaje) : '--'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block font-medium mb-1">Tipo de cambio</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.tipoCambio}
                    onChange={e => onChange('tipoCambio', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Fecha de venta</label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.fechaVenta}
                    onChange={e => onChange('fechaVenta', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Precio de venta (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.precioVenta}
                    onChange={e => onChange('precioVenta', e.target.value)}
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Vendedor (opcional)</label>
                  <select
                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={form.vendedor}
                    onChange={e => onChange('vendedor', e.target.value)}
                  >
                    <option value="">— Seleccionar —</option>
                    <option value="Gonzalo">Gonzalo</option>
                    <option value="Renato">Renato</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                className="bg-gray-200 text-gray-800 px-6 py-2 rounded hover:bg-gray-300"
                onClick={cancelEdit}
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                className={`bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={handleSaveEdit}
                disabled={saving}
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}









