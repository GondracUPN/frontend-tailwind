import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SaldosClientesPedido from '../components/finanzas/SaldosClientesPedido';
import ProductosPedidoPendientes from '../components/finanzas/ProductosPedidoPendientes';
import { money } from '../components/finanzas/ui';
import { getPedidoSalesSummary, invalidateAnalyticsCache } from '../services/analytics';

const fecha = value => {
  const dia = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia.split('-').reverse().join('/') : '-';
};

export default function VentasPedido({ setVista }) {
  const [revision, setRevision] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const solicitud = useRef({ version: 0 });
  const cargar = useCallback(async () => {
    const actual = ++solicitud.current.version;
    setLoading(true);
    try {
      invalidateAnalyticsCache();
      const data = await getPedidoSalesSummary();
      if (actual !== solicitud.current.version) return;
      setRevision(data);
      setError('');
    } catch (e) { if (actual === solicitud.current.version) setError(e.message || 'No se pudieron cargar los pedidos.'); }
    finally { if (actual === solicitud.current.version) setLoading(false); }
  }, []);
  useEffect(() => {
    const control = solicitud.current;
    cargar();
    const activar = event => { if (event.detail?.view === 'ventasPedido') cargar(); };
    window.addEventListener('ventas-updated', cargar);
    window.addEventListener('productos-updated', cargar);
    window.addEventListener('app-view-activated', activar);
    return () => {
      control.version++;
      window.removeEventListener('ventas-updated', cargar);
      window.removeEventListener('productos-updated', cargar);
      window.removeEventListener('app-view-activated', activar);
    };
  }, [cargar]);
  const cliente = clientes.find(c => c.id === selected) || clientes[0];
  const rows = useMemo(() => (revision?.rows || []).filter(row => row.cliente === cliente?.nombre), [revision, cliente?.nombre]);
  const ventas = (cliente?.ventas || []).filter(v => !v.anulada && !v.afectada).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
  const renderEstado = row => ({ label: row.estadoPago === 'adelanto' ? 'Con adelanto' : 'Sin venta registrada', cls: 'bg-amber-100 text-amber-800' });
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
    <header className="flex items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Ventas a pedido</h1><p className="text-sm text-gray-500">Selecciona un cliente para consultar sus ventas y lo que falta cobrar.</p></div>
      <button type="button" disabled={loading} onClick={cargar} className="rounded border bg-white px-3 py-2 text-sm">{loading ? 'Actualizando…' : 'Actualizar'}</button>
    </header>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-red-700">{error}</p>}
    {revision && <SaldosClientesPedido revision={revision} onComprar={setVista ? () => setVista('inventario') : undefined}
      onLoaded={setClientes} onSelect={setSelected} selectedId={cliente?.id} />}
    {cliente && <>
      <section className="rounded-xl border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Ventas de {cliente.nombre}</h2>
          <p className="font-semibold text-red-700">Por cobrar: {money(cliente.deuda)}</p>
        </div>
        <div className="overflow-x-auto"><table className="min-w-full text-sm" aria-label={`Ventas de ${cliente.nombre}`}>
          <thead><tr className="border-b text-left text-gray-500">{['Fecha', 'Código', 'Producto', 'Venta', 'Pagado', 'Por cobrar', 'Estado del pago'].map(c => <th key={c} className="py-2 pr-4">{c}</th>)}</tr></thead>
          <tbody>{ventas.length ? ventas.map(v => {
            const producto = rows.find(row => row.ventaId === v.ventaId);
            return <tr key={v.ventaId} className="border-b last:border-0">
              <td className="py-2 pr-4 whitespace-nowrap">{fecha(v.fecha)}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{producto?.codigoProducto || `MS-${v.sku}`}</td>
              <td className="py-2 pr-4">{producto?.producto || v.producto || '-'}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{money(v.precioVenta)}</td>
              <td className="py-2 pr-4 whitespace-nowrap">{money(v.pagado)}</td>
              <td className="py-2 pr-4 whitespace-nowrap font-medium">{v.pendienteConciliacion ? '-' : money(v.deudaConfirmada)}</td>
              <td className="py-2 pr-4">{v.pendienteConciliacion ? 'Pago por confirmar' : Number(v.deudaConfirmada) > 0 ? 'Pendiente' : 'Pagado'}</td>
            </tr>;
          }) : <tr><td colSpan={7} className="py-3 text-gray-500">Este cliente no tiene ventas activas.</td></tr>}</tbody>
        </table></div>
        {ventas.some(v => v.pendienteConciliacion) && <p className="mt-3 text-sm text-gray-500">Las ventas antiguas sin un pago confirmado se muestran para revisión y no se suman a la deuda.</p>}
      </section>
      <section className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="mb-3 text-lg font-semibold">Productos en camino y adelantos de {cliente.nombre}</h2>
        <ProductosPedidoPendientes rows={rows.filter(row => !row.ventaId)} loading={loading} fmtDate={fecha} renderEstado={renderEstado}
          renderMoney={(row, campo) => row.estadoPago === 'sin_pago' ? '-' : money(row[campo])} />
      </section>
    </>}
  </div></main>;
}
