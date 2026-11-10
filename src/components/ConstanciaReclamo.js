import React, { useEffect, useState } from 'react';
import api from '../api';
import { formatDisplayMoney as money } from './ui/VisualUI';
import ReembolsosProducto from './finanzas/ReembolsosProducto';

const fecha = value => value ? String(value).slice(0, 10) : 'Sin fecha';

export default function ConstanciaReclamo({ producto, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let activo = true;
    setData(null);
    setError('');
    api.get(`/ventas/producto/${producto.id}/constancia`).then(result => {
      if (activo) setData(result);
    }).catch(e => { if (activo) setError(e.message); });
    return () => { activo = false; };
  }, [producto.id]);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section role="dialog" aria-modal="true" aria-label="Constancia de venta y pagos" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Constancia de venta y pagos · MS-{producto.codigoInventario || producto.id}</h2>
        <button type="button" className="ux-button" onClick={onClose}>Cerrar</button>
      </div>
      <p className="text-sm text-slate-600">La venta y sus pagos se conservan aunque el producto tenga un reclamo. El saldo del cliente es independiente del reembolso de la compra.</p>
      {error && <p role="alert">{error}</p>}
      {!data && !error && <p role="status">Cargando constancia…</p>}
      {data?.ventas?.length === 0 && <p>No hay ventas registradas para este producto.</p>}
      {(data?.ventas || []).map(v => <article key={v.id} className="rounded-lg border border-slate-200 p-4 space-y-2">
        <h3 className="font-semibold">Venta #{v.id} · {v.vendedor || 'Sin comprador registrado'}</h3>
        <p>Fecha de venta: {fecha(v.fechaVenta)}</p>
        <p>Precio de venta: <strong>{money(v.precioVenta)}</strong></p>
        <p>Pagado por el comprador: <strong>{money(v.pagado)}</strong></p>
        <p>Convertido en saldo a favor: <strong>{money(v.saldoGenerado)}</strong> · Disponible: {money(v.saldoDisponible)}</p>
        {v.estadoComercial === 'cancelada' && <p className="text-sm text-amber-800">Venta cerrada; constancia y cobros conservados.</p>}
        {v.pagos.length ? <table className="w-full text-sm text-left">
          <thead><tr><th>Fecha de pago</th><th>Importe pagado</th><th>Estado</th><th>Devuelto en dinero</th></tr></thead>
          <tbody>{v.pagos.map(p => <tr key={p.id}>
            <td>{fecha(p.fecha)}</td><td>{money(p.monto)}</td>
            <td>{p.anulado ? 'Anulado' : p.verificado ? 'Confirmado' : 'Pendiente de conciliar'}</td><td>{money(p.devuelto)}</td>
          </tr>)}</tbody>
        </table> : <p>Sin pagos registrados.</p>}
      </article>)}
      <ReembolsosProducto producto={producto} onChanged={onChanged} />
    </section>
  </div>;
}
