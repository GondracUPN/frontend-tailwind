import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

import ModalGastoDebito from '../components/ModalGastoDebito';
import ModalGastoCredito from '../components/ModalGastoCredito';
import ModalTarjetas from '../components/ModalTarjetas';
import ModalEditarEfectivo from '../components/ModalEditarEfectivo';

const fmtMoney = (moneda, monto) => {
  const n = Number(monto);
  if (!isFinite(n)) return '—';
  const symbol = moneda === 'USD' ? '$' : 'S/';
  return `${symbol} ${n.toFixed(2)}`;
};

const CARD_LABEL = {
  interbank: 'Interbank',
  bcp: 'BCP',           // 👈 para débito (bancos)
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

export default function GastosPanel({ userId: externalUserId }) {
  const [rows, setRows] = useState([]);
  const [cardsSummary, setCardsSummary] = useState([]); // {id,tipo,creditLine,used,available}
  const [wallet, setWallet] = useState({ efectivoPen: 0, efectivoUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // modales
  const [showDeb, setShowDeb] = useState(false);
  const [showCre, setShowCre] = useState(false);
  const [showTar, setShowTar] = useState(false);
  const [showEfec, setShowEfec] = useState(false);

  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  }, [localStorage.getItem('user')]);
  const isAdmin = user?.role === 'admin';
  const targetUserId = externalUserId ?? user?.id;

  // Carga gastos + resumen de tarjetas + efectivo
  const reloadAll = async () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    try {
      const gastosUrl = isAdmin
        ? `${API_URL}/gastos/all${targetUserId ? `?userId=${targetUserId}` : ''}`
        : `${API_URL}/gastos`;

      const cardsUrl = isAdmin && targetUserId
        ? `${API_URL}/cards/summary-by-user?userId=${targetUserId}`
        : `${API_URL}/cards/summary`;

      const [gRes, cRes, wRes] = await Promise.all([
        fetch(gastosUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(cardsUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/wallet${isAdmin && targetUserId ? `?userId=${targetUserId}` : ''}`, {
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
        }),
      ]);

      if (!gRes.ok) throw new Error(await gRes.text());
      if (!cRes.ok) throw new Error(await cRes.text());
      if (!wRes.ok) throw new Error(await wRes.text());

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

  // Efectivo calculado (PEN): base + ingresos débito - gastos débito
  const efectivoPenCalc = useMemo(() => {
    let delta = 0;
    for (const g of rows) {
      const m = Number(g.monto) || 0;
      if (g.moneda === 'USD') continue;   // solo mostramos PEN acá
      if (g.metodoPago !== 'debito') continue;
      if (g.concepto === 'ingreso') delta += m;
      else delta -= m; // comida, gusto, pago_tarjeta, etc.
    }
    return (Number(wallet.efectivoPen || 0) + delta).toFixed(2);
  }, [rows, wallet.efectivoPen]);

  // Abrir modales
  const openDeb = () => setShowDeb(true);
  const openCre = () => setShowCre(true);
  const openTar = () => setShowTar(true);
  const openEfec = () => setShowEfec(true);

  return (
    <div className="grid gap-6">
      {/* CABECERA: efectivo + tarjetas */}
      <div className="bg-white border rounded-xl shadow p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Efectivo para invertir (S/)</div>
            <div className="text-3xl font-semibold">S/ {efectivoPenCalc}</div>
            <button
              onClick={openEfec}
              className="mt-2 text-sm px-3 py-1.5 rounded bg-gray-800 text-white hover:bg-gray-900"
            >
              Editar efectivo
            </button>
          </div>

          <div className="flex-1 min-w-[260px]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold">Saldo de tarjetas</div>
              <button
                onClick={openTar}
                className="text-sm px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Ingresar línea de crédito / Tarjeta
              </button>
            </div>

            {cardsSummary.length === 0 ? (
              <div className="text-sm text-gray-600">Aún no has agregado tarjetas.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cardsSummary.map((c) => (
                  <div key={c.id} className="border rounded p-3 bg-gray-50">
                    <div className="text-sm text-gray-600">{CARD_LABEL[c.tipo] || c.tipo}</div>
                    <div className="mt-1 text-xs text-gray-500">Línea: S/ {Number(c.creditLine).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Usado: S/ {Number(c.used).toFixed(2)}</div>
                    <div className="text-sm font-semibold mt-1">Disponible: S/ {Number(c.available).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DOS CUADROS: Débito | Crédito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Débito */}
        <div className="bg-white border rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Débito</h3>
            <button
              onClick={openDeb}
              className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Agregar gasto débito
            </button>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando…</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-left">Tarjeta / Banco</th>
                    <th className="p-2 text-left">Detalle</th>
                    <th className="p-2 text-left">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((g) => g.metodoPago === 'debito')
                    .map((g) => {
                      const conceptoCell =
                        g.concepto === 'pago_tarjeta'
                          ? `Pago Tarjeta — ${CARD_LABEL[g.tarjetaPago] || g.tarjetaPago || '—'}`
                          : (g.concepto || '').replace(/_/g, ' ');
                      const detalle = g.notas || '—';
                      return (
                        <tr key={g.id} className="border-t">
                          <td className="p-2 align-top">{g.fecha}</td>
                          <td className="p-2 align-top capitalize">{conceptoCell}</td>
                          <td className="p-2 align-top">{CARD_LABEL[g.tarjeta] || g.tarjeta || '—'}</td>
                          <td className="p-2 align-top">{detalle}</td>
                          <td className="p-2 align-top font-semibold">{fmtMoney(g.moneda, g.monto)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Crédito */}
        <div className="bg-white border rounded-xl shadow p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold">Crédito</h3>
            <button
              onClick={openCre}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Agregar gasto crédito
            </button>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando…</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">Fecha</th>
                    <th className="p-2 text-left">Concepto</th>
                    <th className="p-2 text-left">Tarjeta</th>
                    <th className="p-2 text-left">Notas</th>
                    <th className="p-2 text-left">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter((g) => g.metodoPago === 'credito')
                    .map((g) => (
                      <tr key={g.id} className="border-t">
                        <td className="p-2 align-top">{g.fecha}</td>
                        <td className="p-2 align-top capitalize">{(g.concepto || '').replace(/_/g,' ')}</td>
                        <td className="p-2 align-top">{CARD_LABEL[g.tarjeta] || g.tarjeta || '—'}</td>
                        <td className="p-2 align-top">{g.notas || '—'}</td>
                        <td className="p-2 align-top font-semibold">{fmtMoney(g.moneda, g.monto)}</td>
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
    </div>
  );
}
