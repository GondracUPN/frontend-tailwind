import React from 'react';

const money = (amount) => `S/ ${Number(amount || 0).toFixed(2)}`;
const kindName = { advance: 'Adelanto', card: 'Tarjeta', debt: 'x500', direct: 'Directo', cash: 'Efectivo' };

export default function DExtraPanel({ debts, onClose, onCollect }) {
  const total = debts.reduce((sum, debt) => sum + Number(debt.pending || 0), 0);
  return <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="D.Extra">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div><h2 className="text-xl font-semibold">D.Extra</h2><p className="text-sm text-slate-600">Ingresos y adelantos pendientes de cobrar</p></div>
        <button type="button" onClick={onClose} className="rounded border px-3 py-1">Cerrar</button>
      </div>
      <div className="mt-4 rounded-xl bg-amber-50 p-4 text-amber-950"><span className="text-sm">Total por cobrar</span><strong className="block text-2xl">{money(total)}</strong></div>
      <div className="mt-4 space-y-3">
        {debts.length === 0 && <p className="rounded border p-4 text-sm text-slate-600">No hay saldos pendientes.</p>}
        {debts.map((debt) => <article key={debt.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{debt.title}</h3><p className="text-xs text-slate-500">Inicio: {debt.startedAt || '-'} · {debt.kinds.map((kind) => kindName[kind] || kind).join(' + ')}</p></div><strong>{money(debt.total)}</strong></div>
          <p className="mt-1 text-sm text-emerald-700">Recibido: {money(debt.received)}</p>
          <p className="text-sm font-semibold text-amber-800">Falta: {money(debt.pending)}</p>
          {debt.history.length > 0 && <ul className="mt-2 border-t pt-2 text-xs text-slate-600">{debt.history.map((payment, index) => <li key={`${payment.date}-${index}`}>{payment.date || 'Fecha anterior'} · {kindName[payment.type] || payment.type}: {money(payment.amount)}</li>)}</ul>}
          {debt.collectionRows.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{debt.collectionRows.map((row) => <button key={row.id} type="button" onClick={() => onCollect(row)} className="rounded border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800">Cobrar {kindName[row.salePaymentType] || row.salePaymentType}</button>)}</div>}
        </article>)}
      </div>
    </div>
  </div>;
}
