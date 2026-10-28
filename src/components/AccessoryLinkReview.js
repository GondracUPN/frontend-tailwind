import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { nuevaClave } from '../services/finanzas';

const cls = 'mt-1 w-full rounded-lg border border-slate-300 bg-white p-2';
const money = (value) => value == null ? '—' : 'S/ ' + Number(value).toFixed(2);
const draftFor = (row) => ({ mode: row.referenciaId ? 'existente' : 'nueva', referenciaId: row.referenciaId ? String(row.referenciaId) : '', data: { ...row.datosReferenciaPropuesta } });

const reviewReasons = (row) => {
  const reasons = [
    ['originalidad desconocida', 'No está registrado si es original, compatible o una imitación. Debes indicarlo antes de confirmar.'],
    ['estado vacío', 'Falta indicar en qué estado está el accesorio, por ejemplo, nuevo o usado.'],
    ['estado sin normalizar', 'El estado registrado necesita revisión. Elige el estado correcto al editar.'],
    ['modelo faltante', 'Falta el nombre o modelo del accesorio.'],
    ['categoría faltante', 'Falta indicar qué tipo de accesorio es.'],
    ['variante faltante', 'Falta indicar la versión o característica que lo distingue, por ejemplo, USB-C, color o tamaño.'],
    ['potencia faltante', 'No está indicada la potencia en watts. Comprueba el accesorio y completa ese dato.'],
    ['conector faltante', 'No está indicado qué conector utiliza, por ejemplo, USB-C o Lightning.'],
    ['detalles distintos', 'Las compras de este grupo tienen características diferentes. Comprueba que correspondan al mismo accesorio antes de reunirlas.'],
    ['está inactiva', 'La ficha que coincide con este accesorio está desactivada. Elige una ficha activa antes de confirmar.'],
  ].filter(([match]) => String(row.motivo || '').includes(match)).map(([, explanation]) => explanation);
  return reasons.length ? reasons : row.ambigua ? ['No hay información suficiente para confirmar que estas compras corresponden al mismo accesorio. Revisa y completa sus características.'] : [];
};

function PurchaseDetail({ detalle }) {
  const fields = { modelo: 'Modelo', gama: 'Tipo', generacion: 'Generación', descripcionOtro: 'Características', modelosCompatibles: 'Compatible con', procesador: 'Procesador', numero: 'Serie', tamano: 'Tamaño', almacenamiento: 'Almacenamiento', ram: 'Memoria', conexion: 'Conexión', esim: 'eSIM' };
  const values = Object.entries(fields).map(([key, label]) => [label, Array.isArray(detalle?.[key]) ? detalle[key].join(', ') : detalle?.[key]])
    .filter(([, value]) => value != null && String(value).trim() !== '');
  return values.length ? <dl>{values.map(([label, value]) => <div key={label}><dt className="inline font-medium">{label}: </dt><dd className="inline">{String(value)}</dd></div>)}</dl> : <span>Sin características registradas.</span>;
}

function ReferenceEditor({ row, draft, onChange }) {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState(row.referencia ? [row.referencia] : []);
  const [error, setError] = useState('');
  useEffect(() => {
    if (draft.mode !== 'existente') return undefined;
    let active = true;
    const timer = setTimeout(() => api.get('/accesorios/referencias?q=' + encodeURIComponent(q)).then((data) => {
      if (active) setOptions([...(row.referencia ? [row.referencia] : []), ...(Array.isArray(data) ? data.filter((ref) => ref.id !== row.referencia?.id) : [])]);
    }).catch((err) => { if (active) setError(err.message); }), 300);
    return () => { active = false; clearTimeout(timer); };
  }, [q, draft.mode, row.referencia]);
  return <div aria-label={`Editar propuesta ${row.id}`} className="mt-3 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
    <label>Destino de la propuesta<select className={cls} value={draft.mode} onChange={(event) => onChange({ ...draft, mode: event.target.value })}><option value="nueva">Crear referencia con datos revisados</option><option value="existente">Elegir referencia existente</option></select></label>
    {draft.mode === 'existente' ? <><label className="block">Buscar otra referencia<input className={cls} value={q} onChange={(event) => setQ(event.target.value)} /></label><label className="block">Referencia existente<select className={cls} value={draft.referenciaId} onChange={(event) => onChange({ ...draft, referenciaId: event.target.value })}><option value="">Seleccionar</option>{options.map((ref) => <option key={ref.id} value={ref.id}>#{ref.id} · {ref.modelo} · {ref.variante} · {ref.estado} · {ref.originalidad}</option>)}</select></label></>
      : <div className="grid gap-3 sm:grid-cols-2">{Object.entries({ categoria: 'Categoría propuesta', marca: 'Marca propuesta', modelo: 'Modelo propuesto', generacion: 'Generación propuesta', variante: 'Variante propuesta', compatibilidad: 'Compatibilidad propuesta' }).map(([key, label]) => <label key={key}>{label}<input className={cls} value={draft.data[key] || ''} onChange={(event) => onChange({ ...draft, data: { ...draft.data, [key]: event.target.value } })} /></label>)}
        <label>Estado propuesto<select className={cls} value={draft.data.estado || ''} onChange={(event) => onChange({ ...draft, data: { ...draft.data, estado: event.target.value } })}><option value="">Completar estado</option>{['nuevo', 'usado', 'open_box', 'reacondicionado', 'roto'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Originalidad propuesta<select className={cls} value={draft.data.originalidad || ''} onChange={(event) => onChange({ ...draft, data: { ...draft.data, originalidad: event.target.value } })}><option value="">Completar originalidad</option>{['original', 'fake', 'compatible'].map((value) => <option key={value}>{value}</option>)}</select></label>
      </div>}
    {error && <p role="alert">{error}</p>}
  </div>;
}

export default function AccessoryLinkReview({ onClose, onChanged }) {
  const [filters, setFilters] = useState({ estado: 'pendiente', puntuacionMin: '0', q: '', page: 1 });
  const [view, setView] = useState('propuestas');
  const [version, setVersion] = useState(0);
  const [rows, setRows] = useState([]), [audits, setAudits] = useState([]);
  const [total, setTotal] = useState(0), [auditPage, setAuditPage] = useState(1);
  const [auditTotal, setAuditTotal] = useState(0);
  const [drafts, setDrafts] = useState({});
  const [partial, setPartial] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(null), [reason, setReason] = useState('');
  const operation = useRef(null);
  const query = new URLSearchParams(filters).toString();
  useEffect(() => {
    let active = true;
    const path = view === 'propuestas' ? '/accesorios/vinculos?' + query : '/accesorios/vinculos/auditoria?page=' + auditPage;
    api.get(path).then((data) => {
      if (!active) return;
      const list = Array.isArray(data) ? data : data.items || [];
      if (view === 'propuestas') { setRows(list); setTotal(data.total ?? list.length); }
      else { setAudits(list); setAuditTotal(data.total ?? list.length); }
    }).catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [query, version, view, auditPage]);
  const reload = () => { setVersion((value) => value + 1); onChanged?.(); };
  const generate = async () => {
    setBusy(true); setError('');
    try { const result = await api.post('/accesorios/vinculos/generar', {}); setMessage(`Generadas: ${result.nuevas}; actualizadas: ${result.actualizadas}; obsoletas: ${result.obsoletas}. Revisa antes de aceptar.`); reload(); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const prepare = (selected) => {
    if (!selected.length) return;
    for (const row of selected) {
      const draft = drafts[row.id];
      if (draft?.mode === 'existente' && !draft.referenciaId) return setError('Selecciona una referencia existente.');
      if (draft?.mode === 'nueva' && ['categoria', 'modelo', 'estado', 'originalidad'].some((key) => !draft.data[key]?.trim())) return setError('Completa categoría, modelo, estado y originalidad antes de aceptar.');
    }
    setError(''); setConfirm({ kind: 'apply', selected });
  };
  const execute = async () => {
    if (!confirm || busy) return;
    setBusy(true); setError('');
    try {
      if (confirm.kind === 'apply') {
        const body = { propuestaIds: confirm.selected.map((row) => row.id), parcial: partial,
          ajustes: confirm.selected.filter((row) => drafts[row.id]).map((row) => {
            const draft = drafts[row.id];
            return { propuestaId: row.id, ...(draft.mode === 'existente' ? { referenciaId: Number(draft.referenciaId) } : { datosReferencia: draft.data }) };
          }) };
        const signature = JSON.stringify(body);
        if (!operation.current || operation.current.signature !== signature) operation.current = { signature, key: nuevaClave() };
        const result = await api.post('/accesorios/vinculos/aplicar', { ...body, idempotencyKey: operation.current.key });
        setMessage(`Aplicadas: ${result.aplicadas.length} propuestas. ${result.fallos.length ? 'No aplicadas: ' + result.fallos.map((row) => row.propuestaId + ': ' + row.motivo).join('; ') : ''}`);
      } else if (confirm.kind === 'reject') {
        await api.post(`/accesorios/vinculos/${confirm.id}/rechazar`, { ...(reason.trim() ? { motivo: reason.trim() } : {}) });
        setMessage('Propuesta rechazada.');
      } else {
        await api.post('/accesorios/vinculos/deshacer', { auditoriaIds: [confirm.id], idempotencyKey: confirm.key });
        setMessage('Vínculo deshecho y auditado.');
      }
      setConfirm(null); reload();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Revisar sin referencia" className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/60 p-3"><section className="max-h-[95vh] w-full max-w-6xl space-y-4 overflow-auto rounded-2xl bg-white p-5">
    <header className="flex justify-between gap-3"><div><h2 className="text-xl font-semibold">Revisar sin referencia</h2><p className="text-sm text-slate-600">Las propuestas requieren tu confirmación. Cada aceptación asigna referencias a todos los lotes del grupo revisado.</p></div><button type="button" disabled={busy} onClick={onClose}>Cerrar revisión</button></header>
    <nav className="flex flex-wrap gap-3"><button type="button" onClick={() => setView('propuestas')}>Propuestas</button><button type="button" onClick={() => setView('auditoria')}>Historial de auditoría</button><button type="button" disabled={busy} onClick={generate} className="rounded-lg border p-2">Generar propuestas</button></nav>
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm">{message}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{error}</p>}
    {view === 'propuestas' ? <>
      <div className="grid gap-3 sm:grid-cols-3"><label>Estado de propuestas<select className={cls} value={filters.estado} onChange={(event) => setFilters((current) => ({ ...current, estado: event.target.value, page: 1 }))}>{['pendiente', 'aceptada', 'rechazada', 'obsoleta', 'todos'].map((state) => <option key={state}>{state}</option>)}</select></label><label>Puntuación mínima<input className={cls} type="number" min="0" max="100" value={filters.puntuacionMin} onChange={(event) => setFilters((current) => ({ ...current, puntuacionMin: event.target.value, page: 1 }))} /></label><label>Buscar propuestas<input className={cls} value={filters.q} onChange={(event) => setFilters((current) => ({ ...current, q: event.target.value, page: 1 }))} /></label></div>
      <button type="button" disabled={busy || !rows.some((row) => row.estado === 'pendiente' && row.puntuacion >= 90 && !row.ambigua && !row.posibleDuplicado)} onClick={() => prepare(rows.filter((row) => row.estado === 'pendiente' && row.puntuacion >= 90 && !row.ambigua && !row.posibleDuplicado))} className="rounded-lg bg-indigo-600 p-3 font-semibold text-white disabled:opacity-40">Aceptar puntuación alta de esta página</button>
      <p className="text-sm">{total} propuestas · página {filters.page}</p>
      {rows.map((row) => <article key={row.id} aria-label={`Propuesta ${row.id}`} className="space-y-2 rounded-xl border p-4">
        <h3 className="text-lg font-semibold">{row.lotes?.[0]?.detalle?.modelo || row.referencia?.modelo || row.datosReferenciaPropuesta?.modelo || 'Accesorio por identificar'}</h3>
        <p>{row.lotes?.length || 0} compras de {row.lotes?.[0]?.vendedor || 'comprador sin indicar'} · {(row.lotes || []).reduce((sum, lot) => sum + Number(lot.stockActual || 0), 0)} unidades disponibles</p>
        <p className="text-sm text-slate-500">Identificación actual: ACC-{String(row.grupo).split(':')[0]} · {{ pendiente: 'Pendiente de tu revisión', aceptada: 'Organización confirmada', rechazada: 'Propuesta rechazada', obsoleta: 'La información cambió; genera una nueva propuesta' }[row.estado] || row.estado}</p>
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <h4 className="font-semibold">{row.ambigua ? 'Faltan datos por confirmar' : 'Comprueba que estas compras sean del mismo accesorio'}</h4>
          {reviewReasons(row).length > 0 ? <ul className="list-disc space-y-1 pl-5">{reviewReasons(row).map((reason) => <li key={reason}>{reason}</li>)}</ul> : <p>Las características registradas permiten proponer esta organización. Revisa que sean correctas antes de aceptar.</p>}
          {row.posibleDuplicado && <p className="text-amber-800">Posible duplicado entre códigos: hay otras compras con las mismas características, registradas por separado. Revísalas antes de decidir si son el mismo accesorio.</p>}
          {row.estado === 'pendiente' && <p className="font-medium">{row.ambigua ? 'Pulsa «Editar y aceptar / elegir otra referencia» para completar o corregir los datos. Si estas compras son accesorios distintos, no aceptes una ficha común.' : 'Si todo coincide, puedes aceptar la propuesta. Si hay algún dato incorrecto, edítalo primero.'}</p>}
        </div>
        <p><strong>Se propone organizar estas compras como:</strong> {row.referencia?.modelo || row.datosReferenciaPropuesta?.modelo || 'Modelo por completar'}{(row.referencia?.variante || row.datosReferenciaPropuesta?.variante) ? ' · ' + (row.referencia?.variante || row.datosReferenciaPropuesta?.variante) : ''}. {row.referenciaId ? 'Se usará una ficha de accesorio que ya existe.' : 'Se creará una ficha de accesorio cuando confirmes.'}</p>
        <p className="text-sm text-slate-600">Cada compra conserva su propio costo, aunque sea del mismo accesorio. Las compras agotadas se muestran para conservar su historial.</p>
        <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Compra', 'Comprador', 'Unidades disponibles', 'Fecha de compra', 'Costo por unidad', 'Características registradas'].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{(row.lotes || []).map((lot, index) => <tr key={lot.id}><td className="p-2">Compra {index + 1}</td><td className="p-2">{lot.vendedor || 'Sin indicar'}</td><td className="p-2">{Number(lot.stockActual) === 0 ? 'Agotada (0 unidades)' : lot.stockActual}</td><td className="p-2">{String(lot.valor?.fechaCompra || '').slice(0, 10) || 'Sin fecha'}</td><td className="p-2">{lot.valor ? money(Number(lot.valor.costoTotalProrrateado ?? lot.valor.costoTotal ?? lot.valor.valorSoles) / Math.max(1, Number(lot.stockInicial))) : '—'}</td><td className="p-2"><PurchaseDetail detalle={lot.detalle} /></td></tr>)}</tbody></table></div>
        {row.estado === 'pendiente' && <><div className="flex flex-wrap gap-3"><button type="button" disabled={busy} onClick={() => prepare([row])} className="rounded-lg bg-emerald-600 p-2 text-white">{drafts[row.id] ? 'Aceptar datos revisados' : 'Aceptar propuesta'}</button><button type="button" disabled={busy} onClick={() => setDrafts((current) => ({ ...current, [row.id]: current[row.id] || draftFor(row) }))} className="rounded-lg border p-2">Editar y aceptar / elegir otra referencia</button><button type="button" disabled={busy} onClick={() => { setReason(''); setConfirm({ kind: 'reject', id: row.id }); }} className="rounded-lg border p-2 text-rose-700">Rechazar propuesta</button></div>
          {drafts[row.id] && <ReferenceEditor row={row} draft={drafts[row.id]} onChange={(draft) => setDrafts((current) => ({ ...current, [row.id]: draft }))} />}</>}
      </article>)}
      {!rows.length && <p>No hay propuestas con estos filtros. Genera propuestas para empezar.</p>}
      <div className="flex gap-3"><button type="button" disabled={filters.page <= 1 || busy} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}>Página anterior</button><button type="button" disabled={filters.page * 50 >= total || busy} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}>Página siguiente</button></div>
    </> : <><h3 className="font-semibold">Historial de auditoría</h3>{audits.map((row) => <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3" key={row.id}><p>Lote {row.productoId} · {row.accion} · referencia {row.referenciaIdAnterior ?? 'sin referencia'} → {row.referenciaIdNuevo ?? 'sin referencia'} · {row.usuario} · {String(row.createdAt).slice(0, 19)} {row.deshecha ? '· Deshecha' : ''}</p>{row.puedeDeshacer && <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'undo', id: row.id, key: nuevaClave() })} className="rounded-lg border p-2">Deshacer vínculo del lote {row.productoId}</button>}</article>)}{!audits.length && <p>Sin movimientos de vinculación.</p>}<div className="flex gap-3"><button disabled={auditPage <= 1} onClick={() => setAuditPage((value) => value - 1)}>Auditoría anterior</button><button disabled={auditPage * 100 >= auditTotal} onClick={() => setAuditPage((value) => value + 1)}>Auditoría siguiente</button></div></>}
    {confirm && <div role="dialog" aria-modal="true" aria-label="Confirmar revisión" className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-lg space-y-4 rounded-xl bg-white p-5">
      {confirm.kind === 'apply' ? <><h3 className="font-semibold">Confirmar vinculación</h3><p>Se vincularán {confirm.selected.reduce((sum, row) => sum + (row.productoIds?.length || row.lotes?.length || 0), 0)} lotes de {confirm.selected.length} grupos.</p><label className="flex gap-2"><input type="checkbox" checked={partial} onChange={(event) => setPartial(event.target.checked)} />Permitir aplicación parcial si una propuesta cambió</label><p className="text-sm">{partial ? 'Se aplicarán los grupos válidos y se informarán los rechazados.' : 'Si falla cualquier propuesta, se deshace toda esta operación.'}</p></>
        : confirm.kind === 'reject' ? <label className="block">Motivo del rechazo<input className={cls} value={reason} onChange={(event) => setReason(event.target.value)} /></label> : <p>Se restaurará la referencia anterior de este lote y se registrará la reversión en la auditoría.</p>}
      <div className="flex justify-end gap-3"><button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancelar confirmación</button><button type="button" disabled={busy} onClick={execute} className="rounded-lg bg-indigo-600 p-3 text-white">{busy ? 'Procesando…' : confirm.kind === 'apply' ? 'Confirmar vínculo' : confirm.kind === 'reject' ? 'Confirmar rechazo' : 'Confirmar deshacer'}</button></div>
    </div></div>}
  </section></div>;
}
