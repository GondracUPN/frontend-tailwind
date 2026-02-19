import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';

import ModalGastoDebito from '../components/ModalGastoDebito';
import ModalGastoCredito from '../components/ModalGastoCredito';
import ModalGastoCreditoMasivo from '../components/ModalGastoCreditoMasivo';
import ModalTarjetas from '../components/ModalTarjetas';
import ModalCuotasYGastos from '../components/ModalCuotasYGastos';
import ModalEditarGasto from '../components/ModalEditarGasto';
import ModalEditarEfectivo from '../components/ModalEditarEfectivo';
import ModalAnalisisGastosMes from '../components/ModalAnalisisGastosMes';

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

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

export default function GastosPanel({ userId: externalUserId, setVista }) {
  const [rows, setRows] = useState([]);
  const [cardsSummary, setCardsSummary] = useState([]);
  const [wallet, setWallet] = useState({ efectivoPen: 0, efectivoUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [err, setErr] = useState('');

  // Modales
  const [showDeb, setShowDeb] = useState(false);
  const [showCre, setShowCre] = useState(false);
  const [showCreBulk, setShowCreBulk] = useState(false);
  const [showTar, setShowTar] = useState(false);
  const [showCG, setShowCG] = useState(false);
  const [showAnalisisMes, setShowAnalisisMes] = useState(false);
  const [showEfec, setShowEfec] = useState(false);
  const [editingGasto, setEditingGasto] = useState(null);
  const [creditCardFilter, setCreditCardFilter] = useState('all');

  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorage.getItem('user')]);
  const isAdmin = user?.role === 'admin';
  const targetUserId = externalUserId ?? user?.id;
  const cacheKey = useMemo(() => `gastos-panel-cache:${targetUserId ?? 'self'}`, [targetUserId]);

  const TIPO_CAMBIO = 3.7;

  const sortRows = (list) => {
    return [...list].sort((a, b) => {
      if (a.fecha === b.fecha) return Number(b.id || 0) - Number(a.id || 0);
      return String(b.fecha || '').localeCompare(String(a.fecha || ''));
    });
  };

  const cardsTotals = useMemo(() => {
    const pen = (cardsSummary || []).reduce((acc, c) => acc + Number(c.usedPen || 0), 0);
    const usd = (cardsSummary || []).reduce((acc, c) => acc + Number(c.usedUsd || 0), 0);
    return {
      pen: pen.toFixed(2),
      usd: usd.toFixed(2),
      totalPen: (pen + usd * TIPO_CAMBIO).toFixed(2),
    };
  }, [cardsSummary]);

  const readCache = () => {
    if (!cacheKey) return null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.ts) return null;
      if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  };

  const writeCache = (data) => {
    if (!cacheKey) return;
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ ...data, ts: Date.now() }));
    } catch {
      /* ignore cache write errors */
    }
  };

  const reloadAll = async ({ forceSpinner = false, includeGastos = true, useCache = true, silent = false } = {}) => {
    if (!token) return;
    if (!silent) {
      if (!isInitialLoadDone || forceSpinner) setLoading(true);
      else setIsUpdating(true);
      setErr('');
    }
    try {
      const cached = useCache ? readCache() : null;
      if (cached && !forceSpinner) {
        if (includeGastos && Array.isArray(cached.rows)) setRows(sortRows(cached.rows));
        if (Array.isArray(cached.cardsSummary)) setCardsSummary(cached.cardsSummary);
        if (cached.wallet) setWallet(cached.wallet);
        setIsInitialLoadDone(true);
        if (!silent) {
          setLoading(false);
          setIsUpdating(false);
        }
        return;
      }

      const shouldLoadGastos = includeGastos || !isInitialLoadDone;
      const userIdParam = (isAdmin && targetUserId != null && /^\d+$/.test(String(targetUserId)))
        ? `?userId=${encodeURIComponent(String(targetUserId))}`
        : '';

      const gastosUrl = isAdmin ? `${API_URL}/gastos/all${userIdParam}` : `${API_URL}/gastos`;
      const cardsUrl = isAdmin && userIdParam ? `${API_URL}/cards/summary-by-user${userIdParam}` : `${API_URL}/cards/summary`;
      const walletUrl = `${API_URL}/wallet${userIdParam}`;

      const gastosPromise = shouldLoadGastos
        ? fetch(gastosUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })
        : Promise.resolve(null);

      const [gRes, cRes, wRes] = await Promise.all([
        gastosPromise,
        fetch(cardsUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(walletUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
      ]);

      if (shouldLoadGastos && gRes && !gRes.ok) throw new Error(`GET ${gastosUrl} -> ${await gRes.text()}`);
      if (!cRes.ok) throw new Error(`GET ${cardsUrl} -> ${await cRes.text()}`);
      if (!wRes.ok) throw new Error(`GET ${walletUrl} -> ${await wRes.text()}`);

      const [gData, cData, wData] = await Promise.all([
        shouldLoadGastos && gRes ? gRes.json() : Promise.resolve(null),
        cRes.json(),
        wRes.json(),
      ]);

      const nextRows = shouldLoadGastos && gData ? sortRows(Array.isArray(gData) ? gData : []) : rows;
      if (shouldLoadGastos && gData) setRows(nextRows);
      setCardsSummary(Array.isArray(cData) ? cData : []);
      const nextWallet = {
        efectivoPen: Number(wData?.efectivoPen || 0),
        efectivoUsd: Number(wData?.efectivoUsd || 0),
      };
      setWallet(nextWallet);
      writeCache({
        rows: nextRows,
        cardsSummary: Array.isArray(cData) ? cData : [],
        wallet: nextWallet,
      });
      setIsInitialLoadDone(true);
    } catch (e) {
      console.error('[GastosPanel] load error:', e);
      if (!silent) setErr('No se pudo cargar la informacion.');
    } finally {
      if (!silent) {
        setLoading(false);
        setIsUpdating(false);
      }
    }
  };
  const refreshTotals = async () => reloadAll({ includeGastos: false, useCache: false, silent: true });

  const displayConcepto = (c) => {
    const n = String(c || '').toLowerCase().replace(/\s+/g,'_');
    if (n === 'gastos_recurrentes') return 'Gastos mensuales';
    if (n === 'cashback') return 'Devo/Cash';
    return String(c || '').replace(/_/g,' ');
  };

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      if (Array.isArray(cached.rows)) setRows(sortRows(cached.rows));
      if (Array.isArray(cached.cardsSummary)) setCardsSummary(cached.cardsSummary);
      if (cached.wallet) setWallet(cached.wallet);
      setIsInitialLoadDone(true);
      setLoading(false);
      reloadAll({ includeGastos: true, useCache: false, silent: true });
      return;
    }
    reloadAll({ forceSpinner: true });
    /* eslint-disable-next-line */
  }, [token, isAdmin, targetUserId]);

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

  // Efectivo calculado (USD)
  const efectivoUsdCalc = useMemo(() => {
    let delta = 0;
    for (const g of rows) {
      const m = Number(g.monto) || 0;
      if (g.moneda !== 'USD') continue;
      if (g.metodoPago !== 'debito') continue;
      if (String(g.concepto).toLowerCase() === 'ingreso') delta += m; else delta -= m;
    }
    return (Number(wallet.efectivoUsd || 0) + delta).toFixed(2);
  }, [rows, wallet.efectivoUsd]);

  const openDeb = () => setShowDeb(true);
  const openCre = () => setShowCre(true);
  const openCreBulk = () => setShowCreBulk(true);
  const openTar = () => setShowTar(true);
  const openCG = () => setShowCG(true);
  const openEfec = () => setShowEfec(true);
  const openEdit = (g) => setEditingGasto(g);

  const upsertRow = (row) => {
    if (!row || !row.id) return;
    setRows((prev) => sortRows([row, ...prev.filter((r) => r.id !== row.id)]));
  };

  const debitRows = useMemo(
    () => rows.filter((g) => g.metodoPago === 'debito'),
    [rows],
  );
  const creditRows = useMemo(
    () => rows.filter((g) => g.metodoPago === 'credito'),
    [rows],
  );
  const creditRowsFiltered = useMemo(() => {
    if (creditCardFilter === 'all') return creditRows;
    return creditRows.filter((g) => {
      const card = g.tarjeta || g.tarjetaPago || 'N/A';
      return card === creditCardFilter;
    });
  }, [creditRows, creditCardFilter]);

  const creditCardOptions = useMemo(() => {
    const set = new Set();
    creditRows.forEach((r) => {
      const card = r.tarjeta || r.tarjetaPago || 'N/A';
      if (card) set.add(card);
    });
    return Array.from(set.values()).sort();
  }, [creditRows]);

  const mostUsedCreditCard = useMemo(() => {
    const counts = new Map();
    creditRows.forEach((r) => {
      const card = r.tarjeta || r.tarjetaPago;
      if (!card) return;
      counts.set(card, (counts.get(card) || 0) + 1);
    });
    const sorted = Array.from(counts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return String(a[0] || '').localeCompare(String(b[0] || ''));
    });
    return sorted[0]?.[0] || '';
  }, [creditRows]);

  const [creditCardForCreate, setCreditCardForCreate] = useState('');

  useEffect(() => {
    if (creditCardFilter && creditCardFilter !== 'all') {
      setCreditCardForCreate(creditCardFilter);
      return;
    }

    const preferred = mostUsedCreditCard || creditCardOptions[0] || '';
    if (!preferred) return;

    const shouldUsePreferred =
      !creditCardForCreate ||
      (creditCardFilter === 'all' && creditCardForCreate !== preferred && !creditCardOptions.includes(creditCardForCreate));

    if (shouldUsePreferred) {
      setCreditCardForCreate(preferred);
    }
  }, [creditCardFilter, creditCardOptions, creditCardForCreate, mostUsedCreditCard]);
  const closeEdit = () => setEditingGasto(null);
  const onEdited = (row) => {
    setEditingGasto(null);
    if (row) upsertRow(row);
    refreshTotals();
  };
  const onDelete = async (g) => {
    if (!g?.id) return;
    if (!window.confirm('Eliminar este gasto?')) return;
    try {
      const t = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/gastos/${g.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` } });
      if (!res.ok) throw new Error(await res.text());
      setRows((prev) => prev.filter((r) => r.id !== g.id));
      refreshTotals();
    } catch (e) {
      console.error('[GastosPanel] delete gasto:', e);
      alert('No se pudo eliminar.');
    }
  };

  return (
    <div className="grid gap-6 gastos-panel">

      {/* Cabecera */}
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm text-gray-500">Efectivo para invertir</div>
            <div className="text-3xl font-semibold">S/ {efectivoPenCalc}</div>
            <div className="text-xs text-gray-600 mt-0.5">$ {efectivoUsdCalc}</div>
            <button onClick={openEfec} className="mt-2 w-full sm:w-auto text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-700">Editar efectivo</button>
          </div>

          <div className="flex-1 min-w-[260px]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">Saldo de tarjetas</div>
                {cardsSummary.length > 0 && (
                  <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold text-gray-800">Gastado total</span>
                      <span className="text-gray-500">TC {TIPO_CAMBIO}</span>
                      <span className="font-semibold">S/ {cardsTotals.totalPen}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-gray-500">En soles</span>
                      <span className="font-semibold">S/ {cardsTotals.pen}</span>
                      <span className="text-gray-500">En dolares</span>
                      <span className="font-semibold">$ {cardsTotals.usd}</span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button onClick={openCG} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded-lg border border-gray-300 text-gray-800 hover:bg-gray-100 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300">Cuotas / Gastos mensuales</button>
                <button onClick={() => setShowAnalisisMes(true)} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 min-h-[40px]">Analisis de gastos</button>
                {typeof setVista === 'function' && (
                  <button
                    onClick={() => setVista('presupuestoGastos')}
                    className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 min-h-[40px]"
                  >
                    Presupuesto de gastos
                  </button>
                )}
                <button onClick={openTar} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 min-h-[40px]">Ingresar lnea de crdito / Tarjeta</button>
              </div>
            </div>

            {cardsSummary.length === 0 ? (
              <div className="text-sm text-gray-600">Aun no has agregado tarjetas.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cardsSummary.map((c) => (
                  <div key={c.id} className="rounded-xl ring-1 ring-gray-200 bg-white p-4 hover:shadow-sm transition">
                    <div className="text-sm text-gray-600">{CARD_LABEL[c.tipo] || c.tipo}</div>
                    <div className="mt-1 text-xs text-gray-500">Lnea: S/ {Number(c.creditLine).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Usado: S/ {Number(c.usedPen ?? 0).toFixed(2)}  $ {Number(c.usedUsd ?? 0).toFixed(2)}</div>
                    <div className="text-sm font-semibold mt-1">Disponible: S/ {Number(c.available).toFixed(2)}</div>
                    <div className="text-xs text-gray-500 mt-0.5">Consumido en soles: S/ {(Number(c.usedPen || 0) + Number(c.usedUsd || 0) * TIPO_CAMBIO).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debito y Credito */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Debito */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <h3 className="text-lg font-semibold">Debito</h3>
            <button onClick={openDeb} className="w-full sm:w-auto px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 min-h-[44px]">Agregar gasto debito</button>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando...</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm">
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
                  {debitRows.map((g) => {
                    const conceptoCell = g.concepto === 'pago_tarjeta'
                      ? `Pago Tarjeta  ${CARD_LABEL[g.tarjetaPago] || g.tarjetaPago || '-'}`
                      : displayConcepto(g.concepto);
                    const detalle = g.notas || '-';
                    return (
                    <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50/60">
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

        {/* Credito */}
        <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Credito</h3>
              {isUpdating && <span className="text-xs text-gray-500">Actualizando...</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <label className="text-sm text-gray-700 flex items-center gap-2 w-full sm:w-auto">
                Tarjeta
                <select
                  className="border rounded-lg px-3 py-2 text-sm w-full sm:w-auto"
                  value={creditCardFilter}
                  onChange={(e) => setCreditCardFilter(e.target.value)}
                >
                  <option value="all">Todas</option>
                  {creditCardOptions.map((c) => (
                    <option key={c} value={c}>{CARD_LABEL[c] || c}</option>
                  ))}
                </select>
              </label>
              <button onClick={openCre} className="w-full sm:w-auto px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 min-h-[44px]">Agregar gasto credito</button>
              <button onClick={openCreBulk} className="w-full sm:w-auto px-4 py-2 rounded bg-sky-600 text-white hover:bg-sky-700 min-h-[44px]">Agregar gastos masivos</button>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-600">Cargando...</div>
          ) : err ? (
            <div className="text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{err}</div>
          ) : (
            <div className="overflow-x-auto rounded-xl ring-1 ring-gray-200 shadow-sm">
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
                  {creditRowsFiltered.map((g) => {
                    const detalle = g.notas || '-';
                      return (
                    <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                      <td className="p-2 align-top">{g.fecha}</td>
                      <td className="p-2 align-top capitalize">{displayConcepto(g.concepto)}</td>
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
                  )})}
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
          onSaved={(row) => {
            setShowDeb(false);
            if (row) upsertRow(row);
            refreshTotals();
          }}
        />
      )}
      {showCre && (
        <ModalGastoCredito
          userId={targetUserId}
          defaultCard={creditCardForCreate}
          onClose={() => setShowCre(false)}
          onSaved={(row) => {
            setShowCre(false);
            if (row) upsertRow(row);
            refreshTotals();
          }}
        />
      )}
      {showCreBulk && (
        <ModalGastoCreditoMasivo
          onClose={() => setShowCreBulk(false)}
          onSaved={() => {
            setShowCreBulk(false);
            reloadAll({ includeGastos: true, useCache: false });
          }}
        />
      )}
      {showTar && (
        <ModalTarjetas
          userId={targetUserId}
          onClose={() => setShowTar(false)}
          onSaved={() => { setShowTar(false); reloadAll({ includeGastos: false, useCache: false }); }}
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
      {showCG && (
        <ModalCuotasYGastos
          onClose={() => setShowCG(false)}
          rows={rows}
          userId={targetUserId}
          onChanged={reloadAll}
        />
      )}
      {showAnalisisMes && (
        <ModalAnalisisGastosMes
          rows={rows}
          onClose={() => setShowAnalisisMes(false)}
          onFullAnalysis={setVista ? () => setVista('analisisGastos') : null}
        />
      )}
    </div>
  );
}





