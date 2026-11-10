import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SaldosClientesPedido from '../components/finanzas/SaldosClientesPedido';
import ProductosPedidoPendientes from '../components/finanzas/ProductosPedidoPendientes';
import { money } from '../components/finanzas/ui';
import { getPedidoSalesSummary, invalidateAnalyticsCache } from '../services/analytics';

const fecha = value => {
  const dia = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) ? dia.split('-').reverse().join('/') : '-';
};


const Currency = ({v}) => <>{money(v)}</>;
const Percent = ({v}) => <>{Number(v || 0).toFixed(2)}%</>;
const fmtDate = fecha;
const fmtSolesLocal = money;
function Card({title,value,sub}) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-sm text-gray-500">{title}</div><div className="text-2xl font-semibold mt-1">{value}</div><div className="text-xs text-gray-500 mt-1">{sub}</div></div>; }

export default function VentasPedido({ setVista }) {
  const [revision, setRevision] = useState(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
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
  const pedidoData = revision, pedidoLoading = loading, pedidoError = error, loadPedido = cargar;
 const pedidoResumen = useMemo(() => {
 const rowsAll = Array.isArray(pedidoData?.rows) ? pedidoData.rows : [];
 const inRange = (row) => {
 const fecha = String(row?.fecha || '').slice(0, 10);
 if (!fecha) return true;
 if (fromDate && fecha < fromDate) return false;
 if (toDate && fecha > toDate) return false;
 return true;
 };
 const rows = rowsAll.filter(inRange);
 const totals = {
 productos: 0,
 pagados: 0,
 pendientes: 0,
 ventaTotal: 0,
 adelantos: 0,
 saldo: 0,
 costo: 0,
 ganancia: 0,
 utilidadPct: 0,
 markupPct: 0,
 };
 const byClient = new Map();
 rows.forEach((row) => {
 const cliente = row.cliente || 'Sin cliente';
 const current = byClient.get(cliente) || {
 cliente,
 productos: 0,
 pagados: 0,
 pendientes: 0,
 ventaTotal: 0,
 adelantos: 0,
 saldo: 0,
 costo: 0,
 ganancia: 0,
 utilidadPct: 0,
 markupPct: 0,
 };
 const add = (target) => {
 target.productos += 1;
 target.pagados += row.estadoPago === 'pagado' ? 1 : 0;
 target.pendientes += row.estadoPago === 'pagado' ? 0 : 1;
 target.ventaTotal += Number(row.montoVenta || 0);
 target.adelantos += Number(row.montoAdelanto || 0);
 target.saldo += Number(row.saldo || 0);
 target.costo += Number(row.costo || 0);
 target.ganancia += Number(row.ganancia || 0);
 };
 add(current);
 add(totals);
 byClient.set(cliente, current);
 });
 const finalize = (item) => {
 const ventaTotal = Number(item.ventaTotal || 0);
 const costo = Number(item.costo || 0);
 const ganancia = Number(item.ganancia || 0);
 return {
 ...item,
 ventaTotal,
 costo,
 ganancia,
 utilidadPct: ventaTotal ? (ganancia / ventaTotal) * 100 : 0,
 markupPct: costo ? (ganancia / costo) * 100 : 0,
 };
 };
 return {
 totals: finalize(totals),
 clients: Array.from(byClient.values()).map(finalize).sort((a, b) => b.ventaTotal - a.ventaTotal),
 rows,
 };
 }, [fromDate, toDate, pedidoData]);
 const pedidoVendidosRows = useMemo(
 () => (pedidoResumen.rows || []).filter((row) => row.estadoPago === 'pagado'),
 [pedidoResumen.rows],
 );
 const pedidoCaminoRows = useMemo(
 () => (pedidoResumen.rows || []).filter((row) => row.estadoPago !== 'pagado'),
 [pedidoResumen.rows],
 );
 const renderPedidoMoney = (row, field) =>
 row.estadoPago === 'sin_pago' && !row.ventaId ? '-' : <Currency v={row?.[field]} />;
 const renderPedidoEstado = (row) => {
 const estado = row?.estadoPedido || row?.estadoPago;
 if (estado === 'cancelado_entregado') return { label: 'Cancelado y entregado', cls: 'bg-emerald-100 text-emerald-700' };
 if (estado === 'cancelado_en_camino') return { label: 'Cancelado en camino', cls: 'bg-sky-100 text-sky-700' };
 if (estado === 'recogido_sin_pago') return { label: 'Recogido sin pago', cls: 'bg-red-100 text-red-700' };
 if (estado === 'recogido_con_adelanto') return { label: 'Recogido con adelanto', cls: 'bg-orange-100 text-orange-700' };
 if (estado === 'en_camino_con_adelanto') return { label: 'En camino con adelanto', cls: 'bg-amber-100 text-amber-700' };
 if (estado === 'en_camino_sin_pago') return { label: 'En camino sin pago', cls: 'bg-yellow-100 text-yellow-700' };
 if (row.estadoPago === 'pagado') return { label: 'Cancelado', cls: 'bg-emerald-100 text-emerald-700' };
 if (row.estadoPago === 'adelanto') return { label: 'Con adelanto', cls: 'bg-amber-100 text-amber-700' };
 return { label: 'Sin pago', cls: 'bg-red-100 text-red-700' };
 };







 return <main className="min-h-screen bg-gray-50 p-4 sm:p-6"><div className="mx-auto max-w-7xl">
<div className="mb-4 flex flex-wrap gap-3"><label className="text-sm">Desde<input type="date" className="ml-2 rounded border p-2" value={fromDate} onChange={e=>setFromDate(e.target.value)} /></label><label className="text-sm">Hasta<input type="date" className="ml-2 rounded border p-2" value={toDate} onChange={e=>setToDate(e.target.value)} /></label></div>
 <div className="space-y-6 mb-8">
 <SaldosClientesPedido revision={pedidoData} onComprar={setVista ? () => setVista('inventario') : undefined} />
 <div className="bg-white rounded-xl border shadow-sm p-5">
 <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
 <div>
 <h2 className="text-lg font-semibold">Ventas a pedido</h2>
 <div className="text-sm text-gray-500">Solo ventas y adelantos con vendedor tipo Gonzalo (Cliente).</div>
 </div>
 <button
 className="px-3 py-1.5 rounded border text-sm bg-white hover:bg-gray-50 disabled:opacity-60"
 onClick={loadPedido}
 disabled={pedidoLoading}
 >
 {pedidoLoading ? 'Actualizando...' : 'Actualizar'}
 </button>
 </div>

 {pedidoError ? <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{pedidoError}</div> : null}

 <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
 <Card
 title="Productos"
 value={pedidoResumen.totals.productos}
 sub={`${pedidoResumen.totals.pagados} cancelados - ${pedidoResumen.totals.pendientes} pendientes`}
 />
 <Card
 title="Vendido"
 value={<Currency v={pedidoResumen.totals.ventaTotal} />}
 sub={`Adelantos: ${fmtSolesLocal(pedidoResumen.totals.adelantos)} - Saldo: ${fmtSolesLocal(pedidoResumen.totals.saldo)}`}
 />
 <Card
 title="Ganancia"
 value={<Currency v={pedidoResumen.totals.ganancia} />}
 sub={`Utilidad: ${pedidoResumen.totals.utilidadPct.toFixed(2)}%`}
 />
 <Card
 title="Markup"
 value={<Percent v={pedidoResumen.totals.markupPct} />}
 sub={`Costo: ${fmtSolesLocal(pedidoResumen.totals.costo)}`}
 />
 </div>
 </div>

 <div className="bg-white rounded-xl border shadow-sm p-5">
 <h3 className="text-base font-semibold mb-3">Clientes</h3>
 <div className="overflow-x-auto">
 <table className="min-w-full text-sm">
 <thead>
 <tr className="text-left text-gray-500 border-b">
 <th className="py-2 pr-4">Cliente</th>
 <th className="py-2 pr-4">Productos</th>
 <th className="py-2 pr-4">Vendido</th>
 <th className="py-2 pr-4">Adelantos</th>
 <th className="py-2 pr-4">Saldo</th>
 <th className="py-2 pr-4">Ganancia</th>
 <th className="py-2 pr-4">Utilidad</th>
 <th className="py-2 pr-4">Markup</th>
 </tr>
 </thead>
 <tbody>
 {pedidoResumen.clients.length ? pedidoResumen.clients.map((client) => (
 <tr key={client.cliente} className="border-b last:border-b-0">
 <td className="py-2 pr-4 font-medium">{client.cliente}</td>
 <td className="py-2 pr-4">{client.productos} <span className="text-xs text-gray-500">({client.pagados} pagados, {client.pendientes} pendientes)</span></td>
 <td className="py-2 pr-4"><Currency v={client.ventaTotal} /></td>
 <td className="py-2 pr-4"><Currency v={client.adelantos} /></td>
 <td className="py-2 pr-4"><Currency v={client.saldo} /></td>
 <td className="py-2 pr-4"><Currency v={client.ganancia} /></td>
 <td className="py-2 pr-4"><Percent v={client.utilidadPct} /></td>
 <td className="py-2 pr-4"><Percent v={client.markupPct} /></td>
 </tr>
 )) : (
 <tr>
 <td className="py-3 text-gray-500" colSpan={8}>{pedidoLoading ? 'Cargando ventas a pedido...' : 'No hay ventas a pedido en este rango.'}</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>

 <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
 <div className="bg-white rounded-xl border shadow-sm p-5">
 <h3 className="text-base font-semibold mb-3">Productos en camino y faltos de pago</h3>
 <ProductosPedidoPendientes rows={pedidoCaminoRows} loading={pedidoLoading} fmtDate={fmtDate} renderEstado={renderPedidoEstado} renderMoney={renderPedidoMoney} />
 </div>

 <div className="bg-white rounded-xl border shadow-sm p-5">
 <h3 className="text-base font-semibold mb-3">Productos cancelados y entregados</h3>
 <div className="overflow-x-auto">
 <table className="min-w-full text-sm">
 <thead>
 <tr className="text-left text-gray-500 border-b">
 <th className="py-2 pr-4">Fecha</th>
 <th className="py-2 pr-4">Cliente</th>
 <th className="py-2 pr-4">Producto</th>
 <th className="py-2 pr-4">Estado</th>
 <th className="py-2 pr-4">Venta</th>
 <th className="py-2 pr-4">Adelanto</th>
 <th className="py-2 pr-4">Saldo</th>
 <th className="py-2 pr-4">Ganancia</th>
 <th className="py-2 pr-4">Porcentaje</th>
 </tr>
 </thead>
 <tbody>
 {pedidoVendidosRows.length ? pedidoVendidosRows.map((row) => {
 const estado = renderPedidoEstado(row);
 return (
 <tr key={row.id} className="border-b last:border-b-0">
 <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(row.fecha)}</td>
 <td className="py-2 pr-4 font-medium">{row.cliente}</td>
 <td className="py-2 pr-4">{row.producto || '-'}</td>
 <td className="py-2 pr-4">
 <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estado.cls}`}>
 {estado.label}
 </span>
 </td>
 <td className="py-2 pr-4"><Currency v={row.montoVenta} /></td>
 <td className="py-2 pr-4"><Currency v={row.montoAdelanto} /></td>
 <td className="py-2 pr-4"><Currency v={row.saldo} /></td>
 <td className="py-2 pr-4"><Currency v={row.ganancia} /></td>
 <td className="py-2 pr-4"><Percent v={row.markupPct} /></td>
 </tr>
 );
 }) : (
 <tr>
 <td className="py-3 text-gray-500" colSpan={9}>{pedidoLoading ? 'Cargando vendidos...' : 'No hay productos vendidos y entregados en este rango.'}</td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
</div></main>;
}
