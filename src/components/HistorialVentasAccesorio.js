import { useEffect, useState } from 'react';
import api from '../api';
import AnularVentaButton from './AnularVentaButton';

export const importeVentaAccesorio = (value) => value == null ? 'Pendiente' : `S/ ${Number(value).toFixed(2)}`;

export default function HistorialVentasAccesorio({ producto, onAnulada, mostrarTipoCambio = true }) {
  const [resultado, setResultado] = useState(null);
  const productoId = producto.id;
  useEffect(() => {
    let activo = true;
    Promise.resolve(api.get(`/ventas/accesorio-resumen?productoId=${productoId}`))
      .then((resumen) => { if (activo) setResultado({ productoId, resumen }); })
      .catch(() => { if (activo) setResultado({ productoId, error: true }); });
    return () => { activo = false; };
  }, [productoId]);

  const cargado = resultado?.productoId === productoId;
  const resumen = cargado ? resultado.resumen : null;
  const money = importeVentaAccesorio;
  return (
    <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Resumen de ventas del accesorio">
      <h3 className="font-semibold text-slate-950">Ventas del accesorio</h3>
      {!cargado && <p className="mt-3 text-sm text-slate-500">Cargando resumen...</p>}
      {cargado && resultado.error && <p role="alert" className="mt-3 text-sm text-red-700">No se pudo cargar el historial de ventas.</p>}
      {resumen && <>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Unidades vendidas</span><strong>{resumen.unidadesVendidas || 0}</strong></div>
          <div className="rounded-lg bg-white p-3"><span className="block text-xs text-slate-500">Disponibles</span><strong>{resumen.unidadesDisponibles ?? producto.stockActual ?? 0}</strong></div>
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800"><span className="block text-xs">Ingreso total</span><strong className="text-lg">{money(resumen.ventaBruta)}</strong></div>
          <div className="rounded-lg bg-indigo-50 p-3 text-indigo-800"><span className="block text-xs">Ganancia general</span><strong className="text-lg">{money(resumen.gananciaNeta)}</strong></div>
        </div>
        {mostrarTipoCambio && resumen.tipoCambioPromedio != null && <p className="mt-3 text-xs text-slate-600">Tipo de cambio promedio <strong>{Number(resumen.tipoCambioPromedio).toFixed(4)}</strong></p>}
        <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
          {(resumen.ventas || []).map((item) => (
            <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
              <div className="flex justify-between gap-2"><strong>{item.fechaVenta}</strong><span>{item.cantidad} und.</span></div>
              {item.equipoId && <p className="mt-1 font-medium">Incluido en equipo MS-{item.equipoId}</p>}
              {onAnulada && !item.equipoId && <div className="mt-1 flex justify-end"><AnularVentaButton venta={{ ...item, productoId }} onAnulada={onAnulada}
                className="rounded border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-60" /></div>}
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                <span>Cada uno <strong>{money(item.precioUnitario)}</strong></span>
                <span className="text-right">Total <strong>{money(item.ventaBruta)}</strong></span>
                <span>Costo <strong>{money(item.costo)}</strong></span>
                <span className="text-right text-emerald-700">Ganancia <strong>{money(item.gananciaNeta)}</strong></span>
              </div>
            </div>
          ))}
          {!resumen.ventas?.length && <p className="text-sm text-slate-500">Sin ventas registradas.</p>}
        </div>
      </>}
    </aside>
  );
}
