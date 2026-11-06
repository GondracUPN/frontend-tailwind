import React, { useCallback, useEffect, useId, useState } from 'react';
import api from '../api';
import AccessoryReferenceEditor from './AccessoryReferenceEditor';

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
      setRows(next); setChecked([]);
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
  const visible = rows.filter((row) => `${row.nombre} ${(row.codigos || []).map((code) => 'ACC-' + code).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  const sendable = rows.filter((row) => checked.includes(row.key) && !row.seleccionado && Number(row.disponible) > 0 && !row.faltantes?.length).map((row) => row.key);
  const removable = rows.filter((row) => checked.includes(row.key) && (row.seleccionado || row.enviado)).map((row) => row.key);
  return <section aria-label="Accesorios en catálogo" className="space-y-4 bg-white p-5 sm:p-6">
    <p className="text-sm text-slate-600">Selecciona los accesorios que quieres enviar a preparación. Allí podrás subir las fotos con marca de agua y publicarlos. No se publican al enviarlos.</p>
    <div className="flex flex-wrap items-end gap-3">
      <label>Buscar en catálogo<input className="block rounded-lg border p-2" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
      <button type="button" disabled={busy || !sendable.length} onClick={() => change(sendable, true)} className="rounded-lg bg-indigo-600 p-2 text-white disabled:opacity-40">Enviar seleccionados ({sendable.length})</button>
      <button type="button" disabled={busy || !removable.length} onClick={() => change(removable, false)} className="rounded-lg border p-2 disabled:opacity-40">Retirar seleccionados</button>
      <button type="button" disabled={busy} onClick={retry} className="rounded-lg border p-2">Actualizar / reintentar</button>
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status">{message}</p>}
    {[{ sent: false, title: 'Pendientes de enviar' }, { sent: true, title: 'Enviados al catálogo' }].map(({ sent, title }) => {
      const entries = visible.filter((row) => !!row.enviado === sent);
      const contentId = `${sectionId}-${sent ? 'sent' : 'pending'}`;
      return <section key={title} aria-label={title} className="overflow-hidden rounded-xl border border-slate-200">
      <h3><button type="button" aria-expanded={!collapsed[sent]} aria-controls={contentId}
        onClick={() => setCollapsed((current) => ({ ...current, [sent]: !current[sent] }))}
        className="flex w-full items-center justify-between gap-3 p-4 text-left font-semibold text-slate-900 hover:bg-slate-50 focus-visible:outline-indigo-600">
        <span>{title} ({entries.length})</span><span aria-hidden="true" className={`text-slate-500 transition-transform ${collapsed[sent] ? '-rotate-90' : ''}`}>⌄</span>
      </button></h3>
      <div id={contentId} hidden={!!collapsed[sent]} className="border-t border-slate-100 p-4">
      {entries.length > 0 ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Elegir', 'Accesorio', 'Disponible', 'Catálogo', 'Acciones'].map((name) => <th className="border-b p-2" key={name}>{name}</th>)}</tr></thead><tbody>
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
