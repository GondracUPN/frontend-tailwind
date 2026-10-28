import React, { useState } from 'react';
import api from '../api';

export default function AccessoryInformativeRate({ producto, onSaved }) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cost = producto?.valor;
  if (String(cost?.monedaCompra).toUpperCase() !== 'USD') return null;
  const implicit = Number(cost.valorProducto) > 0 && cost.valorSoles != null ? Number(cost.valorSoles) / Number(cost.valorProducto) : null;
  if (cost.tipoCambioCompra != null) return <p className="mt-3 text-sm">Tipo de cambio de compra registrado: {Number(cost.tipoCambioCompra).toFixed(6)}</p>;
  const save = async () => {
    if (saving || !Number.isFinite(Number(value)) || Number(value) < 0.0001) return;
    setSaving(true); setError('');
    try { const result = await api.patch(`/accesorios/lotes/${producto.id}/tipo-cambio-informativo`, { tipoCambioCompra: Number(value) }); onSaved(result.tipoCambioCompra); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <section aria-label="Cambio informativo de compra" className="mt-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
    <label className="block">Tipo de cambio de compra informativo<input type="number" min="0.0001" step="0.000001" value={value} onChange={(event) => setValue(event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2" /></label>
    <p>Este dato documenta la compra. Los importes ya guardados se conservan.</p>
    <p>Cambio implícito en los valores guardados: {implicit == null ? 'No calculable' : implicit.toFixed(6)}</p>
    {value !== '' && implicit != null && Math.abs(Number(value) - implicit) > 0.000001 && <p role="status">El cambio ingresado difiere del implícito; compáralos antes de registrarlo.</p>}
    <button type="button" disabled={saving || value === '' || !(Number(value) >= 0.0001)} onClick={save} className="rounded-lg border border-amber-400 px-3 py-2">{saving ? 'Registrando…' : 'Registrar cambio informativo'}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
