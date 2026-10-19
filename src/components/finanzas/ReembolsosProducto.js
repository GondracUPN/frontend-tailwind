import React, { useCallback, useEffect, useState } from 'react';
import { esErrorDePermiso, finanzasApi, limpiarError, nuevaClave } from '../../services/finanzas';
import { btnCls, btnPrimaryCls, Campo, ErrorBox, Estado, fecha, hoy, inputCls, money } from './ui';

const EVENTOS = [
  ['reclamo', 'Reclamación abierta'],
  ['aprobado', 'Reembolso aprobado'],
  ['recibido', 'Reembolso recibido'],
  ['gasto_adicional', 'Gasto adicional'],
  ['rechazado', 'Reembolso rechazado'],
  ['perdida', 'Pérdida definitiva'],
  ['nota', 'Nota'],
];
const CON_MONTO = ['reclamo', 'aprobado', 'recibido', 'gasto_adicional'];

function FormEvento({ reembolso, cuentas, onDone, onCancel }) {
  const [clave] = useState(nuevaClave);
  const [form, setForm] = useState({ tipo: 'reclamo', fecha: hoy(), monto: '', moneda: reembolso.moneda, tipoCambio: '', cuentaId: reembolso.cuentaDevolucionId ? String(reembolso.cuentaDevolucionId) : '', nota: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const destino = cuentas.filter((c) => c.activo && ['banco', 'billetera', 'efectivo', 'tarjeta_credito', 'proveedor'].includes(c.tipo));
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await finanzasApi.eventoReembolso(reembolso.id, {
        tipo: form.tipo, fecha: form.fecha, monto: CON_MONTO.includes(form.tipo) ? Number(form.monto) : undefined,
        moneda: form.moneda, tipoCambio: form.moneda === 'USD' && form.tipoCambio ? Number(form.tipoCambio) : undefined,
        cuentaId: form.tipo === 'recibido' && form.cuentaId ? Number(form.cuentaId) : undefined, nota: form.nota || undefined,
        idempotencyKey: clave,
      });
      onDone();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };
  const cuentaSel = destino.find((c) => String(c.id) === String(form.cuentaId));
  return (
    <form onSubmit={submit} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Campo label="Acontecimiento">
          <select className={inputCls} value={form.tipo} onChange={set('tipo')}>{EVENTOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </Campo>
        <Campo label="Fecha"><input type="date" className={inputCls} value={form.fecha} onChange={set('fecha')} required /></Campo>
        {CON_MONTO.includes(form.tipo) && (
          <>
            <Campo label={form.tipo === 'gasto_adicional' ? 'Importe (S/)' : `Importe (${form.moneda})`}><input className={inputCls} inputMode="decimal" value={form.monto} onChange={set('monto')} required /></Campo>
            {form.tipo !== 'gasto_adicional' && (
              <Campo label="Moneda"><select className={inputCls} value={form.moneda} onChange={set('moneda')}><option value="PEN">PEN</option><option value="USD">USD</option></select></Campo>
            )}
          </>
        )}
        {form.moneda === 'USD' && form.tipo === 'recibido' && <Campo label="Tipo de cambio del día"><input className={inputCls} inputMode="decimal" value={form.tipoCambio} onChange={set('tipoCambio')} /></Campo>}
        {form.tipo === 'recibido' && (
          <Campo label="Llegó a" className="col-span-2">
            <select className={inputCls} value={form.cuentaId} onChange={set('cuentaId')} required>
              <option value="">Selecciona</option>
              {destino.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Nota" className="col-span-2"><input className={inputCls} value={form.nota} onChange={set('nota')} /></Campo>
      </div>
      {cuentaSel?.tipo === 'tarjeta_credito' && <p className="text-xs text-sky-800">Se registrará como abono a la tarjeta: reduce su deuda en Gastos y no cuenta como depósito.</p>}
      <ErrorBox error={error} />
      <div className="flex justify-end gap-2">
        <button type="button" className={btnCls} onClick={onCancel}>Cancelar</button>
        <button type="submit" className={btnPrimaryCls} disabled={saving}>{saving ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

export default function ReembolsosProducto({ producto, onChanged }) {
  const [items, setItems] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const [form, setForm] = useState({ fechaIncidencia: hoy(), motivo: '', moneda: 'USD', montoReclamado: '', gastosAdicionales: '', costoOriginal: '', cuentaDevolucionId: '', estado: 'incidencia' });
  const [evento, setEvento] = useState(null);
  const [saving, setSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, c] = await Promise.all([finanzasApi.reembolsos({ productoId: producto.id }), finanzasApi.cuentas()]);
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
  useEffect(() => { cargar(); }, [cargar]);

  const refrescar = async () => { setEvento(null); setNuevo(false); await cargar(); onChanged?.(); };
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const crear = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await finanzasApi.crearReembolso({
        productoId: producto.id, estado: form.estado, fechaIncidencia: form.fechaIncidencia, motivo: form.motivo || undefined,
        moneda: form.moneda, montoReclamado: form.montoReclamado ? Number(form.montoReclamado) : undefined,
        gastosAdicionales: form.gastosAdicionales ? Number(form.gastosAdicionales) : undefined,
        costoOriginal: form.costoOriginal ? Number(form.costoOriginal) : undefined,
        cuentaDevolucionId: form.cuentaDevolucionId ? Number(form.cuentaDevolucionId) : undefined,
      });
      await refrescar();
    } catch (err) {
      setError(limpiarError(err));
    } finally {
      setSaving(false);
    }
  };

  const cerrar = async (motivo) => {
    try {
      await finanzasApi.cerrarProducto(producto.id, motivo);
      onChanged?.();
      await cargar();
    } catch (err) {
      setError(limpiarError(err));
    }
  };

  if (sinPermiso) return null; // Sin sesión de administrador no se muestra este bloque.
  if (loading) return <p className="text-sm text-slate-500">Cargando reclamaciones…</p>;
  const abierto = items.some((r) => !['recibido', 'rechazado', 'perdida_definitiva'].includes(r.estado));

  return (
    <div className="space-y-2">
      {items.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm"><Estado value={r.estado} /><span className="text-slate-600">desde {fecha(r.fechaIncidencia)}</span></div>
            {!['recibido', 'rechazado', 'perdida_definitiva'].includes(r.estado) && evento !== r.id && (
              <button type="button" className={btnCls} onClick={() => setEvento(r.id)}>Registrar avance</button>
            )}
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-4">
            <div><dt className="text-slate-500">Costo invertido</dt><dd className="font-medium tabular-nums">{money(r.resumen.invertido)}</dd></div>
            <div><dt className="text-slate-500">Reclamado</dt><dd className="font-medium tabular-nums">{r.moneda} {Number(r.montoReclamado).toFixed(2)}</dd></div>
            <div><dt className="text-slate-500">Recibido</dt><dd className="font-medium tabular-nums">{money(r.resumen.recibido)}</dd></div>
            <div><dt className="text-slate-500">{r.resumen.cerrado ? 'Irrecuperable' : 'Por recuperar'}</dt><dd className={`font-medium tabular-nums ${r.resumen.irrecuperable ? 'text-red-700' : ''}`}>{money(r.resumen.cerrado ? r.resumen.irrecuperable : r.resumen.porRecuperar)}</dd></div>
          </dl>
          {(r.eventos || []).length > 0 && (
            <ul className="mt-2 space-y-0.5 border-l border-slate-200 pl-3 text-xs text-slate-600">
              {r.eventos.map((e) => <li key={e.id}>{fecha(e.fecha)} · {(EVENTOS.find(([v]) => v === e.tipo) || [null, e.tipo])[1]}{e.monto ? ` · ${e.moneda} ${Number(e.monto).toFixed(2)}` : ''}{e.nota ? ` · ${e.nota}` : ''}</li>)}
            </ul>
          )}
          {evento === r.id && <FormEvento reembolso={r} cuentas={cuentas} onDone={refrescar} onCancel={() => setEvento(null)} />}
        </div>
      ))}
      {items.length === 0 && !nuevo && <p className="text-xs text-slate-500">Sin incidencias. Si el producto se perdió o no llegó, registra la reclamación para seguir el reembolso.</p>}
      {nuevo ? (
        <form onSubmit={crear} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Campo label="Estado inicial">
              <select className={inputCls} value={form.estado} onChange={set('estado')}>
                <option value="en_transito">En tránsito (seguimiento)</option><option value="incidencia">Incidencia reportada</option><option value="reclamo_abierto">Reclamación abierta</option>
              </select>
            </Campo>
            <Campo label="Fecha"><input type="date" className={inputCls} value={form.fechaIncidencia} onChange={set('fechaIncidencia')} /></Campo>
            <Campo label="Moneda del reclamo"><select className={inputCls} value={form.moneda} onChange={set('moneda')}><option value="USD">USD</option><option value="PEN">PEN</option></select></Campo>
            <Campo label="Importe reclamado"><input className={inputCls} inputMode="decimal" value={form.montoReclamado} onChange={set('montoReclamado')} placeholder="Valor de compra" /></Campo>
            <Campo label="Costo original S/ (opcional)"><input className={inputCls} inputMode="decimal" value={form.costoOriginal} onChange={set('costoOriginal')} placeholder="Del producto" /></Campo>
            <Campo label="Gastos adicionales S/"><input className={inputCls} inputMode="decimal" value={form.gastosAdicionales} onChange={set('gastosAdicionales')} /></Campo>
            <Campo label="Devolución a" className="col-span-2">
              <select className={inputCls} value={form.cuentaDevolucionId} onChange={set('cuentaDevolucionId')}>
                <option value="">Por definir</option>
                {cuentas.filter((c) => c.activo && ['banco', 'billetera', 'tarjeta_credito', 'proveedor'].includes(c.tipo)).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Campo>
          </div>
          <Campo label="Motivo"><input className={inputCls} value={form.motivo} onChange={set('motivo')} placeholder="Ej. paquete perdido por el transportista" /></Campo>
          <ErrorBox error={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className={btnCls} onClick={() => setNuevo(false)}>Cancelar</button>
            <button type="submit" className={btnPrimaryCls} disabled={saving}>{saving ? 'Guardando…' : 'Registrar'}</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {!abierto && <button type="button" className={btnCls} onClick={() => setNuevo(true)}>Reportar incidencia / reembolso</button>}
          {producto.cierreMotivo
            ? <button type="button" className={btnCls} onClick={() => cerrar('reabrir')}>Reabrir producto ({producto.cierreMotivo.replace('_', ' ')})</button>
            : <button type="button" className={btnCls} onClick={() => { if (window.confirm('¿Cerrar el producto como no comercializable? Su historial se conserva.')) cerrar('no_comercializable'); }}>Cerrar como no comercializable</button>}
        </div>
      )}
      {!nuevo && <ErrorBox error={error} />}
    </div>
  );
}
