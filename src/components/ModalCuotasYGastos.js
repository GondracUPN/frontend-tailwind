import React, { useEffect, useMemo, useState } from 'react';
import CloseX from './CloseX';
import { API_URL } from '../api';

const fmtMoney = (moneda, monto) => {
  const n = Number(monto);
  if (!isFinite(n)) return '-';
  const symbol = moneda === 'USD' ? '$' : 'S/';
  return `${symbol} ${n.toFixed(2)}`;
};

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, '_');

function addMonths(dateStr, months) {
  const d = new Date(dateStr);
  const day = d.getDate();
  const m = d.getMonth();
  const y = d.getFullYear();
  const nd = new Date(y, m + months, day);
  return nd.toISOString().slice(0, 10);
}

export default function ModalCuotasYGastos({ onClose, rows = [], userId, onChanged }) {
  const [tab, setTab] = useState('mensuales'); // 'cuotas' | 'mensuales'
  const [selKeys, setSelKeys] = useState({});
  const token = localStorage.getItem('token');
  const [schedules, setSchedules] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(null);
  const [editMonto, setEditMonto] = useState('');
  const [editTarjeta, setEditTarjeta] = useState('');
  const [editErr, setEditErr] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editCards, setEditCards] = useState([]);
  const [editLoadingCards, setEditLoadingCards] = useState(false);
  const [hiddenKeys, setHiddenKeys] = useState(() => {
    try {
      const raw = localStorage.getItem('mensuales_hidden');
      const arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!token) return;
        const res = await fetch(`${API_URL}/schedules`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!alive) return;
        setSchedules(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setSchedules([]);
      }
    })();
    return () => { alive = false; };
  }, [token]);

  const cuotasList = useMemo(() => {
    const today = new Date().toISOString().slice(0,10);
    const deudas = rows
      .filter(r => r.metodoPago === 'credito' && norm(r.concepto) === 'deuda_cuotas')
      .sort((a,b)=> a.fecha.localeCompare(b.fecha));

    return deudas.map((g) => {
      const n = Number(g.cuotasMeses || 0) || 1;
      const per = Number(g.monto) / n;
      const scheduleBase = Array.from({ length: n }).map((_, i) => ({ idx: i + 1, fecha: addMonths(g.fecha, i + 1), monto: per }));
      // Marcar SOLO por fecha alcanzada; no aplicar pagos como prepagos
      const marked = scheduleBase.map(it => ({ ...it, paid: it.fecha <= today }));

      const paidCount = marked.filter(x => x.paid).length;
      const remainingCount = Math.max(0, n - paidCount);
      const saldoPendiente = remainingCount * per;
      return { ...g, per, schedule: marked, remainingCount, saldoPendiente };
    });
  }, [rows]);
  
  // Grupos de gastos mensuales (para selección y programación)
  const mensualesGroups = useMemo(() => {
    const list = rows.filter(r => ['gastos_recurrentes', 'gastos_mensuales'].includes(norm(r.concepto)));
    const map = new Map();
    for (const g of list) {
      const key = [g.metodoPago, g.moneda, (g.tarjeta || g.tarjetaPago || '-'), g.notas || '-', Number(g.monto).toFixed(2)].join('|');
      const arr = map.get(key) || [];
      arr.push(g);
      map.set(key, arr);
    }
    const groups = Array.from(map.entries()).map(([key, arr]) => {
      arr.sort((a,b)=> a.fecha.localeCompare(b.fecha));
      const last = arr[arr.length-1];
      const [metodoPago, moneda, tarjeta, notas, monto] = key.split('|');
      return { key, metodoPago, moneda, tarjeta, notas, monto: Number(monto), last, count: arr.length, lastTarjeta: last?.tarjeta || null, lastTarjetaPago: last?.tarjetaPago || null };
    });
    return groups.filter(g => !hiddenKeys.has(g.key));
  }, [rows, hiddenKeys]);

  const editGroup = useMemo(
    () => (editKey ? mensualesGroups.find((g) => g.key === editKey) : null),
    [editKey, mensualesGroups]
  );

  const editIsCredito = editGroup?.metodoPago === 'credito';

  useEffect(() => {
    if (!editOpen || !editIsCredito) return;
    let alive = true;
    (async () => {
      try {
        setEditLoadingCards(true);
        const res = await fetch(`${API_URL}/cards`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!alive) return;
        setEditCards(Array.isArray(data) ? data : []);
      } catch {
        if (alive) setEditCards([]);
      } finally {
        if (alive) setEditLoadingCards(false);
      }
    })();
    return () => { alive = false; };
  }, [editOpen, editIsCredito, token]);


  const findScheduleForGroup = (g) => {
    const montoStr = Number(g.monto).toFixed(2);
    const isCredito = g.metodoPago === 'credito';
    return schedules.find((s) => (
      s?.tipo === 'recurrente'
      && norm(s?.concepto) === 'gastos_recurrentes'
      && s?.metodoPago === g.metodoPago
      && String(s?.moneda) === g.moneda
      && Number(Number(s?.monto || 0).toFixed(2)) === Number(montoStr)
      && (isCredito ? (String(s?.tarjeta || '') === (g.tarjeta === '-' ? '' : g.tarjeta))
                    : (String(s?.tarjetaPago || '') === (g.tarjeta === '-' ? (g.lastTarjetaPago || '') : g.tarjeta)))
    ));
  };

  const hideGroup = (k) => {
    setHiddenKeys(prev => {
      const next = new Set(prev);
      next.add(k);
      try { localStorage.setItem('mensuales_hidden', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const toggleSel = (k) => setSelKeys(s => ({ ...s, [k]: !s[k] }));

  const pagarSeleccionados = async () => {
    const keys = Object.keys(selKeys).filter(k => selKeys[k]);
    if (!keys.length || !token) return;
    try {
      const today = new Date().toISOString().slice(0,10);
      for (const k of keys) {
        const it = mensualesGroups.find(x => x.key === k);
        if (!it) continue;
        const body = {
          concepto: 'Gastos mensuales',
          metodoPago: it.metodoPago,
          moneda: it.moneda,
          monto: Number(it.monto),
          fecha: today,
          notas: it.notas || null,
          tarjeta: it.tarjeta && it.tarjeta !== '-' ? it.tarjeta : null,
        };
        const res = await fetch(`${API_URL}/gastos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error(await res.text());
      }
      onChanged?.();
      setSelKeys({});
    } catch (e) {
      console.error('[ModalCuotasYGastos] pagar seleccionados:', e);
      alert('No se pudieron registrar los pagos seleccionados.');
    }
  };

  const crearMensual = async (k) => {
    const g = mensualesGroups.find((x) => x.key === k);
    if (!g || !token) return;
    try {
      const baseDate = g.last?.fecha || new Date().toISOString().slice(0,10);
      const next = addMonths(baseDate, 1);
      const body = {
        metodoPago: g.metodoPago,
        tipo: 'recurrente',
        concepto: 'gastos_recurrentes',
        moneda: g.moneda,
        monto: Number(g.monto),
        nextDate: next,
        tarjeta: g.metodoPago === 'credito' ? (g.tarjeta !== '-' ? g.tarjeta : null) : undefined,
        tarjetaPago: g.metodoPago === 'debito' ? (g.tarjeta !== '-' ? g.tarjeta : (g.lastTarjetaPago || null)) : undefined,
      };
      const res = await fetch(`${API_URL}/schedules`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await res.text());
      const list = await fetch(`${API_URL}/schedules`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).then(r=>r.json()).catch(()=>[]);
      setSchedules(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('[ModalCuotasYGastos] crear mensual:', e);
      alert('No se pudo crear la programación.');
    }
  };

  const openEditar = (k) => {
    const it = mensualesGroups.find(x => x.key === k);
    if (!it?.last?.id) return;
    setEditKey(k);
    setEditMonto(String(it.last?.monto ?? it.monto ?? ''));
    setEditTarjeta(it.last?.tarjeta || (it.tarjeta !== '-' ? it.tarjeta : ''));
    setEditErr('');
    setEditOpen(true);
  };

  const closeEditar = () => {
    setEditOpen(false);
    setEditKey(null);
    setEditErr('');
    setEditSaving(false);
  };

  const guardarEdicion = async (e) => {
    e?.preventDefault?.();
    if (editSaving) return;
    setEditErr('');
    const n = Number(editMonto);
    if (!isFinite(n) || n <= 0) return setEditErr('Monto inv�lido.');
    if (!token) return setEditErr('No hay sesi�n.');
    if (!editGroup?.last?.id) return setEditErr('No se encontr� el gasto.');
    setEditSaving(true);
    try {
      const body = { monto: n };
      if (editIsCredito && editTarjeta) body.tarjeta = editTarjeta;
      const res = await fetch(`${API_URL}/gastos/${editGroup.last.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onChanged?.();
      closeEditar();
    } catch (e) {
      console.error('[ModalCuotasYGastos] editar:', e);
      setEditErr('No se pudo actualizar.');
    } finally {
      setEditSaving(false);
    }
  };
  const eliminarMensual = async (k) => {
    const g = mensualesGroups.find((x) => x.key === k);
    if (!g) return;
    const sch = findScheduleForGroup(g);
    if (!sch?.id) { alert('No se encontró la programación para este gasto mensual.'); return; }
    if (!window.confirm('Eliminar gasto mensual: solo se elimina la programación futura. No se borrarán los gastos ya registrados. ¿Continuar?')) return;
    try {
      const res = await fetch(`${API_URL}/schedules/${sch.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      const list = await fetch(`${API_URL}/schedules`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).then(r=>r.json()).catch(()=>[]);
      setSchedules(Array.isArray(list) ? list : []);
      onChanged?.();
    } catch (e) {
      console.error('[ModalCuotasYGastos] eliminar mensual:', e);
      alert('No se pudo eliminar la programación.');
    }
  };

  const borrarDefinitivo = async (k) => {
    if (!token) return;
    const g = mensualesGroups.find((x) => x.key === k);
    if (!g) { alert('No se encontró el grupo.'); return; }
    const sch = findScheduleForGroup(g);

    if (!window.confirm('Quitar de "Gastos mensuales". No se borrarán gastos ya registrados. ¿Continuar?')) return;

    try {
      // 1) Si existe programación mensual, eliminarla
      if (sch?.id) {
        const res = await fetch(`${API_URL}/schedules/${sch.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if (!res.ok) throw new Error(await res.text());
      }

      // 2) Ocultar el grupo de la vista de mensuales (persistido en localStorage)
      hideGroup(k);

      // 3) Refrescar schedules en memoria
      try {
        const list = await fetch(`${API_URL}/schedules`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).then(r=>r.json());
        setSchedules(Array.isArray(list) ? list : []);
      } catch {}

      onChanged?.();
    } catch (e) {
      console.error('[ModalCuotasYGastos] borrar definitivo (solo quitar de mensuales):', e);
      alert('No se pudo quitar de gastos mensuales.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/50 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg p-6 relative max-h-[90vh] overflow-y-auto">
        <CloseX onClick={onClose} />
        <h2 className="text-lg font-semibold mb-4">Cuotas / Gastos mensuales</h2>

        <div className="flex gap-2 mb-4">
          <button className={`px-3 py-1.5 rounded border ${tab==='mensuales'?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>setTab('mensuales')}>Gastos mensuales</button>
          <button className={`px-3 py-1.5 rounded border ${tab==='cuotas'?'bg-gray-900 text-white':'bg-white'}`} onClick={()=>setTab('cuotas')}>Cuotas</button>
        </div>

        {tab === 'cuotas' ? (
          <div className="grid gap-4">
            {cuotasList.length === 0 ? (
              <div className="text-sm text-gray-600">AúAún no has registrado compras en cuotas.</div>
            ) : cuotasList.map((q) => (
              <div key={q.id} className="border rounded p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-gray-700">Compra: {q.fecha} . Total {fmtMoney(q.moneda, q.monto)}</div>
                  <div className="text-sm text-gray-700">{q.cuotasMeses} cuotas de {fmtMoney(q.moneda, q.per)} . Saldo: {fmtMoney(q.moneda, q.saldoPendiente)}</div>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                  {q.schedule.map(it => (
                    <div key={it.idx} className={`text-sm px-2 py-1 rounded border ${it.paid ? 'line-through text-gray-600 bg-gray-50 border-gray-200' : 'bg-amber-50 border-amber-300 text-amber-800'}`} title={it.paid ? 'Cuota pagada (fecha alcanzada)' : 'Cuota pendiente'}>
                      {it.idx}. {it.fecha} - {fmtMoney(q.moneda, it.monto)} {it.paid ? '(pagado)' : '(pendiente)'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-3">
            {mensualesGroups.length === 0 ? (
              <div className="text-sm text-gray-600">No hay pagos mensuales registrados.</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Seleccionar</th>
                        <th className="p-2 text-left">Detalle</th>
                        <th className="p-2 text-left">Método</th>
                        <th className="p-2 text-left">Moneda</th>
                        <th className="p-2 text-left">Monto</th>
                        <th className="p-2 text-left">Último pago</th>
                        <th className="p-2 text-left">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mensualesGroups.map((g) => (
                        <tr key={g.key} className="border-t">
                          <td className="p-2 align-top"><input type="checkbox" checked={!!selKeys[g.key]} onChange={()=>toggleSel(g.key)} /></td>
                          <td className="p-2 align-top">{g.notas || '(Sin detalle)'} {g.tarjeta && g.tarjeta !== '-' ? `- ${g.tarjeta}` : ''}</td>
                          <td className="p-2 align-top capitalize">{g.metodoPago}</td>
                          <td className="p-2 align-top">{g.moneda}</td>
                          <td className="p-2 align-top font-semibold">{fmtMoney(g.moneda, g.monto)}</td>
                          <td className="p-2 align-top">{g.last?.fecha || '-'}</td>
                          <td className="p-2 align-top">
                            <div className="flex gap-2">
                              <button className="px-2 py-1 text-indigo-700 hover:bg-indigo-50 rounded border" onClick={()=>openEditar(g.key)}>Editar</button>
                              {findScheduleForGroup(g) ? (
                                <button className="px-2 py-1 text-red-700 hover:bg-red-50 rounded border" title="Eliminar programación (no borra gastos históricos)" onClick={()=>eliminarMensual(g.key)}>Eliminar mensual</button>
                              ) : (
                                <button className="px-2 py-1 text-green-700 hover:bg-green-50 rounded border" title="Crear programación mensual para este grupo" onClick={()=>crearMensual(g.key)}>Crear mensual</button>
                              )}
                              <button
                                className="px-2 py-1 text-white bg-red-600 hover:bg-red-700 rounded"
                                title="Quita este grupo de 'Gastos mensuales' y elimina su programación futura (no borra históricos)"
                                onClick={() => borrarDefinitivo(g.key)}
                              >
                                Quitar de mensuales
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mt-3">
                  <button className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500" onClick={pagarSeleccionados}>Pagar seleccionados</button>
                </div>
              </>
            )}
          </div>
        )}
      {editOpen && editGroup && (
        <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={(e)=>{ if (e.target === e.currentTarget) closeEditar(); }}>
          <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-5" onClick={(e)=>e.stopPropagation()}>
            <div className="text-lg font-semibold mb-2">Editar gasto mensual</div>
            <div className="text-xs text-gray-600 mb-3">
              <div>Detalle: <b>{editGroup.notas || '(Sin detalle)'}</b></div>
              <div>Metodo: <b className="capitalize">{editGroup.metodoPago}</b> � Moneda: <b>{editGroup.moneda}</b> � Ultimo pago: <b>{editGroup.last?.fecha || '-'}</b></div>
            </div>

            {editErr && <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{editErr}</div>}

            <form className="grid gap-3" onSubmit={guardarEdicion}>
              <label className="text-sm">
                <span className="block text-gray-600 mb-1">Monto</span>
                <input type="number" step="0.01" min="0" className="w-full border rounded px-3 py-2" value={editMonto} onChange={(e)=>setEditMonto(e.target.value)} required />
              </label>

              {editIsCredito && (
                <label className="text-sm">
                  <span className="block text-gray-600 mb-1">Tarjeta</span>
                  <select className="w-full border rounded px-3 py-2" value={editTarjeta} onChange={(e)=>setEditTarjeta(e.target.value)} disabled={editLoadingCards || !editCards.length}>
                    {editCards.map(c => (
                      <option key={c.id} value={c.tipo || c.type}>{c.label || c.name || c.tipo || c.type}</option>
                    ))}
                  </select>
                </label>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300" onClick={closeEditar}>Cancelar</button>
                <button type="submit" disabled={editSaving} className="px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                  {editSaving ? 'Actualizando...' : 'Actualizar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}






