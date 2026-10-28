import React, { useState } from 'react';
import { formatDisplayMoney } from './ui/VisualUI';

const dateLabel = (value) => {
  const parts = String(value || '').slice(0, 10).split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : 'Sin fecha';
};
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function AccessorySalesPanel({ id, seller, period, groups, onEdit, onResolve }) {
  const [query, setQuery] = useState('');
  const filtered = groups.filter((group) => normalize(group.name).includes(normalize(query.trim())));

  return (
      <section id={id} aria-label={`Ventas de accesorios de ${seller}`} className="w-full rounded-xl border border-slate-200 bg-slate-50 text-left">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 pt-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Detalle de ventas</h3>
            <p className="mt-1 text-xs text-slate-500">{period}</p>
          </div>
        </header>
        <div className="px-4">
          <label className="mt-4 block">
            <span className="sr-only">Buscar accesorio vendido</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar accesorio…" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
          </label>
          <p className="my-3 text-xs text-slate-500" aria-live="polite">{filtered.length} {filtered.length === 1 ? 'producto' : 'productos'} · {filtered.reduce((sum, group) => sum + group.sales.length, 0)} ventas</p>
        </div>
        <div className="px-4 pb-4">
          {filtered.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No hay accesorios que coincidan con la búsqueda.</p>}
          <div className="space-y-4">
            {filtered.map((group) => <section key={group.id} aria-label={group.name} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-100/60 px-4 py-3">
                <h3 className="min-w-0 break-words text-sm font-semibold text-slate-900">{group.name}</h3>
                <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{group.units} ud.</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {group.sales.map((sale) => {
                  const units = Math.max(0, Number(sale.cantidad || 1) - Number(sale.cantidadDevuelta || 0));
                  const revenue = (Number(sale.precioVenta || 0) - Number(sale.precioDevuelto || 0)) * Number(sale.__share ?? 1);
                  return <li key={sale.id} className="px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm text-slate-700"><p>{dateLabel(sale.fechaVenta)}</p><p className="mt-1 text-xs text-slate-500">{units} {units === 1 ? 'unidad' : 'unidades'}{sale.cantidadDevuelta > 0 ? ` · ${sale.cantidadDevuelta} devuelta(s)` : ''}{Number(sale.__share ?? 1) !== 1 ? ' · 50% compartido' : ''}</p></div>
                      <p className="shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatDisplayMoney(revenue)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => onEdit(sale)} className="min-h-[40px] rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">Editar</button>
                      <button type="button" onClick={() => onResolve(sale)} className="min-h-[40px] rounded-lg px-3 text-xs font-medium text-rose-700 hover:bg-rose-50">Devolver / corregir</button>
                    </div>
                  </li>;
                })}
              </ul>
            </section>)}
          </div>
        </div>
      </section>
  );
}
