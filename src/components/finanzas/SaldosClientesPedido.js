import React, { useEffect, useState } from 'react';
import { finanzasApi, limpiarError, sesionFinanciera } from '../../services/finanzas';
import { SALES_UPDATED_EVENT } from '../../utils/salesSync';
import { ErrorBox, money } from './ui';

export default function SaldosClientesPedido({ revision, onComprar }) {
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
        if (!activo || actual !== solicitud) return;
        setClientes((lista || []).filter(c => c.clase === 'externo' && c.admite_saldo && Number(c.disponible) > 0));
        setError('');
      } catch (e) { if (activo && actual === solicitud) setError(limpiarError(e)); }
      finally { if (activo && actual === solicitud) setLoading(false); }
    };
    cargar();
    window.addEventListener(SALES_UPDATED_EVENT, cargar);
    return () => { activo = false; window.removeEventListener(SALES_UPDATED_EVENT, cargar); };
  }, [autorizado, revision]);
  if (!autorizado) return null;
  return <section className="rounded-xl border bg-white p-5 shadow-sm" aria-label="Saldos a favor de clientes">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="font-semibold">Saldo a favor de clientes</h3>
        <p className="text-sm text-gray-500">Disponible actual para comprar equipos o accesorios, independientemente del rango de fechas del informe.</p></div>
      {onComprar && <button type="button" onClick={onComprar} className="rounded border px-3 py-2 text-sm text-indigo-700 hover:bg-indigo-50">Comprar en inventario</button>}
    </div>
    {loading ? <p className="mt-3 text-sm">Cargando saldos…</p> : error ? <ErrorBox error={error} /> : clientes.length ?
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{clientes.map(c => <li key={c.id} className="rounded-lg bg-emerald-50 p-3 text-emerald-900">
        <span className="block text-sm">{c.nombre}</span><strong>{money(c.disponible)}</strong>
      </li>)}</ul> : <p className="mt-3 text-sm text-gray-500">No hay saldo a favor disponible.</p>}
  </section>;
}
