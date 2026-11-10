import React, { useState } from 'react';

const columnas = [['fecha', 'Fecha'], ['cliente', 'Cliente'], ['codigoProducto', 'Código'],
  ['producto', 'Producto'], ['estadoPedido', 'Estado'], ['montoVenta', 'Venta'],
  ['montoAdelanto', 'Adelanto'], ['saldo', 'Saldo']];
const numericas = new Set(['montoVenta', 'montoAdelanto', 'saldo']);
const codigo = row => row.codigoProducto || (row.productoId ? `MS-${row.productoId}` : '-');

export default function ProductosPedidoPendientes({ rows, loading, fmtDate, renderEstado, renderMoney }) {
  const [orden, setOrden] = useState({ campo: 'fecha', asc: false });
  const valor = row => orden.campo === 'codigoProducto' ? codigo(row)
    : orden.campo === 'estadoPedido' ? renderEstado(row).label : row[orden.campo];
  const pendientes = rows.filter(row => row.estadoPago !== 'pagado' && !row.tieneReembolso).sort((a, b) => {
    const diferencia = numericas.has(orden.campo) ? Number(valor(a) || 0) - Number(valor(b) || 0)
      : String(valor(a) || '').localeCompare(String(valor(b) || ''), 'es', { numeric: true });
    return (orden.asc ? 1 : -1) * diferencia;
  });
  return <div className="overflow-x-auto"><table className="min-w-full text-sm" aria-label="Productos pendientes de pedido">
    <thead><tr className="text-left text-gray-500 border-b">{columnas.map(([campo, label]) =>
      <th key={campo} className="py-2 pr-4" aria-sort={orden.campo === campo ? (orden.asc ? 'ascending' : 'descending') : 'none'}>
        <button type="button" className="whitespace-nowrap hover:text-gray-900" onClick={() => setOrden(actual => ({ campo, asc: actual.campo === campo ? !actual.asc : true }))}>
          {label}{orden.campo === campo ? (orden.asc ? ' ↑' : ' ↓') : ' ↕'}
        </button>
      </th>)}</tr></thead>
    <tbody>{pendientes.length ? pendientes.map(row => {
      const estado = renderEstado(row);
      return <tr key={row.id} className="border-b last:border-b-0">
        <td className="py-2 pr-4 whitespace-nowrap">{fmtDate(row.fecha)}</td>
        <td className="py-2 pr-4 font-medium">{row.cliente}</td>
        <td className="py-2 pr-4 whitespace-nowrap font-medium">{codigo(row)}</td>
        <td className="py-2 pr-4">{row.producto || '-'}</td>
        <td className="py-2 pr-4"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estado.cls}`}>{estado.label}</span></td>
        {['montoVenta', 'montoAdelanto', 'saldo'].map(campo => <td key={campo} className="py-2 pr-4">{renderMoney(row, campo)}</td>)}
      </tr>;
    }) : <tr><td className="py-3 text-gray-500" colSpan={8}>{loading ? 'Cargando productos pendientes...' : 'No hay productos en camino o faltos de pago en este rango.'}</td></tr>}</tbody>
  </table></div>;
}
