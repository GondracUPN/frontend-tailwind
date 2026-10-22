import React, { useCallback, useEffect, useMemo, useState } from 'react';
import VentaRapidaModal from './VentaRapidaModal';
import PanelVentaCuotas from '../ventas/PanelVentaCuotas';
import { CompletarCosto } from './CostosPendientes';
import { esErrorDePermiso, finanzasApi, limpiarError, METODOS_PAGO, nuevaClave } from '../../services/finanzas';
import { AvisoSesion, btnCls, btnPrimaryCls, Campo, Cifra, ErrorBox, Estado, fecha, hoy, inputCls, money } from './ui';

const TIPO_LINEA = {
  pago: 'Pago del cliente',
  adelanto: 'Adelanto',
  liquidacion: 'Liquidación recibida',
  devolucion: 'Devolución al cliente',
  contracargo: 'Contracargo',
  reversion_contracargo: 'Contracargo revertido',
};
const DISPONIBLES = ['efectivo', 'banco', 'billetera'];

function cuentasParaMetodo(cuentas, metodo) {
  // BCP primero: es la cuenta de cobro habitual.
  const activas = cuentas.filter((c) => c.activo).sort((a, b) => (b.codigo === 'bcp') - (a.codigo === 'bcp'));
  if (metodo === 'efectivo') return activas.filter((c) => c.tipo === 'efectivo' || c.tipo === 'tercero');
  if (metodo === 'tarjeta') return activas.filter((c) => c.tipo === 'procesador');
  return activas.filter((c) => ['banco', 'billetera', 'tercero', 'procesador'].includes(c.tipo));
}

function FormPago({ ventaId, saldo, cuentas, onDone, onCancel }) {
  const [clave] = useState(nuevaClave);
  const [form, setForm] = useState({
    monto: saldo > 0 ? String(saldo) : '', fechaPago: hoy(), metodo: 'transferencia', cuentaReceptoraId: '', moneda: 'PEN',
    tipoCambio: '', comisionEstimada: '', fechaLiquidacionEstimada: '', referencia: '', cuentaOrigen: '', observacion: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const opciones = useMemo(() => cuentasParaMetodo(cuentas, form.metodo), [cuentas, form.metodo]);
  const cuenta = cuentas.find((c) => String(c.id) === String(form.cuentaReceptoraId)) || (opciones.length === 1 ? opciones[0] : null);
  const retenido = cuenta && !DISPONIBLES.includes(cuenta.tipo);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    if (!opciones.some((c) => String(c.id) === String(form.cuentaReceptoraId))) {
      setForm((f) => ({ ...f, cuentaReceptoraId: opciones[0] ? String(opciones[0].id) : '' }));
    }
  }, [opciones, form.cuentaReceptoraId]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const monto = Number(form.monto);
    if (!(monto > 0)) return setError('Ingresa un monto válido.');
    if (form.moneda === 'USD' && !(Number(form.tipoCambio) > 0)) return setError('Indica el tipo de cambio.');
    setSaving(true);
    try {
      await finanzasApi.registrarPago({
        ventaId, monto, fechaPago: form.fechaPago, metodo: form.metodo,
        cuentaReceptoraId: cuenta ? Number(cuenta.id) : undefined, moneda: form.moneda,
        tipoCambio: form.moneda === 'USD' ? Number(form.tipoCambio) : undefined,
        comisionEstimada: retenido && form.comisionEstimada ? Number(form.comisionEstimada) : undefined,
        fechaLiquidacionEstimada: retenido && form.fechaLiquidacionEstimada ? form.fechaLiquidacionEstimada : undefined,
        referencia: form.referencia || undefined, cuentaOrigen: form.cuentaOrigen || undefined,
        observacion: form.observacion || undefined, idempotencyKey: clave,
      });
      onDone();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Campo label="Importe"><input className={inputCls} inputMode="decimal" value={form.monto} onChange={set('monto')} required /></Campo>
        <Campo label="Moneda">
          <select className={inputCls} value={form.moneda} onChange={set('moneda')}><option value="PEN">PEN</option><option value="USD">USD</option></select>
        </Campo>
        {form.moneda === 'USD' && <Campo label="Tipo de cambio"><input className={inputCls} inputMode="decimal" value={form.tipoCambio} onChange={set('tipoCambio')} /></Campo>}
        <Campo label="Fecha en que pagó"><input type="date" className={inputCls} value={form.fechaPago} onChange={set('fechaPago')} required /></Campo>
        <Campo label="Método">
          <select className={inputCls} value={form.metodo} onChange={set('metodo')}>
            {METODOS_PAGO.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Campo>
        <Campo label="Cuenta que recibe" className="col-span-2">
          <select className={inputCls} value={form.cuentaReceptoraId} onChange={set('cuentaReceptoraId')}>
            {opciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
        <Campo label="Referencia"><input className={inputCls} value={form.referencia} onChange={set('referencia')} placeholder="N.º operación" /></Campo>
      </div>
      {retenido && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <p className="col-span-2 self-center text-xs text-sky-800 sm:col-span-2">El dinero queda retenido hasta registrar su liquidación; no cuenta como caja disponible.</p>
          <Campo label="Comisión estimada"><input className={inputCls} inputMode="decimal" value={form.comisionEstimada} onChange={set('comisionEstimada')} /></Campo>
          <Campo label="Liquidación estimada"><input type="date" className={inputCls} value={form.fechaLiquidacionEstimada} onChange={set('fechaLiquidacionEstimada')} /></Campo>
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Campo label="Origen / intermediario (opcional)"><input className={inputCls} value={form.cuentaOrigen} onChange={set('cuentaOrigen')} placeholder="Izipay, BCP del cliente…" /></Campo>
        <Campo label="Observación (opcional)"><input className={inputCls} value={form.observacion} onChange={set('observacion')} /></Campo>
      </div>
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={btnPrimaryCls} disabled={saving}>{saving ? 'Guardando…' : 'Registrar pago'}</button>
      </div>
    </form>
  );
}

function FormEvento({ pago, tipo, cuentas, pendiente, onDone, onCancel }) {
  const [clave] = useState(nuevaClave);
  const disponibles = cuentas.filter((c) => c.activo && DISPONIBLES.includes(c.tipo));
  const [form, setForm] = useState({
    fecha: hoy(), montoBruto: String(pendiente || pago.montoPen || ''), comision: '',
    cuentaId: tipo === 'devolucion' && pago.requiereLiquidacion ? '' : String(disponibles.find((c) => c.codigo === 'bcp')?.id || disponibles[0]?.id || ''),
    referencia: '', nota: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const neto = Number(form.montoBruto || 0) - Number(form.comision || 0);
  const titulos = { liquidacion: 'Registrar liquidación', devolucion: 'Devolver al cliente', contracargo: 'Registrar contracargo', reversion_contracargo: 'Revertir contracargo' };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await finanzasApi.registrarEvento(pago.id, {
        tipo, fecha: form.fecha, montoBruto: Number(form.montoBruto), comision: tipo === 'liquidacion' ? Number(form.comision || 0) : undefined,
        cuentaId: form.cuentaId ? Number(form.cuentaId) : undefined, referencia: form.referencia || undefined, nota: form.nota || undefined,
        idempotencyKey: clave,
      });
      onDone();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium">{titulos[tipo]}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Campo label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={set('fecha')} required /></Campo>
        <Campo label={tipo === 'liquidacion' ? 'Importe bruto liquidado' : 'Importe'}><input className={inputCls} inputMode="decimal" value={form.montoBruto} onChange={set('montoBruto')} required /></Campo>
        {tipo === 'liquidacion' && <Campo label="Comisión retenida"><input className={inputCls} inputMode="decimal" value={form.comision} onChange={set('comision')} /></Campo>}
        <Campo label={tipo === 'liquidacion' ? 'Depositado en' : 'Cuenta'}>
          <select className={inputCls} value={form.cuentaId} onChange={set('cuentaId')}>
            {tipo === 'devolucion' && pago.requiereLiquidacion && <option value="">Descontado por la pasarela</option>}
            {tipo !== 'liquidacion' && !(tipo === 'devolucion' && pago.requiereLiquidacion) && <option value="">Cuenta del pago</option>}
            {disponibles.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </Campo>
      </div>
      {tipo === 'liquidacion' && <p className="text-xs text-slate-600">Neto depositado: <strong>{money(neto)}</strong></p>}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Campo label="Referencia"><input className={inputCls} value={form.referencia} onChange={set('referencia')} /></Campo>
        <Campo label="Nota"><input className={inputCls} value={form.nota} onChange={set('nota')} /></Campo>
      </div>
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={btnPrimaryCls} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

function Conciliacion({ ventaId, cuentas, onDone }) {
  const [modo, setModo] = useState('');
  const [fechaCobro, setFechaCobro] = useState('');
  const [cuentaId, setCuentaId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [pendienteForzar, setPendienteForzar] = useState(null);
  const enviar = async (m, forzar = false) => {
    setError('');
    setPendienteForzar(null);
    if (m === 'con_fecha' && !fechaCobro) return setError('Indica la fecha real del cobro.');
    setSaving(true);
    try {
      await finanzasApi.conciliar(ventaId, { modo: m, fecha: m === 'con_fecha' ? fechaCobro : undefined, cuentaId: cuentaId ? Number(cuentaId) : undefined, forzar: forzar || undefined });
      onDone();
    } catch (err) {
      const mensaje = limpiarError(err);
      setError(mensaje);
      if (/ingresos sueltos/.test(mensaje)) setPendienteForzar(m);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-violet-950">
      <p className="font-medium">Venta anterior al control de cobros</p>
      <p className="mt-1 text-xs">Sus cobros no se cuentan como caja ni como saldo por cobrar hasta confirmarlos. Los importes en gris provienen de Gastos y aún no están verificados.</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={btnCls} disabled={saving} onClick={() => enviar('confirmar_registros')}>Los registros son correctos</button>
        <button type="button" className={btnCls} disabled={saving} onClick={() => setModo(modo === 'con_fecha' ? '' : 'con_fecha')}>Se cobró el saldo en una fecha…</button>
        <button type="button" className={btnCls} disabled={saving} onClick={() => enviar('sin_fecha')}>Se cobró, fecha desconocida</button>
        <button type="button" className={btnCls} disabled={saving} onClick={() => enviar('pendiente_real')}>Sigue debiendo el saldo</button>
      </div>
      {modo === 'con_fecha' && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Campo label="Fecha real"><input type="date" className={inputCls} value={fechaCobro} onChange={(e) => setFechaCobro(e.target.value)} /></Campo>
          <Campo label="Cuenta">
            <select className={inputCls} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
              <option value="">BCP</option>
              {cuentas.filter((c) => c.activo && DISPONIBLES.includes(c.tipo)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
          <button type="button" className={btnPrimaryCls} disabled={saving} onClick={() => enviar('con_fecha')}>Confirmar</button>
        </div>
      )}
      <div className="mt-2"><ErrorBox error={error} /></div>
      {pendienteForzar && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span>Vincula esos ingresos desde la pestaña Conciliación. Si es otro dinero:</span>
          <button type="button" className={btnCls} disabled={saving} onClick={() => enviar(pendienteForzar, true)}>Registrar igualmente</button>
        </div>
      )}
    </div>
  );
}

function PrecioPactado({ venta, onDone }) {
  const [abierto, setAbierto] = useState(false);
  const [precioLista, setPrecioLista] = useState(venta.precioLista != null ? String(venta.precioLista) : String(venta.precio));
  const [error, setError] = useState('');
  const descuento = Math.max(0, Math.round((Number(precioLista || 0) - Number(venta.precio)) * 100) / 100);
  const guardar = async () => {
    setError('');
    if (!(Number(precioLista) >= Number(venta.precio))) return setError('El precio pactado no puede ser menor que el precio de venta.');
    try {
      await finanzasApi.precioPactado(venta.id, Number(precioLista));
      setAbierto(false);
      onDone();
    } catch (err) {
      setError(limpiarError(err));
    }
  };
  if (!abierto) {
    return <button type="button" className="text-xs font-medium text-slate-600 hover:underline" onClick={() => setAbierto(true)}>{venta.descuento ? 'Editar precio pactado' : 'Registrar precio pactado / descuento'}</button>;
  }
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 p-2">
      <Campo label="Precio pactado (antes de descuento)"><input className={inputCls} inputMode="decimal" value={precioLista} onChange={(e) => setPrecioLista(e.target.value)} /></Campo>
      <p className="pb-2 text-xs text-slate-600">Descuento: <strong>{money(descuento)}</strong> · precio de venta {money(venta.precio)}</p>
      <button type="button" className={btnPrimaryCls} onClick={guardar}>Guardar</button>
      <button type="button" className={btnCls} onClick={() => setAbierto(false)}>Cancelar</button>
      <ErrorBox error={error} />
    </div>
  );
}

export default function PagosVenta({ ventaId, onChanged, compact = false, onOpenReserva }) {
  const [data, setData] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sinPermiso, setSinPermiso] = useState(false);
  const [nuevoPago, setNuevoPago] = useState(false);
  const [accion, setAccion] = useState(null); // { pagoId, tipo }
  const [accesorios, setAccesorios] = useState(false);
  const [reserva, setReserva] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [detalle, listaCuentas] = await Promise.all([finanzasApi.detalleVenta(ventaId), finanzasApi.cuentas()]);
      setData(detalle);
      setCuentas(listaCuentas || []);
    } catch (err) {
      if (esErrorDePermiso(err)) setSinPermiso(true);
      else setError(limpiarError(err));
    } finally {
      setLoading(false);
    }
  }, [ventaId]);

  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => {
    setNuevoPago(false);
    setAccion(null);
    await cargar();
    onChanged?.();
  };

  const anular = async (pago) => {
    const motivo = window.prompt('Motivo para anular este pago registrado por error:');
    if (!motivo) return;
    try {
      await finanzasApi.anularPago(pago.id, motivo);
      await refrescar();
    } catch (err) {
      setError(limpiarError(err));
    }
  };

  if (reserva) return <PanelVentaCuotas adelantoId={reserva} onClose={() => setReserva(null)} onChanged={refrescar} />;
  if (sinPermiso) return <AvisoSesion />;
  if (loading && !data) return <p className="py-4 text-sm text-slate-500">Cargando pagos…</p>;
  if (!data) return <ErrorBox error={error || 'No se pudo cargar la venta.'} onRetry={cargar} />;

  const f = data.finanzas;
  const pagosPorId = new Map(data.pagos.map((p) => [p.id, p]));
  const porcentaje = Math.round((f.porcentajeLiberado || 0) * 100);
  return (
    <div className="space-y-3">
      {data.venta.conciliacionHistorica === 'pendiente' && <Conciliacion ventaId={ventaId} cuentas={cuentas} onDone={refrescar} />}
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        {data.adelanto?.id && <button type="button" className={`${btnCls} min-h-[44px] focus-visible:ring-2`} onClick={() => onOpenReserva ? onOpenReserva(data.adelanto.id) : setReserva(data.adelanto.id)}>Reserva #{data.adelanto.id}</button>}
        <span>Fecha comercial <strong className="text-slate-900">{fecha(data.venta.fechaComercial)}</strong></span>
        {data.venta.fechaReserva && <span>· Reserva {fecha(data.venta.fechaReserva)}</span>}
        <Estado value={f.estadoCobro} />
        <Estado value={f.estadoLiquidacion} />
        {data.venta.costoPendiente && <Estado value="pendiente" label="Costo pendiente" />}
        {data.venta.costoPendiente && <CompletarCosto ventaId={ventaId} onDone={refrescar} />}
        {data.venta.grupoOperacion && <span className="text-slate-500">· Operación agrupada</span>}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <PrecioPactado venta={{ id: data.venta.id, precio: data.venta.precio, precioLista: data.venta.precioLista, descuento: data.venta.descuento }} onDone={refrescar} />
        {data.venta.estadoComercial !== 'cancelada' && !data.venta.ventaRapida && (
          <button type="button" className="text-xs font-medium text-indigo-700 hover:underline" onClick={() => setAccesorios(true)}>+ Agregar accesorios a esta venta</button>
        )}
      </div>
      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'}`}>
        <Cifra label="Precio" value={money(f.precio)} extra={data.venta.descuento ? `Descuento ${money(data.venta.descuento)}` : null} />
        <Cifra label="Cobrado al cliente" value={money(f.cobradoCliente)} />
        <Cifra label="Saldo por cobrar" value={money(f.saldoPendiente)} tone={f.saldoPendiente > 0 ? 'bad' : undefined} />
        <Cifra label="Retenido por liquidar" value={money(f.pendienteLiquidacion)} />
        <Cifra label="Ganancia comercial" value={f.gananciaComercial == null ? 'Pendiente' : money(f.gananciaComercial)} hint="Precio menos costo del producto, en la fecha comercial." />
        <Cifra label="Comisiones y costos" value={money((f.comisiones || 0) + (f.costosVinculados || 0) + (f.devoluciones || 0) + (f.contracargosNetos || 0))} hint="Comisiones (reales y estimadas), gastos vinculados, devoluciones y contracargos." />
        <Cifra label="Ganancia final" value={f.gananciaFinal == null ? 'Pendiente' : money(f.gananciaFinal)} tone={f.gananciaFinal < 0 ? 'bad' : 'good'} />
        <Cifra label="Margen liberado" value={f.margenLiberado == null ? 'Pendiente' : money(f.margenLiberado)} extra={f.margenPendiente ? `${porcentaje}% · falta ${money(f.margenPendiente)}` : `${porcentaje}% del neto cobrado`} hint="Indicador gerencial: ganancia final × dinero neto ya disponible / neto esperado." />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Pagos y liquidaciones</h4>
          {!nuevoPago && f.saldoPendiente > 0 && data.venta.estadoComercial !== 'cancelada' && (
            <button type="button" className={btnPrimaryCls} onClick={() => setNuevoPago(true)}>+ Registrar pago</button>
          )}
        </div>
        {nuevoPago && <FormPago ventaId={ventaId} saldo={f.saldoPendiente} cuentas={cuentas} onDone={refrescar} onCancel={() => setNuevoPago(false)} />}
        {data.timeline.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-500">Sin pagos registrados. El saldo completo figura como cuenta por cobrar.</p>
        ) : (
          <ol className="relative mt-2 space-y-2 border-l border-slate-200 pl-4">
            {data.timeline.map((linea) => {
              const pago = pagosPorId.get(linea.pagoId);
              const esPago = linea.tipo === 'pago' || linea.tipo === 'adelanto';
              const r = pago && esPago ? data.pagos.find((p) => p.id === pago.id) : null;
              const pendienteLiq = r && r.requiereLiquidacion
                ? Math.max(0, Number(r.montoPen) - (r.liquidaciones || []).filter((l) => l.tipo !== 'reversion_contracargo').reduce((a, l) => a + Number(l.montoBruto), 0))
                : 0;
              return (
                <li key={`${linea.pagoId}-${linea.eventoId || 'p'}`} className={`relative ${linea.anulado ? 'opacity-50' : ''}`}>
                  <span className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full ${linea.tipo === 'devolucion' || linea.tipo === 'contracargo' ? 'bg-red-500' : linea.tipo === 'liquidacion' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-slate-900">{TIPO_LINEA[linea.tipo] || linea.tipo}</span>
                      <span className="ml-2 text-xs text-slate-500">{fecha(linea.fecha)}{linea.cuenta ? ` · ${linea.cuenta}` : ''}{linea.metodo ? ` · ${linea.metodo}` : ''}{linea.referencia ? ` · ${linea.referencia}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {esPago && linea.verificado === false && <Estado value="pendiente_hist" label="Sin verificar" />}
                      {esPago && <Estado value={linea.anulado ? 'anulado' : linea.estado} />}
                      <span className={`text-sm font-semibold tabular-nums ${linea.verificado === false ? 'text-slate-400' : linea.tipo === 'devolucion' || linea.tipo === 'contracargo' ? 'text-red-700' : 'text-slate-900'}`}>
                        {linea.tipo === 'devolucion' || linea.tipo === 'contracargo' ? '−' : ''}{money(linea.monto)}
                      </span>
                    </div>
                  </div>
                  {linea.tipo === 'liquidacion' && <p className="text-xs text-slate-500">Neto {money(linea.neto)} · comisión {money(linea.comision)}</p>}
                  {esPago && pago && !linea.anulado && (
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pago.requiereLiquidacion && pendienteLiq > 0 && <button type="button" className="text-xs font-medium text-sky-700 hover:underline" onClick={() => setAccion({ pago, tipo: 'liquidacion', pendiente: pendienteLiq })}>Registrar liquidación</button>}
                      <button type="button" className="text-xs font-medium text-slate-600 hover:underline" onClick={() => setAccion({ pago, tipo: 'devolucion' })}>Devolución</button>
                      <button type="button" className="text-xs font-medium text-slate-600 hover:underline" onClick={() => setAccion({ pago, tipo: 'contracargo' })}>Contracargo</button>
                      {pago.estado === 'disputado' && <button type="button" className="text-xs font-medium text-slate-600 hover:underline" onClick={() => setAccion({ pago, tipo: 'reversion_contracargo' })}>Revertir contracargo</button>}
                      {(pago.origen === 'manual' || pago.origen === 'conciliacion') && !(pago.liquidaciones || []).length && (
                        <button type="button" className="text-xs font-medium text-red-700 hover:underline" onClick={() => anular(pago)}>Anular</button>
                      )}
                    </div>
                  )}
                  {accion && pago && accion.pago.id === pago.id && esPago && (
                    <FormEvento pago={pago} tipo={accion.tipo} cuentas={cuentas} pendiente={accion.pendiente} onDone={refrescar} onCancel={() => setAccion(null)} />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {data.costosVinculados.length > 0 && (
        <div className="text-xs text-slate-600">
          <p className="font-medium text-slate-800">Gastos vinculados</p>
          <ul className="mt-1 space-y-0.5">{data.costosVinculados.map((c) => <li key={c.gastoId}>{fecha(c.fecha)} · {c.concepto} ({c.clasificacion === 'comision_venta' ? 'comisión' : 'costo directo'}) · {money(c.monto)}</li>)}</ul>
        </div>
      )}
      <ErrorBox error={error} onRetry={cargar} />
      {accesorios && <VentaRapidaModal ventaRelacionadaId={ventaId} onClose={() => setAccesorios(false)} onSaved={() => onChanged?.()} />}
    </div>
  );
}
