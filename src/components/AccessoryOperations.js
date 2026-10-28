import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';

const cash = (value) => value == null ? '—' : 'S/ ' + Number(value).toFixed(2);
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function AccessoryOperations({ revision, onSell, onReplenish, onEditLot }) {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ estado: '', originalidad: '', variante: '' });
  const [expanded, setExpanded] = useState(null);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    try { const data = await api.get('/accesorios/operativo'); setRows(Array.isArray(data) ? data.filter((row) => row.key && row.referenciaId) : []); setError(''); }
    catch (err) { setError(err.message); }
  }, []);
  useEffect(() => { load(); }, [revision, load]);
  const visible = rows.filter((row) => normalize([row.nombre, row.codigo, ...(row.codigos || []).map((code) => 'ACC-' + code), 'ACC-' + row.codigo, row.compatibilidad].join(' ')).includes(normalize(query))
    && Object.entries(filters).every(([field, value]) => !value || row[field] === value));
  const showHistory = async (row) => {
    try { const result = await api.get('/ventas/similares?productoId=' + row.producto.id + '&limit=8'); setHistory({ name: row.nombre, result }); }
    catch (err) { setError(err.message); }
  };
  const saveReference = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      await api.patch('/accesorios/referencias/' + editing.id, Object.fromEntries(Object.entries(editing).filter(([key]) => ['fotoUrl', 'precioPublicadoSoles', 'precioMinimoSoles', 'precioMayoristaSoles', 'cantidadMinimaMayorista', 'activo'].includes(key)).map(([key, value]) => [key, /precio|cantidad/.test(key) ? value === '' || value == null ? null : Number(value) : value])));
      setEditing(null); await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <section aria-label="Operación de accesorios" className="mb-5 space-y-3 rounded-2xl border bg-white p-4">
    <h2 className="text-lg font-semibold">Referencias comerciales</h2>
    <div className="grid gap-3 md:grid-cols-4"><label>Buscar accesorios<input className="mt-1 w-full rounded-lg border p-2" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, ACC o compatibilidad" /></label>
      {Object.entries({ estado: 'Filtrar estado', originalidad: 'Filtrar originalidad', variante: 'Filtrar variante' }).map(([field, label]) => <label key={field}>{label}<select className="mt-1 w-full rounded-lg border p-2" value={filters[field]} onChange={(event) => setFilters((current) => ({ ...current, [field]: event.target.value }))}><option value="">Todos</option>{[...new Set(rows.map((row) => row[field]).filter(Boolean))].map((value) => <option key={value}>{value}</option>)}</select></label>)}
    </div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {visible.length === 0 ? <p className="text-sm text-slate-500">No hay referencias que coincidan. Puedes ingresar una nueva compra o revisar el grupo Sin referencia.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['Accesorio', 'Comprador', 'Disponible', 'En tránsito', 'Costo próxima unidad', 'Publicado / mínimo', 'Última venta por unidad', 'Acciones'].map((name) => <th key={name} className="whitespace-nowrap border-b p-2">{name}</th>)}</tr></thead><tbody>{visible.map((row) => <React.Fragment key={row.key}><tr>
      <td className="p-2"><strong>{row.nombre}</strong><p>{(row.codigos?.length ? row.codigos : [row.codigo]).map((code) => 'ACC-' + code).join(' · ')}</p><p className="text-xs text-slate-500">{row.compatibilidad} · {row.estado} · {row.originalidad}</p>{row.referencia?.fotoUrl && <img src={row.referencia.fotoUrl} className="mt-1 h-12 w-16 rounded object-cover" alt={row.nombre} />}</td>
      <td className="p-2">{row.comprador || 'Sin comprador'}</td><td className="p-2">{row.disponible}</td><td className="p-2">{row.enTransito}</td><td className="p-2">{cash(row.costoProximaUnidad)}</td><td className="p-2">{cash(row.precioPublicado)} / {cash(row.precioMinimo)}</td><td className="p-2">{row.ultimaVenta ? <>{cash(row.ultimaVenta.precioUnitario)}<p>{String(row.ultimaVenta.fechaVenta).slice(0, 10)}</p></> : 'Sin ventas'}</td>
      <td className="p-2"><div className="flex flex-wrap gap-2"><button type="button" disabled={!row.disponible} onClick={() => onSell(row)} className="rounded bg-emerald-600 p-2 text-white disabled:opacity-40">Vender</button><button type="button" disabled={row.referencia?.activo === false} onClick={() => onReplenish(row.referencia)} className="rounded border p-2">Reponer</button><button type="button" onClick={() => setExpanded(expanded === row.key ? null : row.key)} className="rounded border p-2">Ver lotes</button><button type="button" onClick={() => showHistory(row)} className="rounded border p-2">Ver historial</button><button type="button" onClick={() => setEditing(row.referencia)} className="rounded border p-2">Editar precios / foto</button></div></td>
    </tr>{expanded === row.key && <tr><td colSpan="8" className="bg-slate-50 p-3"><ul>{row.lotes.map((lot) => <li key={lot.id} className="flex flex-wrap items-center gap-3 py-2">Lote {lot.id} · {lot.stockInicial} compradas · {lot.stockActual} restantes · compra {String(lot.valor?.fechaCompra || '').slice(0, 10)}<button type="button" className="rounded border p-2" onClick={() => onEditLot(lot, row.lotes)}>Editar lote</button></li>)}</ul></td></tr>}</React.Fragment>)}</tbody></table></div>}
    {history && <div role="dialog" aria-modal="true" aria-label="Historial de referencia" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3"><div className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-auto rounded-xl bg-white p-5"><h3 className="font-semibold">{history.name}</h3>{[['coincidenciaExacta', 'Coincidencia exacta'], ['mismaFamilia', 'Misma familia']].map(([key, title]) => <section key={key}><h4>{title}</h4>{history.result?.[key]?.length ? history.result[key].map((sale) => <p key={sale.id}>{sale.fechaVenta} · {sale.producto?.detalle?.modelo} · {sale.producto?.estado} · {sale.cantidad} unidades · {cash(sale.precioUnitario)} por unidad · Total {cash(sale.total)}</p>) : <p>Sin ventas comparables.</p>}</section>)}<button type="button" onClick={() => setHistory(null)}>Cerrar historial</button></div></div>}
    {editing && <div role="dialog" aria-modal="true" aria-label="Editar referencia" className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3"><form onSubmit={saveReference} className="w-full max-w-md space-y-3 rounded-xl bg-white p-5"><h3 className="font-semibold">Precios y foto de {editing.modelo}</h3>{Object.entries({ precioPublicadoSoles: 'Precio publicado', precioMinimoSoles: 'Precio mínimo', precioMayoristaSoles: 'Precio mayorista', cantidadMinimaMayorista: 'Cantidad mínima mayorista', fotoUrl: 'URL de foto' }).map(([key, label]) => <label className="block" key={key}>{label}<input className="mt-1 w-full rounded border p-2" type={key === 'fotoUrl' ? 'text' : 'number'} min={key === 'cantidadMinimaMayorista' ? '1' : '0'} step={key === 'cantidadMinimaMayorista' ? '1' : '0.01'} value={editing[key] ?? ''} onChange={(event) => setEditing((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="flex gap-2"><input type="checkbox" checked={editing.activo !== false} onChange={(event) => setEditing((current) => ({ ...current, activo: event.target.checked }))} />Referencia activa</label><div className="flex justify-end gap-3"><button type="button" onClick={() => setEditing(null)}>Cancelar</button><button disabled={saving} className="rounded bg-indigo-600 p-2 text-white">Guardar referencia</button></div>{error && <p role="alert">{error}</p>}</form></div>}
  </section>;
}
