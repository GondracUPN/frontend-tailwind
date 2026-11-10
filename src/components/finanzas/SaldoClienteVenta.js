import { cambioSaldoAplicado } from '../../utils/saldoCambio';
import { SALES_UPDATED_EVENT } from '../../utils/salesSync';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  finanzasApi,
  limpiarError,
  nuevaClave,
  sesionFinanciera,
} from '../../services/finanzas';
import {
  btnCls,
  btnPrimaryCls,
  Campo,
  ErrorBox,
  fecha,
  hoy,
  inputCls,
  money,
} from './ui';

export default function SaldoClienteVenta({
  ventaId,
  vendedor,
  precio = 0,
  onChange,
  onDone,
  aplicarSaldo,
}) {
  const contexto = `${ventaId || ''}:${vendedor || ''}`;
  const contextoActual = useRef(contexto);
  contextoActual.current = contexto;
  const [cliente, setCliente] = useState(null);
  const selected = cliente?.id;
  const [historia, setHistoria] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [aplicarInterno, setAplicar] = useState(false),
    [monto, setMonto] = useState(''),
    [dia, setDia] = useState(hoy);
  const aplicar = aplicarSaldo ?? aplicarInterno;
  const [montoEditado, setMontoEditado] = useState(false);
  const [pagado, setPagado] = useState(''),
    [fechaPago, setFechaPago] = useState(hoy),
    [cuenta, setCuenta] = useState(''),
    [cuentas, setCuentas] = useState([]);
  const [clave, setClave] = useState(nuevaClave),
    [devolver, setDevolver] = useState(false);
  const autorizado = sesionFinanciera().esAdmin;
  const esPedido = /^gonzalo\s*\([^)]+\)$/i.test(String(vendedor || '').trim());
  const cargar = useCallback(
    async (activo = () => true) => {
      if (!autorizado || (!ventaId && !esPedido)) return;
      try {
        const c = await finanzasApi.resolverClientePedido(
          ventaId ? { ventaId } : { vendedor },
        );
        const h = c ? await finanzasApi.saldosCliente(c.id) : null;
        if (!activo() || contextoActual.current !== contexto) return;
        setCliente(c);
        setHistoria(h);
        setError('');
      } catch (err) {
        if (activo() && contextoActual.current === contexto)
          setError(limpiarError(err));
      }
    },
    [autorizado, ventaId, vendedor, esPedido, contexto],
  );
  useEffect(() => {
    let activo = true;
    setCliente(null);
    setHistoria(null);
    setAplicar(false);
    setMontoEditado(false);
    setDevolver(false);
    cargar(() => activo);
    const actualizar = () => cargar(() => activo);
    window.addEventListener(SALES_UPDATED_EVENT, actualizar);
    return () => {
      activo = false;
      window.removeEventListener(SALES_UPDATED_EVENT, actualizar);
    };
  }, [cargar]);
  useEffect(() => {
    if (aplicarSaldo === undefined) return;
    if (!aplicarSaldo) {
      setMontoEditado(false);
      setPagado('');
      return;
    }
    const limite = Math.min(Number(historia?.disponible || 0), Number(precio));
    if (!montoEditado || Number(monto) > limite) setMonto(limite > 0 ? String(limite) : '');
  }, [aplicarSaldo, historia?.disponible, precio, montoEditado, monto]);
  useEffect(() => {
    if (!autorizado || !aplicar) return;
    finanzasApi
      .cuentas()
      .then(setCuentas)
      .catch((e) => setError(limpiarError(e)));
  }, [aplicar, autorizado]);
  const externo = cliente?.clase === 'externo' && cliente?.admite_saldo;
  const restante = Math.max(
    0,
    Math.round((Number(precio) - Number(monto || 0)) * 100) / 100,
  );
  const cambio =
    aplicar && externo
      ? cambioSaldoAplicado(historia?.saldos || [], Number(monto), dia)
      : null;
  const tipoCambioSaldo = cambio?.tipoCambio;
  useEffect(() => {
    onChange?.({
      saldoDisponible: externo ? Number(historia?.disponible || 0) : 0,
      admiteSaldo: Boolean(externo),
      tipoCambioSaldo,
      clienteId: selected ? Number(selected) : undefined,
      saldoCliente:
        aplicar && externo
          ? {
              monto: Number(monto),
              fecha: dia,
              operacion: clave,
              pagoAdicional: pagado === 'si',
              fechaPago: pagado === 'si' ? fechaPago : undefined,
              cuentaId: pagado === 'si' ? Number(cuenta) : undefined,
            }
          : undefined,
      valido:
        !aplicar ||
        Boolean(
          Number(tipoCambioSaldo) > 0 &&
            Number(monto) > 0 &&
            Number(monto) <= Number(historia?.disponible || 0) &&
            Number(monto) <= Number(precio) &&
            (!restante ||
              pagado === 'no' ||
              (pagado === 'si' && fechaPago && cuenta)),
        ),
    });
  }, [
    selected,
    tipoCambioSaldo,
    aplicar,
    externo,
    monto,
    dia,
    clave,
    pagado,
    fechaPago,
    cuenta,
    historia,
    precio,
    restante,
    onChange,
  ]);
  if (!autorizado || (!ventaId && !esPedido)) return null;
  if (!cliente) return error ? <ErrorBox error={error} /> : null;
  if (aplicarSaldo !== undefined && historia && Number(historia.disponible) <= 0) return error ? <ErrorBox error={error} /> : null;
  // Venta ya pagada: no hay nada a qué aplicar el saldo; solo se resume y se ofrece el historial plegado.
  const compacto = Boolean(ventaId) && !(Number(precio) > 0);
  if (compacto && !externo) return error ? <ErrorBox error={error} /> : null;
  const Contenedor = compacto ? 'details' : 'section';
  const otrosSaldos = (historia?.saldos || []).filter(s => !s.anulada_at &&
    !(historia?.devoluciones || []).some(d => d.venta_id != null
      ? Number(d.venta_id) === Number(s.venta_id) : Number(d.sku) === Number(s.sku)));
  const historial = <>
    {(historia?.devoluciones || []).length ? <div className="overflow-x-auto">
      <table className="mt-2 w-full text-xs">
        <thead><tr><th>Producto / fecha</th><th>Precio de venta</th><th>Saldo generado por lo pagado</th><th>Importe sin pagar</th><th>Saldo disponible</th><th>Qué pasó</th></tr></thead>
        <tbody>{historia.devoluciones.map(d => <tr key={d.id}>
          <td>SKU {d.sku} · {fecha(d.fecha)}</td>
          <td>{money(d.precio_venta)}</td><td>{money(d.saldo_generado)}</td><td>{money(d.importe_sin_pagar)}</td><td>{money(d.disponible)}</td>
          <td>{d.motivo} · {d.estado === 'recibido' ? 'Reembolso recibido' : d.estado === 'reclamo_abierto' ? 'Reclamo pendiente' : d.estado}</td>
        </tr>)}</tbody>
      </table>
    </div> : <p className="mt-2 text-sm text-slate-500">No hay productos devueltos.</p>}
    {otrosSaldos.length > 0 && <div className="mt-3 overflow-x-auto">
      <p className="text-xs font-semibold">Saldos recuperados de ventas anuladas y otros saldos</p>
      <table className="mt-2 w-full text-xs" aria-label="Otros orígenes del saldo a favor">
        <thead><tr><th>Producto / fecha</th><th>Saldo generado</th><th>Saldo disponible</th><th>Origen</th></tr></thead>
        <tbody>{otrosSaldos.map(s => <tr key={s.id}>
          <td>SKU {s.sku} · {fecha(s.fecha)}</td><td>{money(s.original)}</td><td>{money(s.disponible)}</td>
          <td>{s.origen_saldo === 'saldo_recuperado' ? 'Saldo utilizado recuperado al anular la venta'
            : s.origen_saldo === 'pago_recuperado' ? 'Dinero pagado recuperado al anular la venta'
              : 'Pago convertido en saldo a favor'}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    <p className="mt-2 text-xs font-medium">Total disponible de todos los orígenes: {money(historia?.disponible || 0)}</p>
    <ul className="mt-2 space-y-1 text-xs">{(historia?.movimientos || []).map(m => <li key={m.id}>
      {fecha(m.fecha)} · {m.tipo === 'aplicacion' ? 'Saldo utilizado' : 'Dinero devuelto al cliente'} · SKU {m.sku_origen} → {m.sku_destino || 'cliente'} · {money(m.monto)}
      {m.tipo === 'aplicacion' && m.saldo_recuperado && ' · Recuperado como saldo al anular la venta'}
    </li>)}</ul>
  </>;
  const ejecutar = async (fn) => {
    setBusy(true);
    setError('');
    try {
      await fn();
      setClave(nuevaClave());
      setAplicar(false);
      setDevolver(false);
      await cargar();
      onDone?.();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Contenedor aria-label={`Saldo de ${cliente.nombre}`} className={`space-y-3 rounded-xl border border-slate-200 bg-slate-50 text-sm ${compacto ? 'px-3 py-2' : 'p-3'}`}>
      {compacto ? (
        <summary className="cursor-pointer">
          <span className="font-medium">{cliente.nombre} tiene {money(historia?.disponible || 0)} a favor</span>
          <span className="ml-2 text-xs text-slate-500">Ver historial y devolver saldo</span>
        </summary>
      ) : <p className="font-semibold">Saldo de {cliente.nombre}</p>}
      {externo && historia && (
        <>
          {!compacto && <p className="font-semibold">
            Saldo a favor del cliente: {money(historia.disponible)}
          </p>}
          {!compacto && Number(historia.disponible) > 0 && <p className="text-xs text-slate-600">Se utiliza primero el saldo disponible más pequeño y después los mayores.</p>}
          {!compacto && Number(historia.disponible) > 0 && !(Number(precio) > 0) && (
            <p className="text-xs text-slate-600">
              Ingresa el precio del nuevo producto para aplicar el saldo
              disponible.
            </p>
          )}
          {compacto ? <div><p className="text-xs font-medium text-slate-600">Historial de productos devueltos de {cliente.nombre}</p>{historial}</div> : <details>
            <summary className="cursor-pointer">Historial de productos devueltos de {cliente.nombre}</summary>
            {historial}
          </details>}
          {aplicarSaldo === undefined && Number(historia.disponible) > 0 && Number(precio) > 0 && (
            <label className="flex gap-2">
              <input
                type="checkbox"
                checked={aplicar}
                onChange={(e) => {
                  setAplicar(e.target.checked);
                  setMonto(
                    String(
                      Math.min(Number(historia.disponible), Number(precio)),
                    ),
                  );
                  setPagado('');
                }}
              />
              Aplicar saldo a favor
            </label>
          )}
          {aplicar && !devolver && (
            <div className="space-y-2">
              <Campo label="Saldo que se utilizará (S/)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  max={Math.min(Number(historia.disponible), Number(precio))}
                  className={inputCls}
                  value={monto}
                  onChange={(e) => { setMontoEditado(true); setMonto(e.target.value); }}
                />
              </Campo>
              <div
                className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
                aria-label="Cambio histórico del saldo"
              >
                <p>
                  Tipo de cambio histórico aplicado:{' '}
                  <strong>
                    {cambio ? cambio.tipoCambio.toFixed(4) : 'Por calcular'}
                  </strong>
                </p>
                {cambio?.partes.map((p) => (
                  <p key={p.saldoId}>
                    SKU {p.sku} · {money(p.monto)} · TC{' '}
                    {p.tipoCambio.toFixed(4)}
                  </p>
                ))}
                {cambio && <p>Equivalente histórico del saldo utilizado: US$ {cambio.equivalenteUsd.toFixed(2)}</p>}
              </div>
              <Campo label="Fecha de aplicación del saldo">
                <input
                  type="date"
                  className={inputCls}
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </Campo>
              <p>
                Saldo restante:{' '}
                {money(Number(historia.disponible) - Number(monto || 0))} ·
                Diferencia pendiente: {money(restante)}
              </p>
              {restante > 0 && (
                <Campo
                  label={
                    '¿El cliente ya pagó los ' + money(restante) + ' restantes?'
                  }
                >
                  <select
                    className={inputCls}
                    value={pagado}
                    onChange={(e) => setPagado(e.target.value)}
                  >
                    <option value="">Selecciona</option>
                    <option value="si">Sí, ya pagó</option>
                    <option value="no">No, todavía debe el dinero</option>
                  </select>
                </Campo>
              )}
              {restante > 0 && pagado === 'si' && (
                <>
                  <Campo label="Fecha del pago adicional">
                    <input
                      required
                      type="date"
                      className={inputCls}
                      value={fechaPago}
                      onChange={(e) => setFechaPago(e.target.value)}
                    />
                  </Campo>
                  <Campo label="Cuenta que recibe">
                    <select
                      required
                      className={inputCls}
                      value={cuenta}
                      onChange={(e) => setCuenta(e.target.value)}
                    >
                      <option value="">Selecciona</option>
                      {cuentas
                        .filter(
                          (c) =>
                            c.activo &&
                            ['banco', 'efectivo', 'billetera'].includes(c.tipo),
                        )
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nombre}
                          </option>
                        ))}
                    </select>
                  </Campo>
                </>
              )}
              {ventaId && (
                <button
                  type="button"
                  disabled={busy || !Number(monto) || (restante > 0 && !pagado)}
                  className={btnPrimaryCls}
                  onClick={() =>
                    ejecutar(() =>
                      finanzasApi.aplicarSaldo(ventaId, {
                        monto: Number(monto),
                        fecha: dia,
                        operacion: clave,
                        pagoAdicional: pagado === 'si',
                        fechaPago: pagado === 'si' ? fechaPago : undefined,
                        cuentaId: pagado === 'si' ? Number(cuenta) : undefined,
                      }),
                    )
                  }
                >
                  Confirmar aplicación del saldo
                </button>
              )}
            </div>
          )}
          {Number(historia.disponible) > 0 && ventaId && (
            <button
              type="button"
              className={btnCls}
              onClick={() => {
                setDevolver(true);
                setAplicar(true);
                setMonto('');
              }}
            >
              Devolver saldo a favor
            </button>
          )}
          {devolver && (
            <div className="space-y-2">
              <p>
                Devolución de saldo a favor: {money(monto)} a {cliente.nombre}
              </p>
              <Campo label="Importe a devolver (S/)">
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={inputCls}
                  value={monto}
                  onChange={(e) => setMonto(e.target.value)}
                />
              </Campo>
              <Campo label="Fecha de devolución">
                <input
                  type="date"
                  className={inputCls}
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </Campo>
              <Campo label="Cuenta de salida">
                <select
                  className={inputCls}
                  value={cuenta}
                  onChange={(e) => setCuenta(e.target.value)}
                >
                  <option value="">Selecciona</option>
                  {cuentas
                    .filter(
                      (c) =>
                        c.activo &&
                        ['banco', 'efectivo', 'billetera'].includes(c.tipo),
                    )
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </Campo>
              <button
                type="button"
                className={btnPrimaryCls}
                disabled={busy || !cuenta || !Number(monto)}
                onClick={() =>
                  ejecutar(() =>
                    finanzasApi.devolverSaldo(Number(selected), {
                      monto: Number(monto),
                      fecha: dia,
                      cuentaId: Number(cuenta),
                      operacion: clave,
                    }),
                  )
                }
              >
                Confirmar devolución
              </button>
            </div>
          )}
        </>
      )}
      <ErrorBox error={error} />
    </Contenedor>
  );
}
