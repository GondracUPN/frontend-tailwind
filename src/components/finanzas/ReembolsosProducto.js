import React, { useCallback, useEffect, useState } from 'react';
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
const cerrado = (r) =>
  ['recibido', 'rechazado', 'perdida_definitiva'].includes(r.estado);

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
        <h3 className="font-semibold">Registrar reembolso recibido</h3>
        <p className="text-sm">
          Compra · SKU {producto.codigoInventario || producto.id}
        </p>
        <p className="text-sm">
          Importe original reclamado:{' '}
          <strong>
            {reclamo.moneda} {Number(reclamo.montoReclamado).toFixed(2)}
          </strong>
        </p>
        {pendiente !== Number(reclamo.montoReclamado) && (
          <p>
            Pendiente: {reclamo.moneda} {pendiente.toFixed(2)}
          </p>
        )}
        <Campo label="Fecha del reembolso">
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

export default function ReembolsosProducto({ producto, onChanged }) {
  const [items, setItems] = useState([]),
    [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true),
    [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState(''),
    [nuevo, setNuevo] = useState(false),
    [motivo, setMotivo] = useState('');
  const [evento, setEvento] = useState(null),
    [saving, setSaving] = useState(false);
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
    await cargar();
    onChanged?.();
  };
  const crear = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await finanzasApi.crearReembolso({ productoId: producto.id, motivo });
      await refrescar();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };
  if (sinPermiso) return null;
  if (loading)
    return <p className="text-sm text-slate-500">Cargando reclamos…</p>;
  return (
    <div className="space-y-3">
      {items.map((r) => (
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
                Registrar reembolso recibido
              </button>
            )}
          </div>
          <p>{r.motivo}</p>
          <p>
            Reclamado: {r.moneda} {Number(r.montoReclamado).toFixed(2)}
          </p>
          <p className="text-slate-600">
            Cargo original conservado · costo de compra {money(r.costoOriginal)}
          </p>
          <ul className="border-l pl-3 text-xs text-slate-600">
            {(r.eventos || []).map((e) => (
              <li key={e.id}>
                {fecha(e.fecha)} ·{' '}
                {e.tipo === 'recibido'
                  ? 'Reembolso recibido'
                  : e.tipo === 'incidencia'
                    ? 'Reclamo pendiente'
                    : e.tipo}
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
            <div>Fecha del reclamo: {fecha(hoy())}</div>
            <div>
              Importe reclamado: USD{' '}
              {producto.valor?.monedaCompra === 'USD'
                ? Number(producto.valor.valorProducto).toFixed(2)
                : 'Sin compra original en USD'}
            </div>
          </div>
          <p className="text-xs text-slate-600">
            El reclamo queda pendiente hasta confirmar el reembolso recibido.
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
      ) : (
        !items.some((r) => !cerrado(r) || r.estado === 'recibido') && (
          <button
            type="button"
            className={btnCls}
            onClick={() => setNuevo(true)}
          >
            Reclamo no llegó
          </button>
        )
      )}
      <ErrorBox error={error} />
    </div>
  );
}
