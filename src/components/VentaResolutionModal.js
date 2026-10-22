import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { nuevaClave } from '../services/finanzas';
import { notifySalesChanged } from '../utils/salesSync';

export default function VentaResolutionModal({ ventaId, onClose, onSaved }) {
  const key = useRef(nuevaClave());
  const [data, setData] = useState(null);
  const [cuentas, setCuentas] = useState([]);
  const [form, setForm] = useState({ cantidad: '1', monto: '', destino: 'revision', fecha: new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }), motivo: '', cuentaId: '' });
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([api.get(`/ventas/${ventaId}`), api.get('/finanzas/cuentas'), api.get(`/ventas/${ventaId}/devoluciones`)])
      .then(([venta, c, devoluciones]) => {
        if (!active) return;
        setData({ venta, restantes: Number(venta.cantidad || 1) - (devoluciones || []).reduce((sum, d) => sum + d.cantidad, 0) });
        setCuentas((c || []).filter((x) => x.activo && x.moneda === 'PEN' && ['banco', 'billetera', 'efectivo'].includes(x.tipo)));
      }).catch((e) => active && setError(e.message));
    return () => { active = false; };
  }, [ventaId]);
  const field = (name) => ({ value: form[name], onChange: (e) => setForm({ ...form, [name]: e.target.value }) });
  const save = async (digitacion = false) => {
    if (busy) return;
    if (form.motivo.trim().length < 3) return setError('Indica el motivo.');
    setBusy(true); setError('');
    try {
      if (digitacion) await api.del(`/ventas/${ventaId}`, { motivo: form.motivo });
      else await api.post(`/ventas/${ventaId}/devoluciones`, { ...form, cantidad: Number(form.cantidad), monto: Number(form.monto),
        cuentaId: form.cuentaId ? Number(form.cuentaId) : undefined, operacionKey: key.current });
      notifySalesChanged({ action: digitacion ? 'delete' : 'return', ventaId });
      onSaved?.();
    } catch (e) { setError(e.message || 'No se pudo guardar la devolución.'); }
    finally { setBusy(false); }
  };
  return <div role="dialog" aria-modal="true" aria-label="Devolver o corregir venta" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4">
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="max-h-[94vh] w-full max-w-lg space-y-3 overflow-auto rounded-xl bg-white p-5">
      <h2 className="text-lg font-semibold">Devolver o corregir venta #{ventaId}</h2>
      <p className="text-sm">La devolución conserva el historial. Solo las unidades recibidas como disponibles vuelven al stock de venta.</p>
      {!data && !error && <p>Cargando venta…</p>}
      {data && <>
        <p>Unidades que se pueden devolver: {data.restantes}</p>
        <label className="block">Cantidad<input aria-label="Cantidad devuelta" className="block w-full border p-2" type="number" min="1" max={data.restantes} required {...field('cantidad')} /></label>
        <label className="block">Dinero devuelto (S/)<input aria-label="Dinero devuelto" className="block w-full border p-2" type="number" min="0" step="0.01" required {...field('monto')} /></label>
        <label className="block">Destino físico<select className="block w-full border p-2" {...field('destino')}>
          <option value="revision">Revisión</option><option value="disponible">Disponible para vender</option><option value="averiado">Averiado</option><option value="baja">Baja</option>
        </select></label>
        <label className="block">Cuenta de salida<select className="block w-full border p-2" required={Number(form.monto) > 0} {...field('cuentaId')}>
          <option value="">Sin salida de dinero</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select></label>
        <label className="block">Fecha<input className="block w-full border p-2" type="date" required {...field('fecha')} /></label>
        <label className="block">Motivo<textarea className="block w-full border p-2" required minLength="3" {...field('motivo')} /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose}>Cerrar</button>
        {data?.venta.estadoComercial === 'reservada' && <button type="button" disabled={busy} onClick={() => save(true)}>Corregir error sin cobros</button>}
        <button type="submit" disabled={busy || !data || data.restantes < 1} className="rounded bg-indigo-700 px-3 py-2 text-white">{busy ? 'Guardando…' : 'Registrar devolución'}</button>
      </div>
    </form>
  </div>;
}
