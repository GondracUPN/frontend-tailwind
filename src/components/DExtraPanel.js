import React, { useState } from 'react';
import CobroVentaForm from './CobroVentaForm';

const money = (amount) => `S/ ${Number(amount || 0).toFixed(2)}`;
const kindName = { advance: 'Adelanto', card: 'Tarjeta', debt: 'x500', direct: 'Directo', cash: 'Efectivo' };
const iconButton = 'inline-flex h-7 w-7 items-center justify-center rounded border text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600';

// Cada deuda muestra solo lo que falta; al abrirla, su historial y el cobro quedan en el mismo cuadro.
export default function DExtraPanel({ debts, onClose, onCollected, onAdvance }) {
  const [openId, setOpenId] = useState(null);
  const [rowId, setRowId] = useState(null);
  const total = debts.reduce((sum, debt) => sum + Number(debt.pending || 0), 0);
  const toggle = (debt) => {
    const opening = openId !== debt.id;
    setOpenId(opening ? debt.id : null);
    setRowId(opening ? debt.collectionRows[0]?.id ?? null : null);
  };
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="D.Extra">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-semibold">D.Extra</h2><p className="text-sm text-slate-600">Ingresos y adelantos pendientes de cobrar</p></div>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1">Cerrar</button>
      </div>
      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950"><span className="text-sm">Total por cobrar</span><strong className="block text-2xl tabular-nums">{money(total)}</strong></div>
      <div className="mt-4 space-y-3">
        {debts.length === 0 && <p className="rounded border p-4 text-sm text-slate-600">No hay saldos pendientes.</p>}
        {debts.map((debt) => {
          const open = openId === debt.id;
          const row = debt.collectionRows.find((item) => item.id === rowId);
          return <article key={debt.id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{debt.title}</h3>
                <p className="text-xs text-slate-500">Inicio: {debt.startedAt || '-'} · {debt.kinds.map((kind) => kindName[kind] || kind).join(' + ')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-amber-800">Falta {money(debt.pending)}</span>
                <button type="button" onClick={() => toggle(debt)} aria-expanded={open} aria-label={`${open ? 'Ocultar cobro de' : 'Cobrar'} ${debt.title}`} title={open ? 'Ocultar' : 'Cobrar'}
                  className={`${iconButton} ${open ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'}`}>$</button>
              </div>
            </div>
            {open && <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
              {debt.history.length > 0 && <ul className="text-xs text-slate-600">{debt.history.map((payment, index) => <li key={`${payment.date}-${index}`} className="flex justify-between gap-3"><span>{payment.date || 'Fecha anterior'} · {kindName[payment.type] || payment.type}</span><span className="tabular-nums">{money(payment.amount)}</span></li>)}</ul>}
              <p className="flex justify-between text-sm"><span className="text-emerald-700">Recibido {money(debt.received)}</span><span className="text-slate-600">Total {money(debt.total)}</span></p>
              {debt.collectionRows.length > 1 && <div className="flex flex-wrap gap-2" role="group" aria-label="Elegir cobro">
                {debt.collectionRows.map((item) => <button key={item.id} type="button" aria-pressed={item.id === rowId} onClick={() => setRowId(item.id)}
                  className={`rounded border px-3 py-1 text-xs font-medium ${item.id === rowId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700'}`}>{kindName[item.salePaymentType] || item.salePaymentType} · {money(Number(item.monto) - Number(item.saleReceivedAmount || 0))}</button>)}
              </div>}
              {row && <CobroVentaForm key={`${row.id}:${row.saleReceivedAmount}`} compact gasto={row} onCancel={() => setOpenId(null)} onSaved={(updated) => onCollected?.(updated)} />}
              {debt.adelantoId && <button type="button" onClick={() => onAdvance?.(debt.adelantoId)} className="min-h-[44px] rounded bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 focus-visible:ring-2">Registrar pago del adelanto</button>}
            </div>}
          </article>;
        })}
      </div>
    </div>
  </div>;
}
