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
import ModalCiclosTarjeta from '../components/ModalCiclosTarjeta';
import { buildExpenseConceptCategoryMap, isIncomeExpenseConcept } from '../utils/expenseConcepts';
import { getAnalyticsSummary } from '../services/analytics';

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
  visa_qore: 'Visa Qore',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutos

const fmtUsd = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '$ 0.00';
  return `$ ${n.toFixed(2)}`;
};

const fmtPen = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'S/ 0.00';
  return `S/ ${n.toFixed(2)}`;
};

const parseUsdAmountsText = (value) => {
  const matches = String(value || '').match(/-?\d+(?:[.,]\d+)?/g) || [];
  return matches.reduce((sum, raw) => {
    const n = Number(String(raw).replace(',', '.'));
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);
};

const normalizeSellerSlug = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw.includes('gonzalo')) return 'gonzalo';
  if (raw.includes('renato')) return 'renato';
  if (raw === 'ambos') return 'ambos';
  return '';
};

const sellerLabel = (slug) => {
  if (slug === 'gonzalo') return 'Gonzalo';
  if (slug === 'renato') return 'Renato';
  return '';
};

export default function GastosPanel({ userId: externalUserId, setVista }) {
  const [rows, setRows] = useState([]);
  const [cardsSummary, setCardsSummary] = useState([]);
  const [wallet, setWallet] = useState({ efectivoPen: 0, efectivoUsd: 0 });
  const [conceptCategories, setConceptCategories] = useState({});
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
  const [showCiclosTarjeta, setShowCiclosTarjeta] = useState(false);
  const [showEfec, setShowEfec] = useState(false);
  const [showCompraBudget, setShowCompraBudget] = useState(false);
  const [compraBudgetLoading, setCompraBudgetLoading] = useState(false);
  const [compraBudgetError, setCompraBudgetError] = useState('');
  const [compraBudget, setCompraBudget] = useState(null);
  const [compraBudgetTc, setCompraBudgetTc] = useState('3.5');
  const [compraBudgetThirdParty, setCompraBudgetThirdParty] = useState('');
  const [compraBudgetExtras, setCompraBudgetExtras] = useState('');
  const [showCompraBudgetTotals, setShowCompraBudgetTotals] = useState(false);
  const [compraBudgetCustomPct, setCompraBudgetCustomPct] = useState('20');
  const [editingGasto, setEditingGasto] = useState(null);
  const [creditCardFilter, setCreditCardFilter] = useState('all');

  const token = localStorage.getItem('token');
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStorage.getItem('user')]);
  const isAdmin = user?.role === 'admin';
  const targetUserId = externalUserId ?? user?.id;
  const selectedUser = useMemo(() => {
    if (String(targetUserId || '') === String(user?.id || '')) return user;
    try {
      const stored = JSON.parse(localStorage.getItem('gastos:selectedUser') || 'null');
      if (stored && String(stored.id || '') === String(targetUserId || '')) return stored;
    } catch {}
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId, user?.id, user?.username]);
  const targetSellerSlug = selectedUser?.role === 'admin'
    ? 'gonzalo'
    : normalizeSellerSlug(selectedUser?.username || user?.username || '');
  const cacheKey = useMemo(() => `gastos-panel-cache:${targetUserId ?? 'self'}`, [targetUserId]);
  const rememberTargetUser = () => {
    if (targetUserId == null) return;
    try {
      localStorage.setItem('gastos:selectedUserId', String(targetUserId));
    } catch {}
  };

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
        if (cached.conceptCategories) setConceptCategories(cached.conceptCategories);
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

      const [gRes, cRes, wRes, conceptsRes] = await Promise.all([
        gastosPromise,
        fetch(cardsUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(walletUrl, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/catalog/expense-concepts`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);

      if (shouldLoadGastos && gRes && !gRes.ok) throw new Error(`GET ${gastosUrl} -> ${await gRes.text()}`);
      if (!cRes.ok) throw new Error(`GET ${cardsUrl} -> ${await cRes.text()}`);
      if (!wRes.ok) throw new Error(`GET ${walletUrl} -> ${await wRes.text()}`);

      const [gData, cData, wData, conceptsData] = await Promise.all([
        shouldLoadGastos && gRes ? gRes.json() : Promise.resolve(null),
        cRes.json(),
        wRes.json(),
        conceptsRes?.ok ? conceptsRes.json() : Promise.resolve([]),
      ]);

      const nextRows = shouldLoadGastos && gData ? sortRows(Array.isArray(gData) ? gData : []) : rows;
      if (shouldLoadGastos && gData) setRows(nextRows);
      setCardsSummary(Array.isArray(cData) ? cData : []);
      const nextConceptCategories = buildExpenseConceptCategoryMap(conceptsData);
      setConceptCategories(nextConceptCategories);
      const nextWallet = {
        efectivoPen: Number(wData?.efectivoPen || 0),
        efectivoUsd: Number(wData?.efectivoUsd || 0),
      };
      setWallet(nextWallet);
      writeCache({
        rows: nextRows,
        cardsSummary: Array.isArray(cData) ? cData : [],
        wallet: nextWallet,
        conceptCategories: nextConceptCategories,
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

  const displayConcepto = (c, metodoPago = '') => {
    const n = String(c || '').toLowerCase().replace(/\s+/g,'_');
    if (n === 'gastos_recurrentes') return 'Gastos mensuales';
    if (n === 'cashback') return 'Devo/Cash';
    if (n === 'bolsa') return 'Bolsa';
    if (n === 'inversion') return metodoPago === 'debito' ? 'Bolsa' : 'Inversion';
    return String(c || '').replace(/_/g,' ');
  };
  const getDebitUsdEquivalent = (g) => {
    if (!g || g.metodoPago !== 'debito' || g.moneda !== 'PEN') return null;
    const isUsdTarget = g.pagoObjetivo === 'USD' || g.montoUsdAplicado != null;
    if (!isUsdTarget) return null;
    const explicitUsd = Number(g.montoUsdAplicado);
    if (Number.isFinite(explicitUsd) && explicitUsd > 0) return explicitUsd;
    const amountPen = Number(g.monto);
    const tc = Number(g.tasaUsdPen);
    if (!Number.isFinite(amountPen) || amountPen <= 0 || !Number.isFinite(tc) || tc <= 0) return null;
    return amountPen / tc;
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
      if (isIncomeExpenseConcept(g.concepto, conceptCategories)) delta += m; else delta -= m;
    }
    return (Number(wallet.efectivoPen || 0) + delta).toFixed(2);
  }, [rows, wallet.efectivoPen, conceptCategories]);

  // Efectivo calculado (USD)
  const efectivoUsdCalc = useMemo(() => {
    let delta = 0;
    for (const g of rows) {
      const m = Number(g.monto) || 0;
      if (g.moneda !== 'USD') continue;
      if (g.metodoPago !== 'debito') continue;
      if (isIncomeExpenseConcept(g.concepto, conceptCategories)) delta += m; else delta -= m;
    }
    return (Number(wallet.efectivoUsd || 0) + delta).toFixed(2);
  }, [rows, wallet.efectivoUsd, conceptCategories]);

  const openDeb = () => setShowDeb(true);
  const openCre = () => setShowCre(true);
  const openCreBulk = () => setShowCreBulk(true);
  const openTar = () => setShowTar(true);
  const openCG = () => setShowCG(true);
  const openCiclosTarjeta = () => setShowCiclosTarjeta(true);
  const openEfec = () => setShowEfec(true);
  const openEdit = (g) => setEditingGasto(g);
  const openCompraBudget = async () => {
    setShowCompraBudget(true);
    setCompraBudgetError('');
    setCompraBudgetLoading(true);
    setShowCompraBudgetTotals(false);
    try {
      const [analytics, adelantosData] = targetSellerSlug
        ? await Promise.all([
            getAnalyticsSummary({ vendedor: targetSellerSlug }),
            fetch(`${API_URL}/ventas/adelantos/ultimos`, {
              headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            })
              .then((res) => (res.ok ? res.json() : []))
              .catch(() => []),
          ])
        : [null, []];
      const summary = analytics?.summary || {};
      const comprasPeriodo = Array.isArray(analytics?.comprasPeriodo) ? analytics.comprasPeriodo : [];
      const productShareById = new Map(
        comprasPeriodo.map((p) => [Number(p?.productoId), Number(p?.participacion ?? 1) || 1]),
      );
      const activeAdelantos = (Array.isArray(adelantosData) ? adelantosData : []).filter((a) =>
        productShareById.has(Number(a?.productoId)),
      );
      const adelantosPen = activeAdelantos.reduce((sum, a) => {
        const share = productShareById.get(Number(a?.productoId)) || 1;
        const amount = Number(a?.montoAdelanto || 0);
        return Number.isFinite(amount) ? sum + amount * share : sum;
      }, 0);
      const adelantosSaldoPen = activeAdelantos.reduce((sum, a) => {
        const share = productShareById.get(Number(a?.productoId)) || 1;
        const venta = Number(a?.montoVenta || 0);
        const adelanto = Number(a?.montoAdelanto || 0);
        const saldo = Math.max(0, venta - adelanto);
        return Number.isFinite(saldo) ? sum + saldo * share : sum;
      }, 0);

      setCompraBudget({
        seller: sellerLabel(targetSellerSlug),
        totalCardUsd: Number(cardsTotals.usd || 0),
        totalCardPen: Number(cardsTotals.pen || 0),
        capitalInmovilizadoProductoPen: Number(summary?.capitalInmovilizadoProducto || 0),
        capitalInmovilizadoEnvioPen: Number(summary?.capitalInmovilizadoEnvio || 0),
        capitalInmovilizadoPen: Number(summary?.capitalInmovilizado || 0),
        adelantosPen,
        adelantosSaldoPen,
        activeAdelantosCount: activeAdelantos.length,
        investmentRowsCount: comprasPeriodo.length,
        activeCount: Number(summary?.inventoryActiveUnits || 0),
      });
    } catch (e) {
      console.error('[GastosPanel] presupuesto comprar:', e);
      setCompraBudgetError('No se pudo calcular el presupuesto para comprar.');
      setCompraBudget(null);
    } finally {
      setCompraBudgetLoading(false);
    }
  };

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

  const compraBudgetCalc = useMemo(() => {
    if (!compraBudget) return null;
    const tc = Number(compraBudgetTc);
    const rate = Number.isFinite(tc) && tc > 0 ? tc : 3.5;
    const thirdPartyUsd = Math.max(0, parseUsdAmountsText(compraBudgetThirdParty));
    const manualExtrasPen = Math.max(0, parseUsdAmountsText(compraBudgetExtras));
    const adelantosSaldoPen = Math.max(0, Number(compraBudget.adelantosSaldoPen || 0) || 0);
    const extrasPen = manualExtrasPen + adelantosSaldoPen;
    const extrasUsd = extrasPen / rate;
    const advanceDiscountPen = Math.max(0, Number(compraBudget.adelantosPen || 0) || 0);
    const advanceDiscountUsd = advanceDiscountPen / rate;
    const investedRawPen = Number(compraBudget.capitalInmovilizadoPen || 0) || 0;
    const investedRawUsd = investedRawPen / rate;
    const investedOwnUsd = Math.max(0, investedRawUsd - thirdPartyUsd - advanceDiscountUsd);
    const investedOwnPen = investedOwnUsd * rate;
    const cashUsd = (Number(efectivoUsdCalc || 0) || 0) + ((Number(efectivoPenCalc || 0) || 0) / rate);
    const cashPen = cashUsd * rate;
    const totalSpentUsd =
      (Number(compraBudget.totalCardUsd || 0) || 0) +
      ((Number(compraBudget.totalCardPen || 0) || 0) / rate);
    const totalSpentPen = totalSpentUsd * rate;
    const remainingUsd = investedOwnUsd + cashUsd + extrasUsd - totalSpentUsd;
    const remainingPen = remainingUsd * rate;
    const fixedPct = 20;
    const customPctRaw = Number(compraBudgetCustomPct);
    const customPct = Number.isFinite(customPctRaw) ? customPctRaw : 0;
    const fixedGainUsd = investedOwnUsd * (fixedPct / 100);
    const customGainUsd = investedOwnUsd * (customPct / 100);
    const withFixedPctUsd = investedOwnUsd + fixedGainUsd + cashUsd + extrasUsd - totalSpentUsd;
    const withCustomPctUsd = investedOwnUsd + customGainUsd + cashUsd + extrasUsd - totalSpentUsd;

    return {
      rate,
      thirdPartyUsd,
      manualExtrasPen,
      extrasPen,
      extrasUsd,
      adelantosSaldoPen,
      advanceDiscountPen,
      advanceDiscountUsd,
      investedRawUsd,
      investedRawPen,
      investedOwnUsd,
      investedOwnPen,
      cashUsd,
      cashPen,
      totalSpentUsd,
      totalSpentPen,
      remainingUsd,
      remainingPen,
      fixedPct,
      customPct,
      fixedGainUsd,
      customGainUsd,
      withFixedPctUsd,
      withCustomPctUsd,
      withFixedPctPen: withFixedPctUsd * rate,
      withCustomPctPen: withCustomPctUsd * rate,
      efectivoPenUsd: (Number(efectivoPenCalc || 0) || 0) / rate,
      efectivoUsd: Number(efectivoUsdCalc || 0) || 0,
    };
  }, [compraBudget, compraBudgetTc, compraBudgetThirdParty, compraBudgetExtras, compraBudgetCustomPct, efectivoPenCalc, efectivoUsdCalc]);

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
                <button onClick={openCiclosTarjeta} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 min-h-[40px]">Pagos por ciclo</button>
                <button onClick={() => setShowAnalisisMes(true)} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 min-h-[40px]">Analisis de gastos</button>
                <button onClick={openCompraBudget} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 min-h-[40px]">Ver para compra</button>
                {typeof setVista === 'function' && (
                  <button
                    onClick={() => {
                      rememberTargetUser();
                      setVista('presupuestoGastos');
                    }}
                    className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded bg-amber-600 text-white hover:bg-amber-700 min-h-[40px]"
                  >
                    Presupuesto de gastos
                  </button>
                )}
                <button onClick={openTar} className="w-full sm:w-auto text-sm px-3 py-2 sm:py-1.5 rounded border border-indigo-200 text-indigo-700 hover:bg-indigo-50 min-h-[40px]">Ingresar linea de credito / Tarjeta</button>
              </div>
            </div>

            {cardsSummary.length === 0 ? (
              <div className="text-sm text-gray-600">Aun no has agregado tarjetas.</div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cardsSummary.map((c) => (
                  <div key={c.id} className="rounded-xl ring-1 ring-gray-200 bg-white p-4 hover:shadow-sm transition">
                    <div className="text-sm text-gray-600">{CARD_LABEL[c.tipo] || c.tipo}</div>
                    <div className="mt-1 text-xs text-gray-500">Linea: S/ {Number(c.creditLine).toFixed(2)}</div>
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
                      : displayConcepto(g.concepto, g.metodoPago);
                    const detalle = g.notas || '-';
                    const usdEquivalent = getDebitUsdEquivalent(g);
                    return (
                    <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="p-2 align-top">{g.fecha}</td>
                        <td className="p-2 align-top capitalize">{conceptoCell}</td>
                        <td className="p-2 align-top">{CARD_LABEL[g.tarjeta] || g.tarjeta || '-'}</td>
                        <td className="p-2 align-top">{detalle}</td>
                        <td className="p-2 align-top">
                          <div className="font-semibold">{fmtMoney(g.moneda, g.monto)}</div>
                          {usdEquivalent != null && (
                            <div className="mt-0.5 text-xs font-normal text-gray-500">
                              $ {usdEquivalent.toFixed(2)}
                            </div>
                          )}
                        </td>
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
                      <td className="p-2 align-top capitalize">{displayConcepto(g.concepto, g.metodoPago)}</td>
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
      {showCiclosTarjeta && (
        <ModalCiclosTarjeta
          rows={rows}
          cards={cardsSummary}
          onClose={() => setShowCiclosTarjeta(false)}
        />
      )}
      {showCompraBudget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Presupuesto para comprar</h3>
                <div className="text-sm text-gray-500">
                  {compraBudget?.seller ? `Vendedor: ${compraBudget.seller}` : 'Vendedor no asociado al usuario'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCompraBudget(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cerrar
              </button>
            </div>

            <div className="p-5">
              {compraBudgetLoading ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-600">
                  Calculando presupuesto...
                </div>
              ) : compraBudgetError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {compraBudgetError}
                </div>
              ) : !compraBudget?.seller ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Este usuario no coincide con un vendedor conocido. Usa usuarios como Gonzalo o Renato para cruzar gastos con productos.
                </div>
              ) : compraBudgetCalc && (
                <>
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-sm text-gray-700">
                      Tipo de cambio para este calculo
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={compraBudgetTc}
                        onChange={(e) => setCompraBudgetTc(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      Montos de terceros a restar del invertido (US$)
                      <textarea
                        value={compraBudgetThirdParty}
                        onChange={(e) => setCompraBudgetThirdParty(e.target.value)}
                        placeholder={'100\n250.50'}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                    <label className="text-sm text-gray-700">
                      Extras manuales a sumar (S/)
                      <textarea
                        value={compraBudgetExtras}
                        onChange={(e) => setCompraBudgetExtras(e.target.value)}
                        placeholder={'100\n250.50'}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                    </label>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Gastado total</div>
                      <div className="mt-2 text-2xl font-semibold text-gray-900">{fmtUsd(compraBudgetCalc.totalSpentUsd)}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-700">{fmtPen(compraBudgetCalc.totalSpentPen)}</div>
                      <div className="mt-1 text-xs text-gray-500">Gasto total general</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Invertido propio</div>
                      <div className="mt-2 text-2xl font-semibold text-gray-900">{fmtUsd(compraBudgetCalc.investedOwnUsd)}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-700">{fmtPen(compraBudgetCalc.investedOwnPen)}</div>
                      <div className="mt-1 text-xs text-gray-500">Capital inmovilizado</div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Efectivo</div>
                      <div className="mt-2 text-2xl font-semibold text-gray-900">{fmtUsd(compraBudgetCalc.cashUsd)}</div>
                      <div className="mt-1 text-sm font-semibold text-gray-700">{fmtPen(compraBudgetCalc.cashPen)}</div>
                      <div className="mt-1 text-xs text-gray-500">USD + PEN convertido</div>
                    </div>
                    <div className={`rounded-xl border p-4 ${compraBudgetCalc.remainingUsd >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                      <div className={`text-xs font-semibold uppercase tracking-wide ${compraBudgetCalc.remainingUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Resultado</div>
                      <div className={`mt-2 text-2xl font-semibold ${compraBudgetCalc.remainingUsd >= 0 ? 'text-emerald-900' : 'text-red-900'}`}>{fmtUsd(compraBudgetCalc.remainingUsd)}</div>
                      <div className={`mt-1 text-sm font-semibold ${compraBudgetCalc.remainingUsd >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>{fmtPen(compraBudgetCalc.remainingPen)}</div>
                      <div className={`mt-1 text-xs ${compraBudgetCalc.remainingUsd >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>Invertido + efectivo + extras - gastado</div>
                    </div>
                  </div>

                  {(compraBudgetCalc.advanceDiscountPen > 0 || compraBudgetCalc.adelantosSaldoPen > 0) && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                      Adelantos descontados del invertido: {fmtPen(compraBudgetCalc.advanceDiscountPen)}.
                      {' '}Saldo pendiente sumado a extras: {fmtPen(compraBudgetCalc.adelantosSaldoPen)}.
                    </div>
                  )}

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => setShowCompraBudgetTotals((prev) => !prev)}
                      className="w-full rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700 sm:w-auto"
                    >
                      {showCompraBudgetTotals ? 'Ocultar total' : 'Ver total'}
                    </button>
                  </div>

                  {showCompraBudgetTotals && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <div className="text-sm font-semibold text-emerald-900">Total con 20%</div>
                        <div className="mt-2 text-2xl font-semibold text-emerald-950">{fmtUsd(compraBudgetCalc.withFixedPctUsd)}</div>
                        <div className="mt-1 text-sm text-emerald-800">{fmtPen(compraBudgetCalc.withFixedPctPen)}</div>
                        <div className="mt-2 text-xs text-emerald-700">Solo suma 20% del invertido propio. Efectivo y extras quedan fijos.</div>
                      </div>
                      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                        <label className="text-sm font-semibold text-gray-900">
                          Total con porcentaje
                          <input
                            type="number"
                            step="0.1"
                            value={compraBudgetCustomPct}
                            onChange={(e) => setCompraBudgetCustomPct(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          />
                        </label>
                        <div className="mt-3 text-2xl font-semibold text-gray-950">{fmtUsd(compraBudgetCalc.withCustomPctUsd)}</div>
                        <div className="mt-1 text-sm text-gray-700">{fmtPen(compraBudgetCalc.withCustomPctPen)}</div>
                        <div className="mt-2 text-xs text-gray-500">Solo suma el porcentaje del invertido propio. Efectivo y extras quedan fijos.</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {showAnalisisMes && (
        <ModalAnalisisGastosMes
          rows={rows}
          onClose={() => setShowAnalisisMes(false)}
          onFullAnalysis={setVista ? () => {
            rememberTargetUser();
            setVista('analisisGastos');
          } : null}
        />
      )}
    </div>
  );
}





