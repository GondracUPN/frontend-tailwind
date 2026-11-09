import React, { useCallback, useEffect, useId, useState } from 'react';
import api from '../api';
import AccessoryReferenceEditor from './AccessoryReferenceEditor';

const REASON_LABELS = {
  'sin stock': 'Sin stock',
  'precio publicado mayor que cero': 'Falta precio publicado',
  'comprador en la ficha de inventario': 'Falta comprador en la ficha de inventario',
  'nombre comercial': 'Falta nombre comercial',
  'referencia activa': 'Referencia inactiva',
};
const reasonLabel = (reason) => REASON_LABELS[reason] || `Falta ${reason}`;

export default function AccessoryCatalogPanel({ revision, onEdit, open }) {
  const [rows, setRows] = useState([]);
  const [checked, setChecked] = useState([]);
  const [collapsed, setCollapsed] = useState({ false: true, true: true });
  useEffect(() => {
    if (open) setCollapsed({ false: true, true: true });
  }, [open]);
  const sectionId = useId();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [blocked, setBlocked] = useState([]);
  const [reference, setReference] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { const result = await api.get('/accesorios/catalogo'); setRows(Array.isArray(result) ? result.filter((row) => row.key) : []); setError(''); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    load();
    const timer = setInterval(() => { if (document.visibilityState !== 'hidden') load(); }, 2000);
    return () => clearInterval(timer);
  }, [load, revision]);
  const change = async (keys, seleccionado) => {
    if (!keys.length) return;
    if (seleccionado && keys.some((key) => {
      const row = rows.find((item) => item.key === key);
      return !row || !(Number(row.disponible) > 0) || row.faltantes?.length;
    })) { setError('Solo se pueden enviar accesorios con stock disponible y ficha completa.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const next = await api.post('/accesorios/catalogo/seleccion', { keys, seleccionado });
      setRows(next); setChecked([]); setBlocked([]);
      setMessage(next.some((row) => keys.includes(row.key) && (row.error || row.seleccionado !== row.enviado)) ? 'Selección guardada. Hay envíos pendientes; revisa el detalle y reintenta.' : seleccionado ? 'Accesorios enviados a preparación del catálogo.' : 'Accesorios retirados del catálogo.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const edit = async (row) => {
    if (!row.referenciaId) { onEdit(row.productoId); return; }
    try { setReference(await api.get('/accesorios/referencias/' + row.referenciaId)); }
    catch (err) { setError(err.message); }
  };
  const retry = async () => {
    setBusy(true); setError('');
    try { setRows(await api.post('/accesorios/catalogo/sincronizar', {})); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const codes = (row) => (row.codigos || []).map((code) => 'ACC-' + code).join(' · ');
  // Mismo criterio que el check individual: se puede retirar lo elegido o enviar lo disponible con ficha completa.
  const selectable = (row) => !!row.seleccionado || !!row.enviado || (Number(row.disponible) > 0 && !row.faltantes?.length);
  const toggleAll = (entries, select) => {
    const keys = entries.filter(selectable).map((row) => row.key);
    setChecked((current) => select ? [...new Set([...current, ...keys])] : current.filter((key) => !keys.includes(key)));
    setBlocked(select ? entries.filter((row) => !selectable(row)) : []);
  };
  // Agrupa los bloqueados por motivo; un accesorio aparece en cada motivo que le falta.
  const blockedGroups = Object.values(blocked.reduce((groups, row) => {
    const reasons = Number(row.disponible) > 0 ? (row.faltantes || []) : ['sin stock', ...(row.faltantes || [])];
    for (const reason of reasons) {
      const group = groups[reason] || (groups[reason] = { reason, label: reasonLabel(reason), items: new Map() });
      const label = codes(row) ? `${row.nombre} · ${codes(row)}` : row.nombre;
      group.items.set(label, row.key);
    }
    return groups;
  }, {})).sort((a, b) => b.items.size - a.items.size);
  const blockedCount = new Set(blocked.map((row) => `${row.nombre}|${codes(row)}`)).size;
  const visible = rows.filter((row) => `${row.nombre} ${(row.codigos || []).map((code) => 'ACC-' + code).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const sendable = rows.filter((row) => checked.includes(row.key) && !row.seleccionado && Number(row.disponible) > 0 && !row.faltantes?.length).map((row) => row.key);
  const removable = rows.filter((row) => checked.includes(row.key) && (row.seleccionado || row.enviado)).map((row) => row.key);
  return <section aria-label="Accesorios en catálogo" className="space-y-4 bg-white p-5 sm:p-6">
    <p className="text-sm text-slate-600">Selecciona los accesorios que quieres enviar a preparación. Allí podrás subir las fotos con marca de agua y publicarlos. No se publican al enviarlos.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label>Buscar en catálogo<input className="block rounded-lg border p-2" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <button type="button" disabled={busy || !sendable.length} onClick={() => change(sendable, true)} className="rounded-lg bg-indigo-600 p-2 text-white disabled:opacity-40">Enviar seleccionados ({sendable.length})</button>
      <button type="button" disabled={busy || !removable.length} onClick={() => change(removable, false)} className="rounded-lg border p-2 disabled:opacity-40">Retirar seleccionados ({removable.length})</button>
      <button type="button" disabled={busy} onClick={retry} className="rounded-lg border p-2">Actualizar / reintentar</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    {blocked.length > 0 && <div role="status" aria-label="Accesorios que no se pueden enviar" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">No se {blockedCount === 1 ? 'puede enviar 1 accesorio' : `pueden enviar ${blockedCount} accesorios`}</p>
          <p className="mt-0.5 text-amber-800">Los demás quedaron marcados. Completa lo que falta con «Completar ficha» para poder enviarlos.</p>
        </div>
        <button type="button" onClick={() => setBlocked([])} className="shrink-0 rounded-lg px-2 py-1 text-amber-800 hover:bg-amber-100">Ocultar</button>
      </div>
      <div className="mt-3 space-y-2">
        {blockedGroups.map((group) => <details key={group.reason} className="rounded-lg border border-amber-200 bg-white/60">
          <summary className="cursor-pointer select-none px-3 py-2 font-medium">{group.label} <span className="text-amber-700">({group.items.size})</span></summary>
          <ul className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto border-t border-amber-100 p-3">
            {[...group.items.keys()].map((label) => <li key={label} className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{label}</li>)}
          </ul>
        </details>)}
      </div>
    </div>}
    {[{ sent: false, title: 'Pendientes de enviar' }, { sent: true, title: 'Enviados al catálogo' }].map(({ sent, title }) => {
      const entries = visible.filter((row) => !!row.enviado === sent);
      const contentId = `${sectionId}-${sent ? 'sent' : 'pending'}`;
      const selectableKeys = entries.filter(selectable).map((row) => row.key);
      const allChecked = selectableKeys.length > 0 && selectableKeys.every((key) => checked.includes(key));
      const someChecked = selectableKeys.some((key) => checked.includes(key));
      return <section key={title} aria-label={title} className="overflow-hidden rounded-xl border border-slate-200">
      <h3><button type="button" aria-expanded={!collapsed[sent]} aria-controls={contentId}
        onClick={() => setCollapsed((current) => ({ ...current, [sent]: !current[sent] }))}
        className="flex w-full items-center justify-between gap-3 p-4 text-left font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-indigo-600">
        <span>{title} ({entries.length})</span><span aria-hidden="true" className={`text-slate-500 transition-transform ${collapsed[sent] ? '-rotate-90' : ''}`}>⌄</span>
      </button></h3>
      <div id={contentId} hidden={!!collapsed[sent]} className="border-t border-slate-100 p-4">
      {entries.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="border-b p-2"><label className="inline-flex items-center gap-2 whitespace-nowrap">
        <input type="checkbox" aria-label={`Seleccionar todos: ${title}`} checked={allChecked} disabled={busy || !entries.length}
          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
          onChange={() => toggleAll(entries, !allChecked)} />Todos</label></th>
        {['Accesorio', 'Disponible', 'Catálogo', 'Acciones'].map((name) => <th className="border-b p-2" key={name}>{name}</th>)}</tr></thead><tbody>
      {entries.map((row) => <tr key={row.key}>
        <td className="p-2"><input type="checkbox" aria-label={`Seleccionar ${row.nombre} · ${(row.codigos || []).map((code) => 'ACC-' + code).join(' · ')}`} checked={checked.includes(row.key)} disabled={busy || (!row.seleccionado && !row.enviado && (!(Number(row.disponible) > 0) || !!row.faltantes?.length))} onChange={(e) => setChecked((current) => e.target.checked ? [...current, row.key] : current.filter((key) => key !== row.key))} /></td>
        <td className="p-2"><strong>{row.nombre}</strong><p>{(row.codigos || []).map((code) => 'ACC-' + code).join(' · ')}</p></td><td className="p-2">{row.disponible}{!(Number(row.disponible) > 0) && <p className="text-amber-700">Sin stock</p>}</td>
        <td className="p-2"><span>{row.error ? 'Sincronización pendiente' : row.seleccionado && row.enviado ? row.disponible ? 'Enviado a preparación' : 'Enviado · agotado' : row.seleccionado ? 'Envío pendiente' : row.enviado ? 'Retiro pendiente' : 'No enviado'}</span>
          {row.error && <p className="text-red-700">{row.error}</p>}{row.faltantes?.length > 0 && <p className="text-amber-700">Falta: {row.faltantes.join(', ')}.</p>}</td>
        <td className="p-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || (!row.seleccionado && (!(Number(row.disponible) > 0) || !!row.faltantes?.length))} onClick={() => change([row.key], !row.seleccionado)} className="rounded-lg border p-2 disabled:opacity-40">{row.seleccionado ? 'Retirar del catálogo' : 'Enviar al catálogo'}</button><button type="button" onClick={() => edit(row)} className="rounded-lg border p-2">Completar ficha</button></div></td>
      </tr>)}
    </tbody></table></div> : <p className="text-sm text-slate-500">{sent ? 'No hay accesorios enviados que coincidan.' : 'No hay accesorios pendientes que coincidan.'}</p>}
    </div>
    </section>;
    })}
    {loading && <p role="status" className="text-sm text-slate-500">Cargando accesorios…</p>}
    {reference && <AccessoryReferenceEditor reference={reference} onClose={() => setReference(null)} onSaved={async () => { setReference(null); await retry(); }} />}
  </section>;
}
