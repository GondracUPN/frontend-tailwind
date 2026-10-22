import React, { useEffect, useState } from 'react';
import { finanzasApi, limpiarError } from '../../services/finanzas';
import { notifySalesChanged } from '../../utils/salesSync';
import { btnCls, btnPrimaryCls, ErrorBox, inputCls, money } from './ui';

export function CompletarCosto({ ventaId, onDone }) {
  const [open, setOpen] = useState(false); const [total, setTotal] = useState('');
  const [documento, setDocumento] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      await finanzasApi.completarCosto(ventaId, { costoTotal: Number(total), documento: documento.trim() });
      notifySalesChanged({ action: 'cost-completed', ventaId });
      setOpen(false); onDone?.();
    } catch (err) { setError(limpiarError(err)); }
    finally { setBusy(false); }
  };
  if (!open) return <button type="button" className={btnCls} onClick={() => setOpen(true)}>Completar costo</button>;
  return <form onSubmit={save} className="space-y-2 rounded-lg border p-3">
    <p className="text-xs">Costo total de las unidades vendidas en esta venta, antes de devoluciones. Se conservarán usuario, fecha y referencia.</p>
    <label className="block text-sm">Costo total (S/)<input aria-label={`Costo total de venta ${ventaId}`} className={inputCls} type="number" min="0" step="0.01" required value={total} onChange={(e) => setTotal(e.target.value)} /></label>
    <label className="block text-sm">Comprobante o referencia<input aria-label={`Referencia de costo ${ventaId}`} className={inputCls} required minLength="3" maxLength="1000" value={documento} onChange={(e) => setDocumento(e.target.value)} /></label>
    <ErrorBox error={error} />
    <button className={btnPrimaryCls} disabled={busy}>{busy ? 'Guardando…' : 'Confirmar costo'}</button>
    <button type="button" className={btnCls} disabled={busy} onClick={() => setOpen(false)}>Cancelar</button>
  </form>;
}

export default function CostosPendientes({ onClose, onSaved }) {
  const [rows, setRows] = useState(null); const [error, setError] = useState(''); const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    finanzasApi.costosPendientes().then((items) => active && setRows(items || [])).catch((err) => active && setError(limpiarError(err)));
    return () => { active = false; };
  }, [version]);
  return <div role="dialog" aria-modal="true" aria-label="Costos pendientes" className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-auto rounded-xl bg-white p-5">
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Costos pendientes</h2><button className={btnCls} onClick={onClose}>Cerrar</button></div>
      <ErrorBox error={error} />
      {rows == null ? <p>Cargando…</p> : rows.length === 0 ? <p>No hay costos pendientes.</p> : rows.map((v) => <article className="space-y-2 rounded-lg border p-3" key={v.id}>
        <p>Venta #{v.id} · {v.producto?.detalle?.descripcionOtro || v.producto?.tipo} · {v.cantidad || 1} unidades · {money(v.precioVenta)}</p>
        <CompletarCosto ventaId={v.id} onDone={() => { setVersion((x) => x + 1); onSaved?.(); }} />
      </article>)}
    </div>
  </div>;
}
