import React, { useState } from 'react';
import api from '../api';

export default function AccessoryReferenceEditor({ reference, onClose, onSaved }) {
  const [editing, setEditing] = useState(reference);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const patch = Object.fromEntries(Object.entries(editing)
        .filter(([key]) => ['fotoUrl', 'precioPublicadoSoles', 'precioMinimoSoles', 'precioMayoristaSoles', 'cantidadMinimaMayorista', 'activo'].includes(key))
        .map(([key, value]) => [key, /precio|cantidad/.test(key) ? value === '' || value == null ? null : Number(value) : value]));
      await api.patch('/accesorios/referencias/' + editing.id, patch);
      await onSaved();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Editar referencia" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3"><form onSubmit={save} className="max-h-[90vh] w-full max-w-md space-y-3 overflow-auto rounded-xl bg-white p-5">
    <h3 className="font-semibold">Precios y foto de {editing.modelo}</h3>
    {Object.entries({ precioPublicadoSoles: 'Precio publicado', precioMinimoSoles: 'Precio mínimo', precioMayoristaSoles: 'Precio mayorista', cantidadMinimaMayorista: 'Cantidad mínima mayorista', fotoUrl: 'URL de foto' }).map(([key, label]) => <label className="block" key={key}>{label}<input className="mt-1 w-full rounded border p-2" type={key === 'fotoUrl' ? 'text' : 'number'} min={key === 'cantidadMinimaMayorista' ? '1' : '0'} step={key === 'cantidadMinimaMayorista' ? '1' : '0.01'} value={editing[key] ?? ''} onChange={(event) => setEditing((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
    <label className="flex gap-2"><input type="checkbox" checked={editing.activo !== false} onChange={(event) => setEditing((current) => ({ ...current, activo: event.target.checked }))} />Referencia activa</label>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <div className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button disabled={saving} className="rounded bg-indigo-600 p-2 text-white">Guardar referencia</button></div>
  </form></div>;
}
