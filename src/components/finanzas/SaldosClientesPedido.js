import React, { useEffect, useState } from 'react';
import { finanzasApi, limpiarError, sesionFinanciera } from '../../services/finanzas';
import { SALES_UPDATED_EVENT } from '../../utils/salesSync';
import { ErrorBox, money } from './ui';

export default function SaldosClientesPedido({ revision, onComprar, onSelect, onLoaded, selectedId }) {
  const [clientes, setClientes] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const autorizado = sesionFinanciera().esAdmin;
  useEffect(() => {
    if (!autorizado) return;
    let activo = true;
    let solicitud = 0;
    const cargar = async () => {
      const actual = ++solicitud;
      setLoading(true);
      try {
        const lista = await finanzasApi.clientes();
        const externos = await Promise.all((lista || []).filter(c => c.clase === 'externo').map(async c => {
          const historia = await finanzasApi.saldosCliente(c.id);
          const deuda = (historia.ventas || []).filter(v => !v.anulada && !v.afectada)
            .reduce((n, v) => n + Math.round(Number(v.deudaConfirmada || 0) * 100), 0);
          return { ...c, disponible: c.admite_saldo ? historia.disponible : 0, deuda: deuda / 100, ventas: historia.ventas || [] };
        }));
        // Los adelantos todavía sin venta también dejan una diferencia por cobrar.
        const porNombre = new Map(externos.map(c => [c.nombre.trim().toLocaleLowerCase('es'), c]));
        for (const row of revision?.rows || []) {
          if (!row.adelantoId || row.ventaId || row.tieneReembolso || !(Number(row.saldo) > 0)) continue;
          const key = String(row.cliente || '').trim().toLocaleLowerCase('es');
          const c = porNombre.get(key) || { id: `pedido-${key}`, nombre: row.cliente, disponible: 0, deuda: 0 };
          c.deuda = (Math.round(c.deuda * 100) + Math.round(Number(row.saldo) * 100)) / 100;
          porNombre.set(key, c);
        }
        if (!activo || actual !== solicitud) return;
        const cuentas = [...porNombre.values()];
        onLoaded?.(cuentas);
        setClientes(onSelect ? cuentas : cuentas.filter(c => Number(c.disponible) > 0 || c.deuda > 0));
        setError('');
      } catch (e) { if (activo && actual === solicitud) setError(limpiarError(e)); }
      finally { if (activo && actual === solicitud) setLoading(false); }
    };
    cargar();
    window.addEventListener(SALES_UPDATED_EVENT, cargar);
    return () => { activo = false; window.removeEventListener(SALES_UPDATED_EVENT, cargar); };
  }, [autorizado, revision, onLoaded, onSelect]);
  if (!autorizado) return null;
  return <section className="rounded-xl border bg-white p-5 shadow-sm" aria-label="Saldo y deuda de clientes">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Saldo y deuda de clientes</h3>
        <p className="text-sm text-gray-500">Saldo a favor y deuda actuales, independientemente del rango de fechas del informe.</p></div>
      {onComprar && <button type="button" onClick={onComprar} className="rounded border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">Comprar en inventario</button>}
    </div>
    {loading ? <p className="mt-3 text-sm">Cargando saldos…</p> : error ? <ErrorBox error={error} /> : clientes.length ?
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{clientes.map(c => <li key={c.id} className="rounded-lg border p-3">
        {onSelect ? <button type="button" aria-pressed={selectedId === c.id} onClick={() => onSelect(c.id)} className="block text-left text-sm font-semibold text-indigo-700 underline">{c.nombre}</button> : <span className="block text-sm font-medium">{c.nombre}</span>}
        {!(Number(c.disponible) > 0) && !(c.deuda > 0) && <p className="text-gray-500 text-sm">Sin saldo ni deuda confirmada</p>}
        {Number(c.disponible) > 0 && <p className="text-emerald-800">Saldo a favor: <strong>{money(c.disponible)}</strong></p>}
        {c.deuda > 0 && <p className="text-red-700">Deuda: <strong>{money(c.deuda)}</strong></p>}
      </li>)}</ul> : <p className="mt-3 text-sm text-gray-500">No hay clientes con saldo a favor o deuda.</p>}
  </section>;
}
