import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import '../analytics/chartSetup';
import {
  CLASIFICACIONES_GASTO, esErrorDePermiso, finanzasApi, limpiarError, METODOS_PAGO, nuevaClave, sesionFinanciera,
} from '../../services/finanzas';
import {
  AvisoSesion, btnCls, btnPrimaryCls, Campo, Cifra, ErrorBox, Estado, fecha, hoy, inputCls, money, Seccion, Vacio,
} from './ui';
import PagosVenta from './PagosVenta';
import PanelVentaCuotas from '../ventas/PanelVentaCuotas';
import VentaRapidaModal from './VentaRapidaModal';
import CostosPendientes from './CostosPendientes';

const TABS = [
  ['resumen', 'Resumen'],
  ['rentabilidad', 'Rentabilidad'],
  ['cobros', 'Cobros'],
  ['flujo', 'Flujo de caja'],
  ['capital', 'Capital inmovilizado'],
  ['conciliacion', 'Conciliación'],
  ['cuentas', 'Cuentas'],
];
const CATEGORIAS = [['', 'Todas'], ['macbook', 'MacBook'], ['iphone', 'iPhone'], ['ipad', 'iPad'], ['watch', 'Apple Watch'], ['airpods', 'AirPods'], ['imac', 'iMac'], ['macmini', 'Mac mini'], ['accesorios', 'Accesorios'], ['otro', 'Otros']];
const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.filter(([v]) => v));
const FLUJO_LABEL = {
  cobro_cliente: 'Cobros de clientes', liquidacion: 'Liquidaciones de pasarelas', devolucion_cliente: 'Devoluciones a clientes',
  contracargo: 'Contracargos', reembolso_recibido: 'Reembolsos recuperados', compra: 'Compras de inventario', gasto: 'Gastos',
  pago_tarjeta: 'Pagos de tarjetas', otros_ingresos: 'Otros ingresos', ajuste: 'Ajustes',
};
const CLASIF_LABEL = Object.fromEntries(CLASIFICACIONES_GASTO);
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const nombreMes = (clave) => { const [y, m] = String(clave).split('-'); return m ? `${MESES[Number(m) - 1]} ${y}` : clave; };

const rangoMes = (offset = 0) => {
  const [y, m] = hoy().split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const ym = d.toISOString().slice(0, 7);
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
};

function Tabla({ columnas, filas, onRow, vacio = 'Sin registros.', maxH = 'max-h-[28rem]' }) {
  if (!filas?.length) return <Vacio>{vacio}</Vacio>;
  return (
    <div className={`${maxH} overflow-auto rounded-lg border border-slate-200`}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="sticky top-0 z-[1] bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{columnas.map(([k, l, num]) => <th key={k} className={`px-3 py-2 font-medium ${num ? 'text-right' : ''}`}>{l}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filas.map((fila, i) => (
            <tr key={fila.ventaId || fila.pagoId || fila.id || fila.clave || i} onClick={onRow ? () => onRow(fila) : undefined}
              className={onRow ? 'cursor-pointer hover:bg-slate-50' : ''}>
              {columnas.map(([k, , num, render]) => (
                <td key={k} className={`px-3 py-1.5 ${num ? 'text-right tabular-nums' : ''}`}>{render ? render(fila) : (num ? money(fila[k]) : fila[k] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const colsVentas = [
  ['nombre', 'Venta', false, (v) => <span className="font-medium text-slate-900">{v.nombre}</span>],
  ['fecha', 'Fecha comercial', false, (v) => fecha(v.fecha)],
  ['precio', 'Precio', true],
  ['cobrado', 'Cobrado', true],
  ['saldo', 'Saldo', true, (v) => <span className={v.saldo > 0 ? 'text-red-700' : ''}>{money(v.saldo)}</span>],
  ['ganancia', 'Ganancia', true, (v) => (v.ganancia == null ? <Estado value="pendiente" label="Costo pendiente" /> : money(v.ganancia))],
  ['gananciaFinal', 'Final', true, (v) => (v.gananciaFinal == null ? '—' : money(v.gananciaFinal))],
  ['estadoCobro', 'Cobro', false, (v) => <span className="flex gap-1"><Estado value={v.estadoCobro} />{v.estadoLiquidacion !== 'no_requiere' && <Estado value={v.estadoLiquidacion} />}</span>],
];

function DetalleVentaModal({ ventaId, onClose, onChanged, onOpenReserva }) {
  return (
    <div className="fixed inset-0 z-[115] flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={`Venta ${ventaId}`}>
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-3xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Venta #{ventaId}</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full px-2 text-2xl leading-none text-slate-500 hover:bg-slate-100">×</button>
        </div>
        <PagosVenta ventaId={ventaId} onChanged={onChanged} onOpenReserva={onOpenReserva} />
      </div>
    </div>
  );
}

function Resumen({ data, abrirTab }) {
  const r = data.resumen;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Seccion title="Ganancia comercial" subtitle="Ventas reconocidas por fecha de entrega.">
          <div className="grid grid-cols-2 gap-2">
            <Cifra label="Ventas" value={r.ventas} />
            <Cifra label="Ingresos comerciales" value={money(r.ingresosComerciales)} />
            <Cifra label="Ganancia comercial" value={money(r.gananciaComercial)} tone="good" onClick={() => abrirTab('rentabilidad')}
              extra={r.ventasSinCosto ? `${r.ventasSinCosto} con costo pendiente` : null} />
            <Cifra label="Ganancia final ventas" value={money(data.rentabilidad.totales.gananciaFinalVentas)} hint="Tras comisiones, costos vinculados y devoluciones." />
          </div>
        </Seccion>
        <Seccion title="Margen cobrado" subtitle="Parte de la utilidad respaldada por dinero ya disponible (gerencial).">
          <div className="grid grid-cols-2 gap-2">
            <Cifra label="Margen liberado en el periodo" value={money(r.margenCobrado)} tone="good" onClick={() => abrirTab('cobros')}
              extra={r.margenCobradoNoVerificado ? `+ ${money(r.margenCobradoNoVerificado)} sin verificar` : null} />
            <Cifra label="De ventas de meses anteriores" value={money(data.cobros.cobrosVentasAnteriores.margen)} extra={`${data.cobros.cobrosVentasAnteriores.ventas} ventas`} />
          </div>
        </Seccion>
        <Seccion title="Flujo de caja" subtitle="Dinero real en cuentas propias disponibles.">
          <div className="grid grid-cols-2 gap-2">
            <Cifra label="Entradas" value={money(r.cajaEntradas)} onClick={() => abrirTab('flujo')} />
            <Cifra label="Salidas" value={money(r.cajaSalidas)} onClick={() => abrirTab('flujo')} />
            <Cifra label="Flujo neto" value={money(r.flujoNeto)} tone={r.flujoNeto < 0 ? 'bad' : 'good'} />
            <Cifra label="Transferencias internas" value={money(r.transferenciasInternas)} hint="No son ingresos ni gastos." />
          </div>
        </Seccion>
      </div>
      <p className="text-xs text-slate-500">Estos tres indicadores miden cosas distintas y no deben sumarse entre sí.</p>
      <Seccion title="Saldos al cierre del periodo" subtitle="Dinero pendiente de recuperar. Cada importe se cuenta en una sola categoría.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <Cifra label="Por cobrar a clientes" value={money(r.porCobrar)} onClick={() => abrirTab('cobros')} />
          <Cifra label="Retenido por intermediarios" value={money(r.retenidoIntermediarios)} onClick={() => abrirTab('cobros')} />
          <Cifra label="Reembolsos por recuperar" value={money(r.reembolsosPendientes)} onClick={() => abrirTab('capital')} />
          <Cifra label="Capital inmovilizado" value={money(r.capitalInmovilizado)} onClick={() => abrirTab('capital')} />
          <Cifra label="Ventas por conciliar" value={r.historicosPendientes.ventas} extra={money(r.historicosPendientes.precio)} onClick={() => abrirTab('conciliacion')} />
        </div>
      </Seccion>
      <Seccion title="Por mes de entrega">
        <Tabla filas={data.rentabilidad.porMes} vacio="Sin ventas en el periodo." columnas={[
          ['clave', 'Mes', false, (m) => nombreMes(m.clave)], ['ventas', 'Ventas', false], ['ingresos', 'Ingresos', true],
          ['ganancia', 'Ganancia comercial', true], ['comisiones', 'Comisiones', true], ['gananciaFinal', 'Ganancia final', true],
          ['margen', 'Margen', false, (m) => (m.margen == null ? '—' : `${m.margen}%`)],
        ]} />
      </Seccion>
    </div>
  );
}

function Rentabilidad({ data, abrirVenta }) {
  const t = data.rentabilidad.totales;
  const filasResultado = [
    ['Ingresos por ventas', t.ingresos], ['Ganancia comercial', t.gananciaComercial], ['− Comisiones', t.comisiones],
    ['− Costos directos vinculados', t.costosDirectos], ['= Ganancia final de ventas', t.gananciaFinalVentas],
    ['− Gastos operativos', t.gastosOperativos], ['− Gastos financieros', t.gastosFinancieros], ['− Pérdidas', t.perdidas],
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Seccion title="Resultado estimado del periodo">
          <dl className="divide-y divide-slate-100 text-sm">
            {filasResultado.map(([l, v]) => <div key={l} className="flex justify-between py-1.5"><dt className="text-slate-600">{l}</dt><dd className="tabular-nums">{money(v)}</dd></div>)}
            <div className="flex justify-between py-2 font-semibold"><dt>Ganancia neta estimada</dt><dd className="tabular-nums">{t.gananciaNetaEstimada == null ? <span title={`Parcial: ${money(t.gananciaNetaParcial)}`}>Pendiente</span> : money(t.gananciaNetaEstimada)}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">Margen sobre ventas: {t.margen == null ? '—' : `${t.margen}%`}. Las compras de inventario no son gasto del periodo.</p>
          {data.rentabilidad.gastosSinClasificar.cantidad > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{data.rentabilidad.gastosSinClasificar.cantidad} gastos ({money(data.rentabilidad.gastosSinClasificar.monto)}) sin clasificar no se incluyen. Clasifícalos en Conciliación.</p>
          )}
        </Seccion>
        <Seccion title="Por categoría">
          <Tabla filas={data.rentabilidad.porCategoria} vacio="Sin ventas." columnas={[
            ['clave', 'Categoría', false, (c) => CATEGORIA_LABEL[c.clave] || c.clave], ['ventas', 'Ventas', false], ['ingresos', 'Ingresos', true],
            ['ganancia', 'Ganancia', true], ['comisiones', 'Comisiones', true], ['gananciaFinal', 'Final', true],
            ['margen', 'Margen', false, (c) => (c.margen == null ? '—' : `${c.margen}%`)],
          ]} />
        </Seccion>
      </div>
      <Seccion title="Utilidad por venta" subtitle="Ordenadas por ganancia final. Toca una fila para ver sus pagos.">
        <Tabla filas={data.rentabilidad.porProducto} columnas={colsVentas} onRow={(v) => abrirVenta(v.ventaId)} vacio="Sin ventas en el periodo." />
      </Seccion>
      <Seccion title="Gastos por clasificación">
        <Tabla filas={Object.entries(data.rentabilidad.gastosPorClasificacion).map(([k, v]) => ({ clave: k, ...v }))} vacio="No hay gastos clasificados en el periodo." columnas={[
          ['clave', 'Clasificación', false, (g) => CLASIF_LABEL[g.clave] || g.clave], ['cantidad', 'Registros', false], ['monto', 'Importe', true],
        ]} maxH="" />
      </Seccion>
    </div>
  );
}

function Cobros({ data, abrirVenta, abrirReserva }) {
  const c = data.cobros;
  const grupos = [['pagadas', 'Cobradas', 'pagado'], ['parciales', 'Parciales', 'parcialmente_pagado'], ['pendientes', 'Pendientes', 'pendiente'], ['disputadas', 'En disputa', 'disputado'], ['conciliacionPendiente', 'Por conciliar', 'conciliacion_pendiente']];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {grupos.map(([k, l]) => <Cifra key={k} label={l} value={c[k].cantidad} extra={k === 'pagadas' ? money(c[k].cobrado) : `Saldo ${money(c[k].saldo)}`} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion title="Antigüedad de saldos por cobrar" subtitle="Días desde la fecha comercial.">
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(c.antiguedad).map(([k, v]) => <Cifra key={k} label={`${k} días`} value={money(v.monto)} extra={`${v.cantidad} ventas`} tone={k === '90+' && v.monto > 0 ? 'bad' : undefined} />)}
          </div>
        </Seccion>
        <Seccion title="Cobros de ventas de meses anteriores" subtitle="Dinero recibido en el periodo por ventas entregadas antes.">
          <div className="grid grid-cols-3 gap-2">
            <Cifra label="Cobrado" value={money(c.cobrosVentasAnteriores.monto)} />
            <Cifra label="Margen liberado" value={money(c.cobrosVentasAnteriores.margen)} />
            <Cifra label="Ventas" value={c.cobrosVentasAnteriores.ventas} />
          </div>
        </Seccion>
      </div>
      <Seccion title="Pagos de clientes por liquidar" subtitle={c.liquidacionesVencidas ? `${c.liquidacionesVencidas} liquidaciones vencidas` : 'Dinero pagado por el cliente y retenido por pasarelas o terceros.'}>
        <Tabla filas={c.porLiquidar} onRow={(x) => x.ventaId && abrirVenta(x.ventaId)} vacio="No hay dinero retenido." columnas={[
          ['venta', 'Venta', false, (x) => x.venta || (x.adelantoId ? <button type="button" className="min-h-[44px] underline focus-visible:ring-2" onClick={() => abrirReserva(x.adelantoId)}>Reserva #{x.adelantoId}</button> : '—')], ['fechaPago', 'Pagó', false, (x) => fecha(x.fechaPago)],
          ['cuenta', 'Retenido en', false], ['fechaEstimada', 'Liquidación estimada', false, (x) => <span className={x.vencida ? 'font-medium text-red-700' : ''}>{x.fechaEstimada ? fecha(x.fechaEstimada) : 'Sin fecha'}{x.vencida ? ' · vencida' : ''}</span>],
          ['pendiente', 'Pendiente', true], ['comisionEstimada', 'Comisión est.', true],
        ]} />
      </Seccion>
      <Seccion title="Ventas con saldo o liquidación pendiente">
        <Tabla filas={c.ventasConSaldo} columnas={[...colsVentas.slice(0, 5), ['porLiquidar', 'Por liquidar', true], ['dias', 'Días', false], colsVentas[7]]} onRow={(v) => abrirVenta(v.ventaId)} vacio="Todas las ventas conciliadas están cobradas." />
      </Seccion>
      <Seccion title="Ventas con margen liberado en el periodo">
        <Tabla filas={c.ventasConCobroEnPeriodo} columnas={[...colsVentas.slice(0, 4), ['margenPeriodo', 'Margen del periodo', true], colsVentas[7]]} onRow={(v) => abrirVenta(v.ventaId)} vacio="Sin cobros disponibles en el periodo." />
      </Seccion>
    </div>
  );
}

function Flujo({ data }) {
  const f = data.flujo;
  const chart = useMemo(() => ({
    labels: f.serie.map((s) => (s.fecha.length === 7 ? nombreMes(s.fecha) : fecha(s.fecha).slice(0, 5))),
    datasets: [
      { label: 'Entradas', data: f.serie.map((s) => s.entradas), backgroundColor: '#059669' },
      { label: 'Salidas', data: f.serie.map((s) => -s.salidas), backgroundColor: '#dc2626' },
    ],
  }), [f.serie]);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra label="Entradas" value={money(f.entradas)} />
        <Cifra label="Salidas" value={money(f.salidas)} />
        <Cifra label="Flujo neto" value={money(f.neto)} tone={f.neto < 0 ? 'bad' : 'good'} />
        <Cifra label="Transferencias internas" value={money(f.transferenciasInternas)} />
        <Cifra label="Pagos de tarjetas" value={money(f.pagosTarjeta)} hint="Reducen deuda; el costo ya se reconoció al comprar." />
        <Cifra label="Compras con tarjeta (deuda)" value={money(f.comprasConTarjeta)} hint="No salen de caja hasta pagar la tarjeta." />
        <Cifra label="Reembolsos recuperados" value={money(f.recuperacionesReembolso)} extra={f.reembolsosATarjeta ? `+ ${money(f.reembolsosATarjeta)} abonados a tarjetas` : null} />
        <Cifra label="Previsto vs. real (liquidaciones)" value={`${money(f.previstoVsReal.real)} / ${money(f.previstoVsReal.previsto)}`} extra={`Diferencia ${money(f.previstoVsReal.diferencia)}`} />
      </div>
      {f.serie.length > 1 && (
        <Seccion title="Entradas y salidas">
          <div className="h-56"><Bar data={chart} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { x: { stacked: true }, y: { stacked: true } } }} /></div>
        </Seccion>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion title="Por categoría">
          <Tabla maxH="" filas={Object.entries(f.porCategoria).map(([k, v]) => ({ clave: k, monto: v }))} vacio="Sin movimientos en el periodo." columnas={[
            ['clave', 'Concepto', false, (x) => FLUJO_LABEL[x.clave] || x.clave], ['monto', 'Importe', true, (x) => <span className={x.monto < 0 ? 'text-red-700' : 'text-emerald-700'}>{money(x.monto)}</span>],
          ]} />
        </Seccion>
        <Seccion title="Saldos por cuenta" subtitle="Neto de los movimientos registrados (incluye ajustes de saldo inicial).">
          <Tabla maxH="" filas={f.saldos} columnas={[
            ['nombre', 'Cuenta', false, (c) => <span>{c.nombre}{!c.disponible && <span className="ml-1 text-xs text-slate-500">(no disponible)</span>}</span>],
            ['saldo', 'Saldo', true],
          ]} />
        </Seccion>
      </div>
      <Seccion title="Proyección de movimientos" subtitle="Liquidaciones esperadas y reembolsos por recuperar.">
        <Tabla filas={f.proyeccion} vacio="No hay movimientos esperados." columnas={[
          ['fecha', 'Fecha estimada', false, (x) => (x.fecha ? fecha(x.fecha) : 'Sin fecha')], ['concepto', 'Concepto', false], ['monto', 'Importe neto', true],
        ]} />
      </Seccion>
      {f.cobrosSinVerificarExcluidos > 0 && <p className="text-xs text-violet-800">{money(f.cobrosSinVerificarExcluidos)} de cobros históricos sin verificar no se incluyen. Confírmalos en Conciliación.</p>}
    </div>
  );
}

function Capital({ data }) {
  const c = data.capital;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Cifra label="Inventario disponible" value={money(c.inventarioDisponible.monto)} extra={`${c.inventarioDisponible.unidades} unidades`} />
        <Cifra label="En tránsito" value={money(c.enTransito.monto)} extra={`${c.enTransito.unidades} unidades`} />
        <Cifra label="En reclamación" value={money(c.enReclamacion)} extra={c.reembolsosPorRecuperar ? `Reclamado ${money(c.reembolsosPorRecuperar)}` : null} />
        <Cifra label="Retenido por intermediarios" value={money(c.retenidoIntermediarios)} />
        <Cifra label="Por cobrar a clientes" value={money(c.porCobrar)} />
        <Cifra label="Total inmovilizado" value={money(c.total)} />
      </div>
      <p className="text-xs text-slate-500">{c.nota}{c.productosSinCosto ? ` ${c.productosSinCosto} productos sin costo registrado no suman.` : ''}</p>
      <Seccion title="Productos que inmovilizan capital">
        <Tabla filas={c.detalle} columnas={[
          ['nombre', 'Producto', false], ['estado', 'Estado', false, (p) => <Estado value={p.estado === 'en_transito' ? 'en_transito' : 'disponible'} label={p.estado === 'en_transito' ? 'En tránsito' : 'En stock'} />],
          ['unidades', 'Unidades', false], ['costo', 'Costo', true],
        ]} />
      </Seccion>
    </div>
  );
}

function Conciliacion({ abrirVenta, onChanged }) {
  const [lista, setLista] = useState(null);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState([]);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [busy, setBusy] = useState(false);
  const [gastos, setGastos] = useState(null);
  const [gastoPage, setGastoPage] = useState(1);

  const cargar = useCallback(async () => {
    try {
      const [l, g] = await Promise.all([finanzasApi.conciliacion({ page, pageSize: 25 }), finanzasApi.gastosSinClasificar({ page: gastoPage })]);
      setLista(l);
      setGastos(g);
    } catch (err) {
      setError(limpiarError(err));
    }
  }, [page, gastoPage]);
  useEffect(() => { cargar(); }, [cargar]);

  const accion = async (fn, ok) => {
    setBusy(true); setError(''); setMensaje('');
    try {
      const res = await fn();
      setMensaje(typeof ok === 'function' ? ok(res) : ok);
      setSel([]);
      await cargar();
      onChanged();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setBusy(false);
    }
  };
  const importar = async () => {
    setBusy(true); setError('');
    try {
      const sim = await finanzasApi.importarHistorico(false);
      setBusy(false);
      if (!window.confirm(`Se importarán ${sim.pagosCreados} cobros ya registrados en Gastos como pagos SIN VERIFICAR (no se inventan fechas). ${sim.ventasSinEvidencia} ventas quedarán sin registros. ¿Continuar?`)) return;
      await accion(() => finanzasApi.importarHistorico(true), (r) => `Importados ${r.pagosCreados} cobros históricos sin verificar.`);
    } catch (err) {
      setBusy(false);
      setError(limpiarError(err));
    }
  };

  const items = lista?.items || [];
  return (
    <div className="space-y-4">
      <Seccion title="Ventas anteriores al control de cobros" subtitle="Conserva fecha comercial, precio y costos. Confirma cada cobro para que cuente como caja; nada se asume cobrado."
        actions={<div className="flex flex-wrap gap-2">
          <button type="button" className={btnCls} disabled={busy} onClick={importar}>Importar cobros registrados en Gastos</button>
          <button type="button" className={btnPrimaryCls} disabled={busy || !sel.length} onClick={() => accion(() => finanzasApi.conciliarLote(sel), (r) => `${r.filter((x) => x.ok).length} ventas confirmadas.`)}>
            Confirmar registros ({sel.length})
          </button>
        </div>}>
        {mensaje && <p className="mb-2 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-900">{mensaje}</p>}
        <ErrorBox error={error} />
        {!lista ? <p className="text-sm text-slate-500">Cargando…</p> : (
          <>
            <Tabla filas={items} vacio="No hay ventas pendientes de conciliación." columnas={[
              ['sel', '', false, (v) => <input type="checkbox" aria-label={`Seleccionar venta ${v.id}`} disabled={!(v.registrado > 0)} checked={sel.includes(v.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSel((s) => (e.target.checked ? [...s, v.id] : s.filter((x) => x !== v.id)))} />],
              ['modelo', 'Venta', false, (v) => <span className="font-medium">{CATEGORIA_LABEL[v.tipo] || v.tipo} {v.modelo || ''} {v.codigoInventario ? `· MS-${v.codigoInventario}` : ''}</span>],
              ['fechaComercial', 'Fecha', false, (v) => fecha(v.fechaComercial)], ['precio', 'Precio', true],
              ['registrado', 'Registrado en Gastos', true, (v) => <span className="text-slate-500">{money(v.registrado)}</span>],
              ['sugerencias', 'Ingresos sueltos coincidentes', false, (v) => (v.sugerencias?.length ? (
                <span className="flex flex-wrap gap-1">{v.sugerencias.map((g) => (
                  <button key={g.id} type="button" disabled={busy} title={g.notas || ''} className="rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-xs text-indigo-800 hover:bg-indigo-100"
                    onClick={(e) => { e.stopPropagation(); accion(() => finanzasApi.conciliar(v.id, { modo: 'vincular_ingresos', gastoIds: [g.id] }), 'Ingreso vinculado sin duplicarlo.'); }}>
                    Vincular {money(g.monto)} · {fecha(g.fecha)}
                  </button>))}</span>
              ) : '—')],
            ]} onRow={(v) => abrirVenta(v.id)} />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{lista.total} ventas por conciliar</span>
              <span className="flex gap-2">
                <button type="button" className={btnCls} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
                <button type="button" className={btnCls} disabled={page * 25 >= lista.total} onClick={() => setPage((p) => p + 1)}>Siguiente</button>
              </span>
            </div>
          </>
        )}
      </Seccion>
      <Seccion title="Gastos sin clasificar" subtitle="No se reclasifican por suposición: elige la clasificación de cada uno. Un costo directo puede vincularse a su venta sin duplicarlo.">
        {!gastos ? <p className="text-sm text-slate-500">Cargando…</p> : (
          <>
            <Tabla filas={gastos.items} vacio="Todos los gastos están clasificados." columnas={[
              ['fecha', 'Fecha', false, (g) => fecha(g.fecha)], ['concepto', 'Concepto', false, (g) => <span>{g.concepto}{g.notas ? <span className="block max-w-[16rem] truncate text-xs text-slate-500">{g.notas}</span> : null}</span>],
              ['metodoPago', 'Medio', false, (g) => `${g.metodoPago}${g.tarjeta ? ` · ${g.tarjeta}` : ''}`], ['monto', 'Importe', false, (g) => `${g.moneda} ${Number(g.monto).toFixed(2)}`],
              ['clasificar', 'Clasificación', false, (g) => <ClasificarGasto gasto={g} onSaved={() => { cargar(); onChanged(); }} />],
            ]} />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{gastos.total} gastos sin clasificar</span>
              <span className="flex gap-2">
                <button type="button" className={btnCls} disabled={gastoPage <= 1} onClick={() => setGastoPage((p) => p - 1)}>Anterior</button>
                <button type="button" className={btnCls} disabled={gastoPage * 50 >= gastos.total} onClick={() => setGastoPage((p) => p + 1)}>Siguiente</button>
              </span>
            </div>
          </>
        )}
      </Seccion>
    </div>
  );
}

function ClasificarGasto({ gasto, onSaved }) {
  const [valor, setValor] = useState('');
  const [ventaId, setVentaId] = useState('');
  const [error, setError] = useState('');
  const guardar = async () => {
    setError('');
    try {
      await finanzasApi.clasificarGasto(gasto.id, { clasificacionFinanciera: valor, ventaVinculadaId: ventaId ? Number(ventaId) : undefined });
      onSaved();
    } catch (err) {
      setError(limpiarError(err));
    }
  };
  const vinculable = valor === 'costo_directo' || valor === 'comision_venta';
  return (
    <span className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <select className="rounded border border-slate-300 px-1 py-0.5 text-xs" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Clasificación">
        <option value="">Elegir…</option>
        {CLASIFICACIONES_GASTO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      {vinculable && <input className="w-20 rounded border border-slate-300 px-1 py-0.5 text-xs" placeholder="Venta #" value={ventaId} onChange={(e) => setVentaId(e.target.value)} />}
      <button type="button" disabled={!valor} className="rounded bg-slate-900 px-2 py-0.5 text-xs text-white disabled:opacity-40" onClick={guardar}>Guardar</button>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </span>
  );
}

function Cuentas({ data, onChanged }) {
  const [cuentas, setCuentas] = useState([]);
  const [movs, setMovs] = useState(null);
  const [error, setError] = useState('');
  const [clave, setClave] = useState(nuevaClave);
  const [mov, setMov] = useState({ tipo: 'transferencia', fecha: hoy(), cuentaOrigenId: '', cuentaDestinoId: '', monto: '', moneda: 'PEN', tipoCambio: '', referencia: '', nota: '' });
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', tipo: 'banco', moneda: 'PEN' });
  const cargar = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([finanzasApi.cuentas(), finanzasApi.movimientos({})]);
      setCuentas(c || []); setMovs(m);
    } catch (err) { setError(limpiarError(err)); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  const saldo = (id) => data.flujo.saldos.find((s) => s.cuentaId === id)?.saldo;
  const nombre = (id) => cuentas.find((c) => c.id === id)?.nombre || '—';
  const run = async (fn) => {
    setError('');
    try { await fn(); await cargar(); onChanged(); } catch (err) { setError(limpiarError(err)); }
  };
  const registrar = (e) => {
    e.preventDefault();
    run(async () => {
      await finanzasApi.registrarMovimiento({
        tipo: mov.tipo, fecha: mov.fecha, monto: Number(mov.monto), moneda: mov.moneda,
        tipoCambio: mov.moneda === 'USD' ? Number(mov.tipoCambio) : undefined,
        cuentaOrigenId: mov.cuentaOrigenId ? Number(mov.cuentaOrigenId) : undefined,
        cuentaDestinoId: mov.cuentaDestinoId ? Number(mov.cuentaDestinoId) : undefined,
        referencia: mov.referencia || undefined, nota: mov.nota || undefined, idempotencyKey: clave,
      });
      setClave(nuevaClave());
      setMov((m) => ({ ...m, monto: '', referencia: '', nota: '' }));
    });
  };
  const propias = cuentas.filter((c) => c.activo && c.tipo !== 'tarjeta_credito');
  return (
    <div className="space-y-4">
      <ErrorBox error={error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion title="Cuentas financieras" subtitle="Las tarjetas de crédito se administran en Gastos; aquí solo se enlazan.">
          <Tabla maxH="" filas={cuentas} columnas={[
            ['nombre', 'Cuenta', false, (c) => <span className={c.activo ? '' : 'text-slate-400 line-through'}>{c.nombre}</span>], ['tipo', 'Tipo', false],
            ['saldo', 'Saldo según registros', true, (c) => money(saldo(c.id))],
            ['activo', '', false, (c) => <button type="button" className="text-xs text-slate-600 hover:underline" onClick={() => run(() => finanzasApi.actualizarCuenta(c.id, { activo: !c.activo }))}>{c.activo ? 'Desactivar' : 'Activar'}</button>],
          ]} />
          <form className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5" onSubmit={(e) => { e.preventDefault(); run(async () => { await finanzasApi.crearCuenta(nueva); setNueva({ codigo: '', nombre: '', tipo: 'banco', moneda: 'PEN' }); }); }}>
            <Campo label="Código"><input className={inputCls} value={nueva.codigo} onChange={(e) => setNueva({ ...nueva, codigo: e.target.value })} required /></Campo>
            <Campo label="Nombre" className="col-span-1 sm:col-span-2"><input className={inputCls} value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} required /></Campo>
            <Campo label="Tipo">
              <select className={inputCls} value={nueva.tipo} onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}>
                <option value="banco">Banco</option><option value="billetera">Yape / Plin</option><option value="efectivo">Efectivo</option><option value="tercero">Repartidor / tercero</option><option value="procesador">Pasarela</option><option value="proveedor">Saldo con proveedor</option>
              </select>
            </Campo>
            <div className="flex items-end"><button type="submit" className={btnPrimaryCls}>Agregar</button></div>
          </form>
        </Seccion>
        <Seccion title="Transferencia o ajuste" subtitle="Las transferencias entre cuentas propias no cambian la utilidad ni el flujo neto. Usa un ajuste para fijar el saldo inicial.">
          <form onSubmit={registrar} className="grid grid-cols-2 gap-2">
            <Campo label="Tipo">
              <select className={inputCls} value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value, cuentaOrigenId: '', cuentaDestinoId: '' })}>
                <option value="transferencia">Transferencia</option><option value="ajuste">Ajuste / saldo inicial</option>
              </select>
            </Campo>
            <Campo label="Fecha"><input type="date" className={inputCls} value={mov.fecha} onChange={(e) => setMov({ ...mov, fecha: e.target.value })} /></Campo>
            <Campo label={mov.tipo === 'ajuste' ? 'Sale de (opcional)' : 'Desde'}>
              <select className={inputCls} value={mov.cuentaOrigenId} onChange={(e) => setMov({ ...mov, cuentaOrigenId: e.target.value })}>
                <option value="">—</option>{propias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
            <Campo label={mov.tipo === 'ajuste' ? 'Entra a (opcional)' : 'Hacia'}>
              <select className={inputCls} value={mov.cuentaDestinoId} onChange={(e) => setMov({ ...mov, cuentaDestinoId: e.target.value })}>
                <option value="">—</option>{propias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
            <Campo label="Importe"><input className={inputCls} inputMode="decimal" value={mov.monto} onChange={(e) => setMov({ ...mov, monto: e.target.value })} required /></Campo>
            <Campo label="Moneda"><select className={inputCls} value={mov.moneda} onChange={(e) => setMov({ ...mov, moneda: e.target.value })}><option value="PEN">PEN</option><option value="USD">USD</option></select></Campo>
            {mov.moneda === 'USD' && <Campo label="Tipo de cambio"><input className={inputCls} inputMode="decimal" value={mov.tipoCambio} onChange={(e) => setMov({ ...mov, tipoCambio: e.target.value })} /></Campo>}
            <Campo label="Referencia"><input className={inputCls} value={mov.referencia} onChange={(e) => setMov({ ...mov, referencia: e.target.value })} /></Campo>
            <Campo label="Nota" className="col-span-2"><input className={inputCls} value={mov.nota} onChange={(e) => setMov({ ...mov, nota: e.target.value })} /></Campo>
            <div className="col-span-2 flex justify-end"><button type="submit" className={btnPrimaryCls}>Registrar</button></div>
          </form>
        </Seccion>
      </div>
      <Seccion title="Movimientos registrados">
        <Tabla filas={movs?.items || []} vacio="Sin transferencias ni ajustes." columnas={[
          ['fecha', 'Fecha', false, (m) => fecha(m.fecha)], ['tipo', 'Tipo', false],
          ['cuentas', 'Cuentas', false, (m) => `${m.cuentaOrigenId ? nombre(m.cuentaOrigenId) : '—'} → ${m.cuentaDestinoId ? nombre(m.cuentaDestinoId) : '—'}`],
          ['montoPen', 'Importe', true, (m) => <span className={m.anuladoAt ? 'text-slate-400 line-through' : ''}>{money(m.montoPen)}</span>],
          ['referencia', 'Referencia', false],
          ['acc', '', false, (m) => (!m.anuladoAt && <button type="button" className="text-xs text-red-700 hover:underline" onClick={() => { const motivo = window.prompt('Motivo de la anulación:'); if (motivo) run(() => finanzasApi.anularMovimiento(m.id, motivo)); }}>Anular</button>)],
        ]} />
      </Seccion>
    </div>
  );
}

export default function FinanzasPanel() {
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('finanzas:tab') || 'resumen'; } catch { return 'resumen'; } });
  const [preset, setPreset] = useState('mes');
  const [rango, setRango] = useState(() => rangoMes(0));
  const [filtros, setFiltros] = useState({ tipo: '', vendedor: '', cuentaId: '', metodo: '', estadoCobro: '', incluirNoVerificados: false });
  const [data, setData] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sinPermiso, setSinPermiso] = useState(!sesionFinanciera().esAdmin);
  const [ventaAbierta, setVentaAbierta] = useState(null);
  const [reservaAbierta, setReservaAbierta] = useState(null);
  const [ventaRapida, setVentaRapida] = useState(false);
  const [costosAbiertos, setCostosAbiertos] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => { try { localStorage.setItem('finanzas:tab', tab); } catch { /* ignorar */ } }, [tab]);
  const cambiarPreset = (p) => {
    setPreset(p);
    if (p === 'mes') setRango(rangoMes(0));
    if (p === 'anterior') setRango(rangoMes(-1));
    if (p === 'anio') { const y = hoy().slice(0, 4); setRango({ from: `${y}-01-01`, to: `${y}-12-31` }); }
  };

  useEffect(() => {
    if (sinPermiso) return undefined;
    let vivo = true;
    setLoading(true);
    setError('');
    finanzasApi.analisis({ ...rango, ...filtros })
      .then((d) => { if (vivo) setData(d); })
      .catch((err) => { if (!vivo) return; if (esErrorDePermiso(err)) setSinPermiso(true); else setError(limpiarError(err)); })
      .finally(() => { if (vivo) setLoading(false); });
    return () => { vivo = false; };
  }, [rango, filtros, version, sinPermiso]);

  useEffect(() => {
    if (sinPermiso) return;
    finanzasApi.cuentas().then((c) => setCuentas(c || [])).catch(() => {});
  }, [sinPermiso]);

  const refrescar = () => setVersion((v) => v + 1);
  useEffect(() => {
    const changed = () => setVersion((v) => v + 1);
    window.addEventListener('ventas-updated', changed);
    return () => window.removeEventListener('ventas-updated', changed);
  }, []);
  const setFiltro = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  if (sinPermiso) return <AvisoSesion />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-wrap items-end gap-2">
          <Campo label="Periodo">
            <select className={inputCls} value={preset} onChange={(e) => cambiarPreset(e.target.value)}>
              <option value="mes">Este mes</option><option value="anterior">Mes anterior</option><option value="anio">Este año</option><option value="custom">Personalizado</option>
            </select>
          </Campo>
          {preset === 'custom' ? (
            <>
              <Campo label="Desde"><input type="date" className={inputCls} value={rango.from} onChange={(e) => setRango((r) => ({ ...r, from: e.target.value }))} /></Campo>
              <Campo label="Hasta"><input type="date" className={inputCls} value={rango.to} onChange={(e) => setRango((r) => ({ ...r, to: e.target.value }))} /></Campo>
            </>
          ) : (
            <Campo label="Mes">
              <input type="month" className={inputCls} value={rango.from.slice(0, 7)} onChange={(e) => {
                if (!e.target.value) return;
                const [y, m] = e.target.value.split('-').map(Number);
                const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
                setPreset('mes');
                setRango({ from: `${e.target.value}-01`, to: `${e.target.value}-${String(last).padStart(2, '0')}` });
              }} />
            </Campo>
          )}
          <Campo label="Categoría"><select className={inputCls} value={filtros.tipo} onChange={setFiltro('tipo')}>{CATEGORIAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo label="Vendedor"><select className={inputCls} value={filtros.vendedor} onChange={setFiltro('vendedor')}><option value="">Todos</option><option value="gonzalo">Gonzalo</option><option value="renato">Renato</option></select></Campo>
          <Campo label="Cuenta"><select className={inputCls} value={filtros.cuentaId} onChange={setFiltro('cuentaId')}><option value="">Todas</option>{cuentas.filter((c) => c.tipo !== 'tarjeta_credito').map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Campo>
          <Campo label="Método"><select className={inputCls} value={filtros.metodo} onChange={setFiltro('metodo')}><option value="">Todos</option>{METODOS_PAGO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Campo>
          <Campo label="Estado">
            <select className={inputCls} value={filtros.estadoCobro} onChange={setFiltro('estadoCobro')}>
              <option value="">Todos</option><option value="pagado">Cobrada</option><option value="parcialmente_pagado">Parcial</option><option value="pendiente">Pendiente</option>
              <option value="pendiente_liquidacion">Por liquidar</option><option value="disputado">En disputa</option><option value="conciliacion_pendiente">Por conciliar</option>
            </select>
          </Campo>
          <label className="flex items-center gap-1.5 pb-1.5 text-xs text-slate-600"><input type="checkbox" checked={filtros.incluirNoVerificados} onChange={setFiltro('incluirNoVerificados')} />Incluir históricos sin verificar</label>
          <div className="ml-auto flex gap-2 pb-0.5">
            <button type="button" className={btnCls} onClick={refrescar} disabled={loading}>{loading ? 'Actualizando…' : 'Actualizar'}</button>
            <button type="button" className={btnPrimaryCls} onClick={() => setVentaRapida(true)}>Venta rápida</button>
            <button type="button" className={btnCls} onClick={() => setCostosAbiertos(true)}>Costos pendientes</button>
          </div>
        </div>
      </div>

      <nav className="-mx-1 flex gap-1 overflow-x-auto px-1" aria-label="Secciones de finanzas">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{l}</button>
        ))}
      </nav>

      {data?.advertencias?.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {data.advertencias.map((a) => <li key={a}>• {a}</li>)}
        </ul>
      )}
      <ErrorBox error={error} onRetry={refrescar} />
      {!data && loading && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}</div>}
      {data && (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          {tab === 'resumen' && <Resumen data={data} abrirTab={setTab} />}
          {tab === 'rentabilidad' && <Rentabilidad data={data} abrirVenta={setVentaAbierta} />}
          {tab === 'cobros' && <Cobros abrirReserva={setReservaAbierta} data={data} abrirVenta={setVentaAbierta} />}
          {tab === 'flujo' && <Flujo data={data} />}
          {tab === 'capital' && <Capital data={data} />}
          {tab === 'conciliacion' && <Conciliacion abrirVenta={setVentaAbierta} onChanged={refrescar} />}
          {tab === 'cuentas' && <Cuentas data={data} onChanged={refrescar} />}
        </div>
      )}
      {ventaAbierta && <DetalleVentaModal ventaId={ventaAbierta} onClose={() => setVentaAbierta(null)} onChanged={refrescar} onOpenReserva={(id) => { setVentaAbierta(null); setReservaAbierta(id); }} />}
      {reservaAbierta && <PanelVentaCuotas adelantoId={reservaAbierta} onClose={() => setReservaAbierta(null)} onChanged={refrescar} />}
      {ventaRapida && <VentaRapidaModal onClose={() => setVentaRapida(false)} onSaved={refrescar} />}
      {costosAbiertos && <CostosPendientes onClose={() => setCostosAbiertos(false)} onSaved={refrescar} />}
    </div>
  );
}
