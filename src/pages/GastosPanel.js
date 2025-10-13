import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

import ModalGastoDebito from '../components/ModalGastoDebito';
import ModalGastoCredito from '../components/ModalGastoCredito';
import ModalTarjetas from '../components/ModalTarjetas';
import ModalEditarGasto from '../components/ModalEditarGasto';
import ModalEditarEfectivo from '../components/ModalEditarEfectivo';

const fmtMoney = (moneda, monto) => {
  const n = Number(monto);
  if (!isFinite(n)) return '-';
  const symbol = moneda === 'USD' ? '$' : 'S/';
  return `${symbol} ${n.toFixed(2)}`;
};

const CARD_LABEL = {
  interbank: 'Interbank',
  bcp: 'BCP',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

export default function GastosPanel({ userId: externalUserId }) {
  const [rows, setRows] = useState([]);
  const [cardsSummary, setCardsSummary] = useState([]);
  const [wallet, setWallet] = useState({ efectivoPen: 0, efectivoUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Modales
  const [showDeb, setShowDeb] = useState(false);
  const [showCre, setShowCre] = useState(false);
  const [showTar, setShowTar] = useState(false);
  const [showEfec, setShowEfec] = useState(false);
  const [editingGasto, setEditingGasto] = useState(null);

  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorage.getItem('user')]);
  const isAdmin = user?.role === 'admin';
  const targetUserId = externalUserId ?? user?.id;

  const reloadAll = async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const userIdParam = (isAdmin && targetUserId != null && /^\d+$/.test(String(targetUserId)))
        ? `?userId=${encodeURIComponent(String(targetUserId))}`
        : '';

      const gastosUrl = isAdmin ? `${API_URL}/gastos/all${userIdParam}` : `${API_URL}/gastos`;
      const cardsUrl = isAdmin && userIdParam ? `${API_URL}/cards/summary-by-user${userIdParam}` : `${API_URL}/cards/summary`;
      const walletUrl = `${API_URL}/wallet${userIdParam}`;

      const [gRes, cRes, wRes] = await Promise.all([
        fetch(gastosUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(cardsUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(walletUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
      ]);

      if (!gRes.ok) throw new Error(`GET ${gastosUrl} -> ${await gRes.text()}`);
      if (!cRes.ok) throw new Error(`GET ${cardsUrl} -> ${await cRes.text()}`);
      if (!wRes.ok) throw new Error(`GET ${walletUrl} -> ${await wRes.text()}`);

      const [gData, cData, wData] = await Promise.all([gRes.json(), cRes.json(), wRes.json()]);
      setRows(Array.isArray(gData) ? gData : []);
      setCardsSummary(Array.isArray(cData) ? cData : []);
      setWallet({
        efectivoPen: Number(wData?.efectivoPen || 0),
        efectivoUsd: Number(wData?.efectivoUsd || 0),
      });
    } catch (e) {
      console.error('[GastosPanel] load error:', e);
      setErr('No se pudo cargar la información.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reloadAll(); /* eslint-disable-next-line */ }, [token, isAdmin, targetUserId]);

  // Efectivo calculado (PEN)
  const efectivoPenCalc = useMemo(() => {
    let delta = 0;
    for (const g of rows) {
      const m = Number(g.monto) || 0;
      if (g.moneda === 'USD') continue;
      if (g.metodoPago !== 'debito') continue;
      if (g.concepto === 'ingreso') delta += m; else delta -= m;
    }
    return (Number(wallet.efectivoPen || 0) + delta).toFixed(2);
  }, [rows, wallet.efectivoPen]);

  const openDeb = () => setShowDeb(true);
  const openCre = () => setShowCre(true);
  const openTar = () => setShowTar(true);
  const openEfec = () => setShowEfec(true);
  const openEdit = (g) => setEditingGasto(g);
  const closeEdit = () => setEditingGasto(null);
  const onEdited = () => { setEditingGasto(null); reloadAll(); };
  const onDelete = async (g) => {
    if (!g?.id) return;
    if (!window.confirm('¿Eliminar este gasto?')) return;
    try {
      const t = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/gastos/${g.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error(await res.text());
      reloadAll();
    } catch (e) {
      console.error('[GastosPanel] delete gasto:', e);
      alert('No se pudo eliminar.');
    }
  };

  return (
    <div className="grid gap-6 gastos-panel">

      {/* Cabecera */}
      <div className="bg-white border rounded-xl shadow p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Efectivo para invertir</div>
            <div className="text-3xl font-semibold">S/ {efectivoPenCalc}</div>
            <div className="text-xs text-gray-600 mt-0.5">$ {Number(wallet.efectivoUsd || 0).toFixed(2)}</div>
            <button onClick={openEfec} className="mt-2 text-sm px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-900">Editar efectivo</button>
          </div>

          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Saldo de tarjetas</div>
              <button onClick={openTar} className="text-sm px-3 py-2 sm:py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 min-h-[40px]">Ingresar línea de crédito / Tarjeta</button>
            </div>

            {cardsSummary.length === 0 ? (
              <div className="text-sm text-gray-600">Aún no has agregado tarjetas.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cardsSummary.map((c) => (
                  <div key={c.id} className="border rounded p-3 bg-gray-50">
                    <div className="text-sm text-gray-600">{CARD_LABEL[c.tipo] || c.tipo}</div>
                    <div className="mt-1 text-xs text-gray-500">Línea: S/ {Number(c.creditLine).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Usado: S/ {Number(c.usedPen ?? 0).toFixed(2)} · $ {Number(c.usedUsd ?? 0).toFixed(2)}</div>
                    <div className="text-sm font-semibold mt-1">Disponible: S/ {Number(c.available).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Débito y Crédito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Débito */}
        <div className="bg-white border rounded-xl shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Débito</h3>
            <button onClick={openDeb} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 min-h-[44px]">Agregar gasto débito</button>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando…</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-x-auto border rounded">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-left">Tarjeta / Banco</th>
                    <th className="p-2 text-left">Detalle</th>
                    <th className="p-2 text-left">Monto</th>
                    <th className="p-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((g) => g.metodoPago === 'debito').map((g) => {
                    const conceptoCell = g.concepto === 'pago_tarjeta'
                      ? `Pago Tarjeta · ${CARD_LABEL[g.tarjetaPago] || g.tarjetaPago || '-'}`
                      : (g.concepto || '').replace(/_/g, ' ');
                    const detalle = g.notas || '-';
                    return (
                      <tr key={g.id} className="border-t">
                        <td className="p-2 align-top">{g.fecha}</td>
                        <td className="p-2 align-top capitalize">{conceptoCell}</td>
                        <td className="p-2 align-top">{CARD_LABEL[g.tarjeta] || g.tarjeta || '-'}</td>
                        <td className="p-2 align-top">{detalle}</td>
                        <td className="p-2 align-top font-semibold">{fmtMoney(g.moneda, g.monto)}</td>
                        <td className="p-2 align-top">
                          <div className="flex items-center gap-2">
                            <button type="button" title="Editar" onClick={() => openEdit(g)} className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16.862 3.487a1.5 1.5 0 0 1 2.121 2.121l-10.02 10.02a4.5 4.5 0 0 1-1.757 1.07l-3.042.912a.75.75 0 0 1-.928-.928l.912-3.042a4.5 4.5 0 0 1 1.07-1.757l10.02-10.02Zm-2.12-.001L5.62 12.608a6 6 0 0 0-1.427 2.243l-.912 3.042a2.25 2.25 0 0 0 2.784 2.784l3.042-.912a6 6 0 0 0 2.243-1.427l9.121-9.121-6.433-6.433Z" /></svg>
                            </button>
                            <button type="button" title="Borrar" onClick={() => onDelete(g)} className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 text-red-600 hover:bg-red-50">
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h3.75a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1 0-1.5H9v-.75ZM6.75 7.5h10.5l-.63 11.34a2.25 2.25 0 0 1-2.245 2.11H9.625a2.25 2.25 0 0 1-2.244-2.11L6.75 7.5Z" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Crédito */}
        <div className="bg-white border rounded-xl shadow p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Crédito</h3>
            <button onClick={openCre} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 min-h-[44px]">Agregar gasto crédito</button>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando…</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-x-auto border rounded">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-left">Tarjeta</th>
                    <th className="p-2 text-left">Notas</th>
                    <th className="p-2 text-left">Monto</th>
                    <th className="p-2 text-left">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.filter((g) => g.metodoPago === 'credito').map((g) => (
                    <tr key={g.id} className="border-t">
                      <td className="p-2 align-top">{g.fecha}</td>
                      <td className="p-2 align-top capitalize">{(g.concepto || '').replace(/_/g,' ')}</td>
                      <td className="p-2 align-top">{CARD_LABEL[g.tarjeta] || g.tarjeta || '-'}</td>
                      <td className="p-2 align-top">{g.notas || '-'}</td>
                      <td className="p-2 align-top font-semibold">{fmtMoney(g.moneda, g.monto)}</td>
                      <td className="p-2 align-top">
                        <div className="flex items-center gap-2">
                          <button type="button" title="Editar" onClick={() => openEdit(g)} className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M16.862 3.487a1.5 1.5 0 0 1 2.121 2.121l-10.02 10.02a4.5 4.5 0 0 1-1.757 1.07l-3.042.912a.75.75 0 0 1-.928-.928l.912-3.042a4.5 4.5 0 0 1 1.07-1.757l10.02-10.02Zm-2.12-.001L5.62 12.608a6 6 0 0 0-1.427 2.243l-.912 3.042a2.25 2.25 0 0 0 2.784 2.784l3.042-.912a6 6 0 0 0 2.243-1.427l9.121-9.121-6.433-6.433Z" /></svg>
                          </button>
                          <button type="button" title="Borrar" onClick={() => onDelete(g)} className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-300 text-red-600 hover:bg-red-50">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M9 3.75A2.25 2.25 0 0 1 11.25 1.5h1.5A2.25 2.25 0 0 1 15 3.75V4.5h3.75a.75.75 0 0 1 0 1.5H5.25a.75.75 0 0 1 0-1.5H9v-.75ZM6.75 7.5h10.5l-.63 11.34a2.25 2.25 0 0 1-2.245 2.11H9.625a2.25 2.25 0 0 1-2.244-2.11L6.75 7.5Z" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modales */}
      {showDeb && (
        <ModalGastoDebito
          userId={targetUserId}
          onClose={() => setShowDeb(false)}
          onSaved={() => { setShowDeb(false); reloadAll(); }}
        />
      )}
      {showCre && (
        <ModalGastoCredito
          userId={targetUserId}
          onClose={() => setShowCre(false)}
          onSaved={() => { setShowCre(false); reloadAll(); }}
        />
      )}
      {showTar && (
        <ModalTarjetas
          userId={targetUserId}
          onClose={() => setShowTar(false)}
          onSaved={() => { setShowTar(false); reloadAll(); }}
        />
      )}
      {showEfec && (
        <ModalEditarEfectivo
          userId={targetUserId}
          current={wallet}
          onClose={() => setShowEfec(false)}
          onSaved={(w) => { setShowEfec(false); setWallet(w); }}
        />
      )}
      {editingGasto && (
        <ModalEditarGasto
          gasto={editingGasto}
          onClose={closeEdit}
          onSaved={onEdited}
        />
      )}
    </div>
  );
}
