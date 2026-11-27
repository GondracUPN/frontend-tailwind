import React, { useCallback, useEffect, useState } from 'react';
import { notifySalesChanged } from '../../utils/salesSync';
import {
  esErrorDePermiso,
  finanzasApi,
  limpiarError,
  nuevaClave,
} from '../../services/finanzas';
import {
  btnCls,
  btnPrimaryCls,
  Campo,
  ErrorBox,
  Estado,
  fecha,
  hoy,
  inputCls,
  money,
} from './ui';

export const MOTIVOS_RECLAMO = [
  'No llegó a Eshopex.',
  'Llegó algo distinto al producto comprado.',
];
export const MOTIVO_EQUIPO_DANADO = 'Equipo dañado.';
const esParcial = (r) => r?.tipoReclamo === 'dano_parcial';
const cerrado = (r) =>
  ['recibido', 'rechazado', 'perdida_definitiva', 'anulado'].includes(r.estado);

function ReembolsoRecibido({ reclamo, producto, cuentas, onDone, onCancel }) {
  const [clave] = useState(nuevaClave);
  const [dia, setDia] = useState(hoy);
  const [cuentaId, setCuentaId] = useState(
    String(reclamo.cuentaDevolucionId || ''),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pendiente =
    (Math.round(Number(reclamo.montoReclamado) * 100) -
      (reclamo.eventos || [])
        .filter((e) => e.tipo === 'recibido')
        .reduce((n, e) => n + Math.round(Number(e.monto) * 100), 0)) /
    100;
  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await finanzasApi.eventoReembolso(reclamo.id, {
        tipo: 'recibido',
        fecha: dia,
        monto: pendiente,
        moneda: reclamo.moneda,
        tipoCambio: Number(reclamo.tipoCambioCompra) || undefined,
        cuentaId: Number(cuentaId),
        idempotencyKey: clave,
      });
      await onDone();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Registrar reembolso recibido"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-md space-y-3 rounded-xl bg-white p-5 shadow-xl"
      >
        <h3 className="font-semibold">{esParcial(reclamo) ? 'Confirmar llegada del reembolso' : 'Registrar reembolso recibido'}</h3>
        <p className="text-sm">
          Compra · SKU {producto.codigoInventario || producto.id}
        </p>
        <p className="text-sm">
          {esParcial(reclamo) ? 'Monto devuelto:' : 'Importe original reclamado:'}{' '}
          <strong>
            {reclamo.moneda} {Number(reclamo.montoReclamado).toFixed(2)}
          </strong>
        </p>
        {pendiente !== Number(reclamo.montoReclamado) && (
          <p>
            Pendiente: {reclamo.moneda} {pendiente.toFixed(2)}
          </p>
        )}
        <Campo label={esParcial(reclamo) ? 'Fecha en que llegó a la cuenta' : 'Fecha del reembolso'}>
          <input
            required
            type="date"
            min={reclamo.fechaIncidencia}
            className={inputCls}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
          />
        </Campo>
        <Campo label="Cuenta o tarjeta que recibió el reembolso">
          <select
            required
            className={inputCls}
            value={cuentaId}
            onChange={(e) => setCuentaId(e.target.value)}
          >
            <option value="">Selecciona</option>
            {cuentas
              .filter((c) => c.activo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
          </select>
        </Campo>
        <ErrorBox error={error} />
        <div className="flex justify-end gap-2">
          <button type="button" className={btnCls} onClick={onCancel}>
            Cancelar
          </button>
          <button disabled={saving} className={btnPrimaryCls}>
            {saving ? 'Guardando…' : 'Confirmar reembolso recibido'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ReembolsosProducto({ producto, onChanged, clientePedido = '' }) {
  const [items, setItems] = useState([]),
    [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true),
    [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState(''),
    [nuevo, setNuevo] = useState(false),
    [motivo, setMotivo] = useState('');
  const [evento, setEvento] = useState(null),
    [saving, setSaving] = useState(false);
  const [diaReclamo, setDiaReclamo] = useState(hoy);
  const [anular, setAnular] = useState(null);
  const [editarFecha, setEditarFecha] = useState(null);
  const [reabiertoId, setReabiertoId] = useState(null);
  const [danado, setDanado] = useState(null);
  const cargar = useCallback(async () => {
    try {
      const [lista, c] = await Promise.all([
        finanzasApi.reembolsos({ productoId: producto.id }),
        finanzasApi.cuentas(),
      ]);
      setItems(lista || []);
      setCuentas(c || []);
      setError('');
    } catch (err) {
      if (esErrorDePermiso(err)) setSinPermiso(true);
      else setError(limpiarError(err));
    } finally {
      setLoading(false);
    }
  }, [producto.id]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  const refrescar = async () => {
    setEvento(null);
    setNuevo(false);
    setDanado(null);
    await cargar();
    notifySalesChanged({ action: 'reclamo', productoId: producto.id });
    onChanged?.();
  };
  const crear = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await finanzasApi.crearReembolso({ productoId: producto.id, motivo, fechaIncidencia: diaReclamo });
      await refrescar();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };
  const crearDanado = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await finanzasApi.crearReembolso({
        productoId: producto.id,
        tipoReclamo: 'dano_parcial',
        motivo: MOTIVO_EQUIPO_DANADO,
        fechaIncidencia: danado.fecha,
        montoReclamado: Number(danado.monto),
        ...(clientePedido && danado.saldo !== '' ? { saldoClientePen: Number(danado.saldo) } : {}),
      });
      await refrescar();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };
  const confirmarAnulacion = async (id) => {
    setSaving(true);
    setError('');
    try {
      await finanzasApi.eventoReembolso(id, { tipo: 'anulacion', fecha: hoy(), idempotencyKey: nuevaClave() });
      setAnular(null);
      await refrescar();
    } catch (err) { setError(limpiarError(err)); }
    finally { setSaving(false); }
  };
  const guardarFecha = async () => {
    setSaving(true);
    setError('');
    try {
      await finanzasApi.eventoReembolso(editarFecha.id, { tipo: 'fecha_reclamo', fecha: editarFecha.fecha, idempotencyKey: nuevaClave() });
      setEditarFecha(null);
      await refrescar();
    } catch (err) { setError(limpiarError(err)); }
    finally { setSaving(false); }
  };
  const habilitarVenta = async () => {
    setSaving(true);
    setError('');
    try {
      await finanzasApi.cerrarProducto(producto.id, 'reabrir');
      setReabiertoId(producto.id);
      await refrescar();
    } catch (err) { setError(limpiarError(err)); }
    finally { setSaving(false); }
  };
  if (sinPermiso) return null;
  if (loading)
    return <p className="text-sm text-slate-500">Cargando reclamos…</p>;
  return (
    <div className="space-y-3">
      {producto.cierreMotivo && !producto.archivadoAt && reabiertoId !== producto.id && items.length > 0 && items.every(cerrado) && <div className="rounded-lg border border-slate-200 p-3 text-sm">
        <p>Si el producto ya está disponible físicamente, puedes volver a habilitar su venta conservando el historial del reembolso.</p>
        <button type="button" className={btnCls} disabled={saving} onClick={habilitarVenta}>Habilitar producto para vender</button>
      </div>}
      {items.filter(r => r.estado !== 'anulado').map((r) => (
        <div
          key={r.id}
          className="space-y-2 rounded-xl border border-slate-200 p-3 text-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Estado value={r.estado} />
            <span>{fecha(r.fechaIncidencia)}</span>
            {!cerrado(r) && (
              <button
                type="button"
                className={btnCls}
                onClick={() => setEvento(r.id)}
              >
                {esParcial(r) ? 'Confirmar llegada a la cuenta' : 'Registrar reembolso recibido'}
              </button>
            )}
          </div>
          <p>{esParcial(r) ? 'Equipo dañado · devolución parcial' : r.motivo}</p>
          {esParcial(r) && r.saldoClientePen != null && (
            <p>Saldo a favor del cliente: S/ {Number(r.saldoClientePen).toFixed(2)}</p>
          )}
          {!cerrado(r) && <div className="space-y-2">
            {editarFecha?.id === r.id ? <div>
              <Campo label={esParcial(r) ? 'Nueva fecha de emisión' : 'Nueva fecha del reclamo'}><input required type="date" className={inputCls} value={editarFecha.fecha} onChange={(e) => setEditarFecha({ id: r.id, fecha: e.target.value })} /></Campo>
              <button type="button" className={btnCls} disabled={saving} onClick={() => setEditarFecha(null)}>Cancelar cambio de fecha</button>{' '}
              <button type="button" className={btnCls} disabled={saving || !editarFecha.fecha} onClick={guardarFecha}>Guardar fecha del reclamo</button>
            </div> : <button type="button" className={btnCls} onClick={() => setEditarFecha({ id: r.id, fecha: r.fechaIncidencia })}>Cambiar fecha del reclamo</button>}
            {anular === r.id ? <>
              <p>{esParcial(r) ? 'Se retirará el saldo a favor generado por esta devolución. La venta no cambia. El historial se conserva.' : 'Se retirará el saldo a favor generado por este reclamo y se restaurará el pedido. El historial se conserva.'}</p>
              <button type="button" className={btnCls} disabled={saving} onClick={() => setAnular(null)}>Volver</button>{' '}
              <button type="button" className={btnCls} disabled={saving} onClick={() => confirmarAnulacion(r.id)}>Confirmar anulación</button>
            </> : <button type="button" className={btnCls} onClick={() => setAnular(r.id)}>Anular reclamo</button>}
          </div>}
          {r.estado === 'recibido' && (anular === r.id ? <div className="space-y-2 rounded-lg bg-amber-50 p-3">
            <p>Se quitará el reembolso recibido de su cuenta o tarjeta, se anulará el reclamo y se restaurarán las ventas que pasaron a saldo a favor por este reclamo. El historial se conserva.</p>
            <button type="button" className={btnCls} disabled={saving} onClick={() => setAnular(null)}>Volver</button>{' '}
            <button type="button" className={btnCls} disabled={saving} onClick={() => confirmarAnulacion(r.id)}>Confirmar quitar reembolso</button>
          </div> : <button type="button" className={btnCls} onClick={() => setAnular(r.id)}>Quitar reembolso</button>)}
          <p>
            {esParcial(r) ? 'Monto devuelto' : 'Reclamado'}: {r.moneda} {Number(r.montoReclamado).toFixed(2)}
          </p>
          {esParcial(r) && <p className="text-slate-600">
            Baja el costo del equipo en {money(r.costoOriginal)}
            {r.saldoClientePen != null ? ` y la devolución al cliente (${money(r.saldoClientePen)}) se resta del ingreso` : ''}
            {r.reversionReclamo?.ajusteVenta ? ' · ya aplicado a la ganancia de la venta.' : ' · se aplicará a la ganancia cuando se venda.'}
          </p>}
          {!esParcial(r) && <p className="text-slate-600">
            Cargo original conservado · costo de compra {money(r.costoOriginal)}
          </p>}
          <ul className="border-l pl-3 text-xs text-slate-600">
            {(r.eventos || []).map((e) => (
              <li key={e.id}>
                {fecha(e.fecha)} ·{' '}
                {e.tipo === 'recibido'
                  ? (esParcial(r) ? 'Reembolso llegó a la cuenta' : 'Reembolso recibido')
                  : e.tipo === 'incidencia'
                    ? (esParcial(r) ? 'Reembolso emitido' : 'Reclamo pendiente')
                    : e.tipo === 'anulacion' ? 'Reclamo anulado' : e.tipo === 'fecha_reclamo' ? 'Fecha del reclamo corregida'
                      : e.tipo === 'recibido_anulado' ? 'Reembolso retirado' : e.tipo}
                {e.monto
                  ? ' · ' + e.moneda + ' ' + Number(e.monto).toFixed(2)
                  : ''}
                {e.nota ? ' · ' + e.nota : ''}
              </li>
            ))}
          </ul>
          {r.fechaCierre && <p>Fecha de cierre: {fecha(r.fechaCierre)}</p>}
          {evento === r.id && (
            <ReembolsoRecibido
              reclamo={r}
              producto={producto}
              cuentas={cuentas}
              onDone={refrescar}
              onCancel={() => setEvento(null)}
            />
          )}
        </div>
      ))}
      {items.some(r => r.estado === 'anulado') && <details className="rounded-lg border border-slate-200 p-3 text-sm">
        <summary className="cursor-pointer text-slate-500">Historial de reclamos anulados ({items.filter(r => r.estado === 'anulado').length})</summary>
        {items.filter(r => r.estado === 'anulado').map(r => <div key={r.id} className="mt-3 border-t pt-2 text-slate-500">
          <p>Reclamo anulado · {fecha(r.fechaIncidencia)} · {r.motivo}</p>
          {(r.eventos || []).map(e => <p key={e.id} className="text-xs">{fecha(e.fecha)} · {e.tipo === 'anulacion' ? 'Anulación' : e.tipo === 'recibido_anulado' ? 'Reembolso retirado' : e.tipo} {e.nota || ''}</p>)}
        </div>)}
      </details>}
      {nuevo ? (
        <form
          onSubmit={crear}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
        >
          <Campo label="Motivo del reclamo">
            <select
              required
              className={inputCls}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            >
              <option value="" disabled>
                Selecciona el motivo
              </option>
              {MOTIVOS_RECLAMO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Campo>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Campo label="Fecha del reclamo"><input required type="date" className={inputCls} value={diaReclamo} onChange={(e) => setDiaReclamo(e.target.value)} /></Campo>
            <div>
              Importe reclamado: USD{' '}
              {producto.valor?.monedaCompra === 'USD'
                ? Number(producto.valor.valorProducto).toFixed(2)
                : 'Sin compra original en USD'}
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Si el pedido tiene pagos de un cliente, se genera su saldo a favor al registrar el reclamo. El abono en la cuenta se registra al confirmar la fecha del reembolso recibido.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnCls}
              onClick={() => setNuevo(false)}
            >
              Cancelar
            </button>
            <button disabled={saving} className={btnPrimaryCls}>
              {saving ? 'Guardando…' : 'Registrar reclamo'}
            </button>
          </div>
        </form>
      ) : danado ? (
        <form
          onSubmit={crearDanado}
          className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
          aria-label="Reclamo equipo dañado"
        >
          <p className="text-sm font-medium">Equipo dañado · devolución parcial</p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <Campo label="Fecha de emisión del reembolso">
              <input required type="date" className={inputCls} value={danado.fecha}
                onChange={(e) => setDanado({ ...danado, fecha: e.target.value })} />
            </Campo>
            <Campo label="Monto devuelto (USD)">
              <input required type="number" min="0.01" step="0.01" className={inputCls} value={danado.monto}
                max={producto.valor?.monedaCompra === 'USD' ? Number(producto.valor.valorProducto) : undefined}
                onChange={(e) => setDanado({ ...danado, monto: e.target.value })} />
            </Campo>
          </div>
          {clientePedido && (
            <Campo label={`Devolución a ${clientePedido} (S/)`}>
              <input type="number" min="0.01" step="0.01" className={inputCls} value={danado.saldo}
                onChange={(e) => setDanado({ ...danado, saldo: e.target.value })} />
            </Campo>
          )}
          <p className="text-xs text-slate-600">
            El producto y la venta no cambian.{clientePedido ? ` Lo indicado en soles pasa a saldo a favor de ${clientePedido} al registrar el reclamo, sin esperar a que llegue el reembolso.` : ''} Cuando el dinero llegue, confirma la fecha y la cuenta.
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnCls} onClick={() => setDanado(null)}>Cancelar</button>
            <button disabled={saving} className={btnPrimaryCls}>
              {saving ? 'Guardando…' : 'Registrar reclamo'}
            </button>
          </div>
        </form>
      ) : (
        !items.some((r) => !cerrado(r) || (r.estado === 'recibido' && !esParcial(r))) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnCls}
              onClick={() => setNuevo(true)}
            >
              Reclamo no llegó
            </button>
            <button
              type="button"
              className={btnCls}
              onClick={() => setDanado({ fecha: hoy(), monto: '', saldo: '' })}
            >
              Reclamo equipo dañado
            </button>
          </div>
        )
      )}
      <ErrorBox error={error} />
    </div>
  );
}
