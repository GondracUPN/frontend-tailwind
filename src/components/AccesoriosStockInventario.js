import { useState } from 'react';
import { FiPlus, FiX } from 'react-icons/fi';
import { accessoryLotAvailable } from '../utils/accessorySales';
import { accessoryInventoryDates, accessoryPackaging, compareAccessoryDates, matchesAccessoryQuery } from '../utils/accessoryInventory';

// Los lotes fusionados se muestran como una sola opción: stock sumado, código del lote principal
// y, al elegirla, se usa el lote más antiguo con stock (FIFO).
export function groupFusedLots(options) {
  const groups = new Map();
  const result = [];
  options.forEach((option) => {
    if (!option.fusionId) { result.push(option); return; }
    const current = groups.get(option.fusionId);
    if (!current) { const group = { ...option }; groups.set(option.fusionId, group); result.push(group); return; }
    current.stock += option.stock;
    current.lots = [...current.lots, ...option.lots];
    if (compareAccessoryDates(option.fecha.date, current.fecha.date, true) < 0) current.fecha = option.fecha;
  });
  return result.map((option) => {
    if (!option.fusionId) return option;
    const ordered = [...option.lots].sort((a, b) => a.id - b.id);
    const principal = option.lots.find((lot) => lot.id === option.fusionId) || ordered[0];
    const pick = ordered.find((lot) => Number(lot.stockActual || 0) > 0) || ordered[0];
    return { ...option, id: pick.id, code: principal.codigoInventario || principal.id };
  });
}

export default function AccesoriosStockInventario({ stock, entries, buildNombre, onChange, saving }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const items = stock?.accesorios || [];
  const ids = items.map((item) => item.productoId);
  const options = open ? groupFusedLots(entries.flatMap((entry) => {
    const lot = entry.producto;
    if (lot.tipo !== 'accesorios' || lot.archivadoAt || lot.cierreMotivo || !accessoryLotAvailable(lot) || ids.includes(lot.id)) return [];
    const label = buildNombre(lot);
    const empaque = accessoryPackaging[lot.empaqueAccesorio];
    return [{ id: lot.id, fusionId: lot.fusionAccesorioId || null, label, code: lot.codigoInventario || lot.id, seller: lot.vendedor,
      stock: Number(lot.stockActual || 0), empaque, fecha: accessoryInventoryDates(entry), lots: [lot] }];
  })).filter((option) => matchesAccessoryQuery(query, option.lots, `${option.label} ${option.seller || ''} ${option.empaque || ''}`))
    .sort((a, b) => compareAccessoryDates(a.fecha.date, b.fecha.date) || b.id - a.id) : [];

  return (
    <div className="mt-4 space-y-2 rounded-xl border border-slate-200 p-3">
      {items.map((item) => (
        <div key={item.productoId} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-slate-50 pl-3 text-sm text-slate-800">
          <span>{item.nombre}</span>
          <button type="button" disabled={saving} onClick={() => onChange(ids.filter((id) => id !== item.productoId))}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 disabled:opacity-50"
            aria-label={`Quitar ${item.nombre} del equipo`}><FiX /></button>
        </div>
      ))}
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} disabled={saving}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50">
        {open ? <FiX aria-hidden="true" /> : <FiPlus aria-hidden="true" />}
        {open ? 'Cerrar búsqueda' : 'Agregar accesorio del stock'}
      </button>
      {open && <>
        <input aria-label="Buscar accesorio del stock" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre o código" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
        <div className="max-h-52 overflow-auto">
          {options.map((lot) => (
            <button type="button" key={lot.fusionId ? `fusion-${lot.fusionId}` : lot.id} disabled={saving}
              onClick={async () => { if (await onChange([...ids, lot.id])) { setOpen(false); setQuery(''); } }}
              className="flex w-full items-center justify-between gap-3 rounded-lg p-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-50">
              <span>{lot.label}<span className="block text-xs text-slate-500">
                ACC-{lot.code}{lot.empaque ? ` · ${lot.empaque}` : ''}{lot.seller ? ` · ${lot.seller}` : ''}{lot.fecha.date ? ` · ${lot.fecha.label} ${lot.fecha.date}` : ''}
              </span></span>
              <span className="shrink-0 text-xs text-slate-600">{lot.stock} disp.</span>
            </button>
          ))}
          {!options.length && <p className="p-2 text-sm text-slate-500">Sin accesorios disponibles para esa búsqueda.</p>}
        </div>
      </>}
    </div>
  );
}
