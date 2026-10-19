import React, { useEffect, useMemo, useState } from 'react';
import { esErrorDePermiso, finanzasApi, limpiarError, METODOS_PAGO, nuevaClave } from '../../services/finanzas';
import { AvisoSesion, btnCls, btnPrimaryCls, Campo, ErrorBox, hoy, inputCls, money } from './ui';

const filaVacia = () => ({ key: nuevaClave(), productoId: '', nombre: '', cantidad: '1', precioUnitario: '', costoUnitario: '' });

export default function VentaRapidaModal({ onClose, onSaved, ventaRelacionadaId }) {
  const [clave, setClave] = useState(nuevaClave);
  const [accesorios, setAccesorios] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [filas, setFilas] = useState([filaVacia()]);
  const [pago, setPago] = useState({ fecha: hoy(), metodo: 'efectivo', estadoCobro: 'pagado', cuentaReceptoraId: '', vendedor: 'Gonzalo', referencia: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    Promise.all([finanzasApi.accesorios(), finanzasApi.cuentas()])
      .then(([a, c]) => { setAccesorios(a || []); setCuentas(c || []); })
      .catch((err) => (esErrorDePermiso(err) ? setSinPermiso(true) : setError(limpiarError(err))));
  }, []);

  const cuentasMetodo = useMemo(() => [...cuentas].sort((a, b) => (b.codigo === 'bcp') - (a.codigo === 'bcp')).filter((c) => c.activo && (
    pago.metodo === 'efectivo' ? ['efectivo', 'tercero'].includes(c.tipo)
      : pago.metodo === 'tarjeta' ? c.tipo === 'procesador'
        : ['banco', 'billetera', 'tercero'].includes(c.tipo))), [cuentas, pago.metodo]);
  useEffect(() => {
    if (!cuentasMetodo.some((c) => String(c.id) === String(pago.cuentaReceptoraId))) {
      setPago((p) => ({ ...p, cuentaReceptoraId: cuentasMetodo[0] ? String(cuentasMetodo[0].id) : '' }));
    }
  }, [cuentasMetodo, pago.cuentaReceptoraId]);

  const setFila = (key, campo, valor) => setFilas((list) => list.map((f) => {
    if (f.key !== key) return f;
    const next = { ...f, [campo]: valor };
    if (campo === 'productoId') {
      const acc = accesorios.find((a) => String(a.productoId) === String(valor));
      next.nombre = acc ? acc.nombre : '';
      next.costoUnitario = acc && acc.costoUnitario != null ? String(acc.costoUnitario) : '';
    }
    return next;
  }));

  const resumen = useMemo(() => {
    let ingreso = 0; let costo = 0; let costoConocido = true;
    for (const f of filas) {
      const qty = Number(f.cantidad) || 0;
      ingreso += Math.round((Number(f.precioUnitario) || 0) * 100) * qty;
      if (f.costoUnitario === '' || f.costoUnitario == null) costoConocido = false;
      else costo += Math.round(Number(f.costoUnitario) * 100) * qty;
    }
    const ganancia = costoConocido ? ingreso - costo : null;
    return { ingreso: ingreso / 100, costo: costoConocido ? costo / 100 : null, ganancia: ganancia == null ? null : ganancia / 100, margen: ganancia != null && ingreso > 0 ? (ganancia / ingreso) * 100 : null };
  }, [filas]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const items = filas.filter((f) => f.productoId || f.nombre.trim());
    if (!items.length) return setError('Agrega al menos un accesorio.');
    for (const f of items) {
      if (!(Number(f.cantidad) >= 1)) return setError('Cantidad inválida.');
      if (!(Number(f.precioUnitario) >= 0) || f.precioUnitario === '') return setError('Indica el precio de cada accesorio.');
      const acc = f.productoId && accesorios.find((a) => String(a.productoId) === String(f.productoId));
      if (acc && Number(f.cantidad) > acc.stock) return setError(`Solo quedan ${acc.stock} unidades de ${acc.nombre}.`);
    }
    setSaving(true);
    try {
      const res = await finanzasApi.ventaRapida({
        fecha: pago.fecha, metodo: pago.metodo, estadoCobro: pago.estadoCobro,
        cuentaReceptoraId: pago.cuentaReceptoraId ? Number(pago.cuentaReceptoraId) : undefined,
        vendedor: pago.vendedor || undefined, referencia: pago.referencia || undefined,
        ventaRelacionadaId: ventaRelacionadaId || undefined, idempotencyKey: clave,
        items: items.map((f) => ({
          productoId: f.productoId ? Number(f.productoId) : undefined,
          nombre: f.productoId ? undefined : f.nombre.trim(),
          cantidad: Number(f.cantidad), precioUnitario: Number(f.precioUnitario),
          costoUnitario: f.productoId || f.costoUnitario === '' ? undefined : Number(f.costoUnitario),
        })),
      });
      setResultado(res);
      onSaved?.(res);
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };

  const nueva = () => { setResultado(null); setFilas([filaVacia()]); setClave(nuevaClave()); };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Venta rápida de accesorios">
      <div className="max-h-[94vh] w-full overflow-y-auto rounded-t-2xl bg-white p-4 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Venta rápida de accesorios</h2>
            <p className="text-xs text-slate-500">Cargadores, cables, micas… sin ficha técnica. {ventaRelacionadaId ? `Se agrupa con la venta #${ventaRelacionadaId}.` : ''}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full px-2 text-2xl leading-none text-slate-500 hover:bg-slate-100">×</button>
        </div>
        {sinPermiso ? <AvisoSesion /> : resultado ? (
          <div className="space-y-3">
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              {resultado.repetida ? 'Esta venta ya estaba registrada (no se duplicó).' : `Se registraron ${resultado.ventas.length} venta(s).`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className={btnCls} onClick={nueva}>Otra venta</button>
              <button type="button" className={btnPrimaryCls} onClick={onClose}>Listo</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-2">
              {filas.map((f) => {
                const acc = f.productoId && accesorios.find((a) => String(a.productoId) === String(f.productoId));
                return (
                  <div key={f.key} className="grid grid-cols-6 gap-2 rounded-xl border border-slate-200 p-2 sm:grid-cols-12">
                    <Campo label="Accesorio" className="col-span-6 sm:col-span-5">
                      <select className={inputCls} value={f.productoId} onChange={(e) => setFila(f.key, 'productoId', e.target.value)}>
                        <option value="">No está en inventario</option>
                        {accesorios.map((a) => <option key={a.productoId} value={a.productoId}>{a.nombre} · {a.stock} en stock</option>)}
                      </select>
                      {!f.productoId && <input className={`${inputCls} mt-1`} placeholder="Nombre (p. ej. Mica iPhone 15)" value={f.nombre} onChange={(e) => setFila(f.key, 'nombre', e.target.value)} />}
                    </Campo>
                    <Campo label="Cant." className="col-span-2 sm:col-span-2"><input className={inputCls} inputMode="numeric" value={f.cantidad} onChange={(e) => setFila(f.key, 'cantidad', e.target.value)} /></Campo>
                    <Campo label="Precio unit." className="col-span-2 sm:col-span-2"><input className={inputCls} inputMode="decimal" value={f.precioUnitario} onChange={(e) => setFila(f.key, 'precioUnitario', e.target.value)} /></Campo>
                    <Campo label="Costo unit." className="col-span-2 sm:col-span-2">
                      <input className={`${inputCls} ${acc ? 'bg-slate-50' : ''}`} inputMode="decimal" value={f.costoUnitario} readOnly={!!acc}
                        placeholder={acc ? '' : 'Desconocido'} title={acc ? 'Costo del inventario (FIFO)' : 'Déjalo vacío si no lo sabes'}
                        onChange={(e) => setFila(f.key, 'costoUnitario', e.target.value)} />
                    </Campo>
                    <div className="col-span-6 flex items-end justify-end sm:col-span-1">
                      {filas.length > 1 && <button type="button" className="pb-1.5 text-xs text-red-700 hover:underline" onClick={() => setFilas((l) => l.filter((x) => x.key !== f.key))}>Quitar</button>}
                    </div>
                  </div>
                );
              })}
              <button type="button" className="text-sm font-medium text-indigo-700 hover:underline" onClick={() => setFilas((l) => [...l, filaVacia()])}>+ Agregar otro accesorio</button>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-center text-xs sm:grid-cols-4">
              <div>Ingreso<strong className="block text-sm text-slate-900">{money(resumen.ingreso)}</strong></div>
              <div>Costo<strong className="block text-sm text-slate-900">{resumen.costo == null ? 'Pendiente' : money(resumen.costo)}</strong></div>
              <div>Ganancia bruta<strong className="block text-sm text-slate-900">{resumen.ganancia == null ? 'Pendiente' : money(resumen.ganancia)}</strong></div>
              <div>Margen<strong className="block text-sm text-slate-900">{resumen.margen == null ? '—' : `${resumen.margen.toFixed(1)}%`}</strong></div>
            </div>
            {resumen.costo == null && <p className="text-xs text-amber-800">Hay accesorios sin costo: la venta se guarda con utilidad pendiente de calcular (no se asume costo cero).</p>}

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Campo label="Fecha"><input type="date" className={inputCls} value={pago.fecha} onChange={(e) => setPago({ ...pago, fecha: e.target.value })} /></Campo>
              <Campo label="Cobro">
                <select className={inputCls} value={pago.estadoCobro} onChange={(e) => setPago({ ...pago, estadoCobro: e.target.value })}>
                  <option value="pagado">Pagado</option><option value="pendiente">Por cobrar</option>
                </select>
              </Campo>
              <Campo label="Método">
                <select className={inputCls} value={pago.metodo} onChange={(e) => setPago({ ...pago, metodo: e.target.value })}>
                  {METODOS_PAGO.filter(([v]) => v !== 'x500').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Campo>
              <Campo label="Cuenta">
                <select className={inputCls} value={pago.cuentaReceptoraId} onChange={(e) => setPago({ ...pago, cuentaReceptoraId: e.target.value })}>
                  {cuentasMetodo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Campo>
              <Campo label="Vendedor">
                <select className={inputCls} value={pago.vendedor} onChange={(e) => setPago({ ...pago, vendedor: e.target.value })}>
                  <option value="Gonzalo">Gonzalo</option><option value="Renato">Renato</option><option value="Ambos">Ambos</option><option value="">Sin asignar</option>
                </select>
              </Campo>
              <Campo label="Referencia" className="col-span-1 sm:col-span-3"><input className={inputCls} value={pago.referencia} onChange={(e) => setPago({ ...pago, referencia: e.target.value })} /></Campo>
            </div>
            <ErrorBox error={error} />
            <div className="flex justify-end gap-2">
              <button type="button" className={btnCls} onClick={onClose}>Cancelar</button>
              <button type="submit" className={btnPrimaryCls} disabled={saving}>{saving ? 'Registrando…' : 'Registrar venta'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
