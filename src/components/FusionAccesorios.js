import { useState } from 'react';
import api from '../api';
import { accessoryPurchaseSummary } from '../utils/accessoryCost';
import { accessoryMergeKey, accessoryPackaging } from '../utils/accessoryInventory';
import { accessoryLotAvailable } from '../utils/accessorySales';

const money = (value) => value == null ? 'Pendiente' : `S/ ${value.toFixed(2)}`;

export default function FusionAccesorios({ producto, entries, nombre, onClose, onSaved }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const identity = accessoryMergeKey(producto);
  const candidates = entries.map((entry) => entry.producto).filter((lot) => lot.id !== producto.id
    && (!producto.fusionAccesorioId || lot.fusionAccesorioId !== producto.fusionAccesorioId)
    && Boolean(identity) && accessoryMergeKey(lot) === identity && (!lot.stockActual || accessoryLotAvailable(lot)));
  const lots = [producto, ...candidates.filter((lot) => selected.includes(lot.id))].flatMap((lot) => lot.__lots || [lot]);
  const summary = accessoryPurchaseSummary(lots);
  const submit = async () => {
    if (!selected.length || saving) return;
    setSaving(true);
    setError('');
    try {
      await api.post('/accesorios/fusionar', { productoIds: [producto.id, ...selected] });
      await onSaved();
    } catch (err) {
      setError(err?.message || 'No se pudo fusionar los lotes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="Fusionar lotes de accesorios">
      <div className="max-h-[90vh] w-full max-w-lg space-y-4 overflow-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold">Fusionar lotes</h2>
          <p className="text-sm text-slate-600">{nombre} · {accessoryPackaging[producto.empaqueAccesorio]}</p>
        </div>
        <div className="space-y-2">
          {candidates.map((lot) => (
            <label key={lot.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
              <input type="checkbox" disabled={saving} checked={selected.includes(lot.id)} onChange={(event) => {
                const checked = event.target.checked;
                setSelected((current) => checked ? [...current, lot.id] : current.filter((id) => id !== lot.id));
              }} />
              <span>ACC-{lot.codigoInventario || lot.id} · Lote {lot.id} · {lot.stockActual} disponibles</span>
            </label>
          ))}
          {!candidates.length && <p className="text-sm text-slate-500">No hay otros lotes con el mismo modelo, comprador, estado y empaque.</p>}
        </div>
        {selected.length > 0 && <dl className="grid grid-cols-2 gap-2 rounded-xl bg-indigo-50 p-3 text-sm">
          <dt>Unidades compradas</dt><dd className="text-right">{summary.quantity}</dd>
          <dt>Disponibles</dt><dd className="text-right">{summary.available}</dd>
          <dt>Costo total de compra</dt><dd className="text-right">{money(summary.total)}</dd>
          <dt>Costo promedio por unidad</dt><dd className="text-right font-semibold">{money(summary.average)}</dd>
          <dt>Promedio del stock disponible</dt><dd className="text-right">{summary.available ? money(summary.availableAverage) : 'Agotado'}</dd>
        </dl>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={saving} onClick={onClose} className="rounded-lg border border-slate-200 px-3 py-2">Cancelar</button>
          <button type="button" disabled={saving || !selected.length} onClick={submit} className="rounded-lg bg-indigo-700 px-3 py-2 text-white disabled:opacity-50">{saving ? 'Fusionando…' : 'Confirmar fusión'}</button>
        </div>
      </div>
    </div>
  );
}
