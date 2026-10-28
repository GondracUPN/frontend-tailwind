import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { nuevaClave } from '../services/finanzas';

const EMPTY = { categoria: '', marca: '', modelo: '', generacion: '', variante: '', estado: 'nuevo', originalidad: 'original', compatibilidad: '', fotoUrl: '',
  precioPublicadoSoles: '', precioMinimoSoles: '', precioMayoristaSoles: '', cantidadMinimaMayorista: '' };
const money = (value) => Number(value || 0).toFixed(2);
const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2';

export default function AccessoryIngresoModal({ initialReference, onClose, onSaved }) {
  const [mode, setMode] = useState('existente');
  const [query, setQuery] = useState('');
  const [references, setReferences] = useState(initialReference ? [initialReference] : []);
  const [selected, setSelected] = useState(initialReference?.id ? String(initialReference.id) : '');
  const [reference, setReference] = useState(EMPTY);
  const [purchase, setPurchase] = useState({ comprador: '', tipo: 'local', moneda: 'PEN', tipoCambioCompra: '3.7', fechaCompra: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), costoLogistica: '0' });
  const [lines, setLines] = useState([{ cantidad: '1', costoUnitario: '' }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [duplicateId, setDuplicateId] = useState(null);
  const operation = useRef(null);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      api.get('/accesorios/referencias?q=' + encodeURIComponent(query)).then((data) => {
        if (active) setReferences((current) => {
          const chosen = current.find((item) => String(item.id) === selected) || initialReference;
          return [...(chosen ? [chosen] : []), ...(Array.isArray(data) ? data.filter((item) => item.id !== chosen?.id) : [])];
        });
      }).catch((err) => { if (active) setError(err.message); });
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [query, initialReference, selected]);
  const rate = purchase.moneda === 'USD' ? Number(purchase.tipoCambioCompra || 0) : 1;
  const total = lines.reduce((sum, line) => sum + Number(line.cantidad || 0) * Number(line.costoUnitario || 0), 0);
  const shipping = purchase.tipo === 'importada' ? Number(purchase.costoLogistica || 0) : 0;
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    if (mode === 'existente' && !selected) return setError('Selecciona una referencia.');
    if (!purchase.comprador) return setError('Selecciona quién compró los accesorios.');
    const body = { ...(mode === 'existente' ? { referenciaId: Number(selected) } : { referencia: Object.fromEntries(Object.entries(reference).map(([key, value]) => [key, /precio|cantidadMinima/.test(key) ? (value === '' ? null : Number(value)) : value])) }),
      comprador: purchase.comprador, fechaCompra: purchase.fechaCompra, tipo: purchase.tipo, moneda: purchase.moneda,
      ...(purchase.moneda === 'USD' ? { tipoCambioCompra: Number(purchase.tipoCambioCompra) } : {}),
      ...(purchase.tipo === 'importada' ? { costoLogistica: shipping } : {}),
      lineas: lines.map((line) => ({ cantidad: Number(line.cantidad), costoUnitario: Number(line.costoUnitario) })) };
    const signature = JSON.stringify(body);
    if (!operation.current || operation.current.signature !== signature) operation.current = { signature, key: nuevaClave() };
    setSaving(true); setError('');
    try {
      const saved = await api.post('/accesorios/ingresos', { ...body, idempotencyKey: operation.current.key });
      onSaved?.(saved); onClose();
    } catch (err) {
      setError(err.message);
      if ((err.status === 409 || /HTTP 409/.test(err.message)) && err.data?.id) setDuplicateId(Number(err.data.id));
    } finally { setSaving(false); }
  };
  const useExisting = async () => {
    setSaving(true);
    try {
      const existing = await api.get('/accesorios/referencias/' + duplicateId);
      if (existing.activo === false) throw new Error('La referencia está inactiva. Reactívala antes de ingresar una compra.');
      setReferences((current) => [existing, ...current.filter((row) => row.id !== existing.id)]);
      setSelected(String(existing.id)); setMode('existente'); setDuplicateId(null); setError('');
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Ingresar accesorios" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3">
    <form onSubmit={submit} className="max-h-[94vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <header className="flex justify-between"><h2 className="text-xl font-semibold">Ingresar accesorios</h2><button type="button" onClick={onClose} disabled={saving}>Cerrar</button></header>
      <section className="space-y-3"><h3 className="font-semibold">1. Referencia comercial</h3>
        <div className="flex gap-3"><button type="button" aria-pressed={mode === 'existente'} onClick={() => setMode('existente')} className="rounded-lg border p-2">Buscar referencia</button><button type="button" aria-pressed={mode === 'nueva'} onClick={() => setMode('nueva')} className="rounded-lg border p-2">Crear referencia</button></div>
        {mode === 'existente' ? <><label className="block">Buscar por nombre, código o compatibilidad<input className={input} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <label className="block">Referencia<select required className={input} value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Seleccionar</option>{references.map((row) => <option key={row.id} value={row.id}>{row.modelo} · {row.variante} · {row.estado} · {row.originalidad}</option>)}</select></label></>
          : <div className="grid gap-3 sm:grid-cols-2">{Object.entries({ categoria: 'Categoría', marca: 'Marca', modelo: 'Modelo', generacion: 'Generación', variante: 'Variante', compatibilidad: 'Compatibilidad', fotoUrl: 'URL de foto', precioPublicadoSoles: 'Precio publicado (S/)', precioMinimoSoles: 'Precio mínimo (S/)', precioMayoristaSoles: 'Precio mayorista (S/)', cantidadMinimaMayorista: 'Cantidad mínima mayorista' }).map(([key, label]) => <label key={key}>{label}<input className={input} required={['categoria', 'modelo'].includes(key)} type={/precio|cantidadMinima/.test(key) ? 'number' : 'text'} min="0" step={key === 'cantidadMinimaMayorista' ? '1' : '0.01'} value={reference[key]} onChange={(event) => setReference((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
            <label>Estado<select className={input} value={reference.estado} onChange={(event) => setReference((current) => ({ ...current, estado: event.target.value }))}>{['nuevo', 'usado', 'open_box', 'reacondicionado', 'roto'].map((state) => <option key={state}>{state}</option>)}</select></label>
            <label>Originalidad<select className={input} value={reference.originalidad} onChange={(event) => setReference((current) => ({ ...current, originalidad: event.target.value }))}>{['original', 'fake', 'compatible'].map((value) => <option key={value}>{value}</option>)}</select></label>
          </div>}
      </section>
      <section className="space-y-3"><h3 className="font-semibold">2. Compra</h3><div className="grid gap-3 sm:grid-cols-2">
        {Object.entries({ comprador: ['Comprado por', ['', 'Gonzalo', 'Renato', 'ambos']], tipo: ['Tipo de ingreso', ['local', 'importada']], moneda: ['Moneda', ['PEN', 'USD']] }).map(([key, [label, options]]) => <label key={key}>{label}<select className={input} required value={purchase[key]} onChange={(event) => setPurchase((current) => ({ ...current, [key]: event.target.value }))}>{options.map((value) => <option key={value} value={value}>{value || 'Seleccionar'}</option>)}</select></label>)}
        <label>Fecha de compra<input className={input} type="date" required value={purchase.fechaCompra} onChange={(event) => setPurchase((current) => ({ ...current, fechaCompra: event.target.value }))} /></label>
        {purchase.moneda === 'USD' && <label>Tipo de cambio de compra<input className={input} required type="number" min="0.0001" step="0.000001" value={purchase.tipoCambioCompra} onChange={(event) => setPurchase((current) => ({ ...current, tipoCambioCompra: event.target.value }))} /></label>}
        {purchase.tipo === 'importada' && <label>Logística total (S/)<input className={input} required type="number" min="0" step="0.01" value={purchase.costoLogistica} onChange={(event) => setPurchase((current) => ({ ...current, costoLogistica: event.target.value }))} /></label>}
      </div></section>
      <section className="space-y-3"><h3 className="font-semibold">3. Líneas del ingreso</h3>{lines.map((line, index) => <div key={index} className="grid grid-cols-2 gap-3 rounded-lg border p-3">
        <label>Cantidad línea {index + 1}<input className={input} type="number" min="1" step="1" required value={line.cantidad} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, cantidad: event.target.value } : row))} /></label>
        <label>Costo por unidad línea {index + 1}<input className={input} type="number" min="0" step="0.01" required value={line.costoUnitario} onChange={(event) => setLines((current) => current.map((row, i) => i === index ? { ...row, costoUnitario: event.target.value } : row))} /></label>
        <p className="text-sm">Costo total línea {index + 1}: {purchase.moneda} {money(Number(line.cantidad) * Number(line.costoUnitario))}</p>
        {lines.length > 1 && <button type="button" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>Quitar línea {index + 1}</button>}
      </div>)}<button type="button" disabled={lines.length >= 30} onClick={() => setLines((current) => [...current, { cantidad: '1', costoUnitario: '' }])} className="rounded-lg border p-2">Agregar línea</button></section>
      <section aria-label="Resumen del ingreso" className="rounded-xl bg-indigo-50 p-4"><h3 className="font-semibold">4. Resumen antes de guardar</h3><p>Compra: {purchase.moneda} {money(total)}</p><p>Compra en soles: S/ {money(total * rate)}</p><p>Logística: S/ {money(shipping)}</p><strong>Total general: S/ {money(total * rate + shipping)}</strong>{purchase.tipo === 'importada' && <p className="text-sm">Los lotes quedan en tránsito hasta registrar su recojo.</p>}</section>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
      {duplicateId && <button type="button" disabled={saving} onClick={useExisting} className="rounded-lg border border-indigo-300 p-3 text-indigo-800">Usar la referencia existente #{duplicateId}</button>}
      <footer className="flex justify-end gap-3"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" disabled={saving} className="rounded-lg bg-indigo-600 px-5 py-3 font-semibold text-white">{saving ? 'Guardando…' : 'Guardar ingreso'}</button></footer>
    </form>
  </div>;
}
