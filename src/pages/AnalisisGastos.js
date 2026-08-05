import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from '../api';
import LoginGastos from './LoginGastos';
import { buildExpenseConceptCategoryMap, isCardPaymentExpenseConcept, isIncomeExpenseConcept, isInvestmentExpenseConcept, isLifeExpenseConcept } from '../utils/expenseConcepts';

const TIPO_CAMBIO = 3.7;
const SELLERS = ['gonzalo', 'renato'];
const SPLIT_VENDOR = 'ambos';
const SPLIT_SHARE = 0.5;

const normalizeConcept = (c) => String(c || '').trim().toLowerCase().replace(/\s+/g, '_');
const isInvestmentPanelConcept = (concept, categories = {}) => {
  const n = normalizeConcept(concept);
  return isInvestmentExpenseConcept(n, categories) || n === 'pago_envios';
};
const displayConcepto = (c, metodoPago = '') => {
  const n = normalizeConcept(c);
  if (n === 'bolsa') return 'Bolsa';
  if (n === 'inversion') return metodoPago === 'debito' ? 'Bolsa' : 'Inversion';
  return String(c || '').replace(/_/g, ' ');
};
const sumValues = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]);
const safeFilePart = (value) => String(value || '').trim().replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'gastos';
const normalizeSeller = (s) => (s == null ? '' : String(s).trim().toLowerCase());
const readSessionUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
};
const readSelectedGastosUser = (sessionUser) => {
  if (sessionUser?.role !== 'admin') return sessionUser;
  try {
    const raw = localStorage.getItem('gastos:selectedUser');
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.id) return parsed;
  } catch {}
  try {
    const id = Number(localStorage.getItem('gastos:selectedUserId') || 0);
    if (id > 0) return { id };
  } catch {}
  return sessionUser;
};
const sellerFromUser = (user) => {
  const username = normalizeSeller(user?.username);
  if (username === 'admin') return 'gonzalo';
  if (username === 'renato') return 'renato';
  if (username.includes('renato')) return 'renato';
  if (username.includes('gonzalo') || username.includes('gonga')) return 'gonzalo';
  return '';
};
const getVentaSeller = (venta) =>
  normalizeSeller(venta?.vendedor ?? venta?.producto?.vendedor);
const isSellerMatch = (ventaSeller, targetSeller) => {
  const seller = normalizeSeller(ventaSeller);
  const target = normalizeSeller(targetSeller);
  if (!seller || !target) return false;
  if (seller === target) return true;
  if (target === 'gonzalo' && /^gonzalo\s*\([^)]+\)$/.test(seller)) return true;
  return false;
};
const getProductoSeller = (producto) => normalizeSeller(producto?.vendedor);
const shareForSeller = (venta, seller) => {
  const vend = getVentaSeller(venta);
  const target = normalizeSeller(seller);
  if (!vend || !target) return 0;
  if (isSellerMatch(vend, target)) return 1;
  if (vend === SPLIT_VENDOR && SELLERS.includes(target)) return SPLIT_SHARE;
  return 0;
};
const shareForProductoSeller = (producto, seller) => {
  const vend = getProductoSeller(producto);
  const target = normalizeSeller(seller);
  if (!vend || !target) return 0;
  if (vend === target) return 1;
  if (vend === SPLIT_VENDOR && SELLERS.includes(target)) return SPLIT_SHARE;
  return 0;
};
const getSplitNetProfit = (venta, seller) => {
  const valorUsd = Number(venta?.producto?.valor?.valorProducto ?? 0) || 0;
  const envio = Number(venta?.producto?.valor?.costoEnvioProrrateado ?? venta?.producto?.valor?.costoEnvio ?? 0) || 0;
  const baseRate = Number(venta?.tipoCambio ?? 0) || 0;
  const sellerSlug = normalizeSeller(seller);
  const sellerRate = sellerSlug === 'gonzalo'
    ? Number(venta?.tipoCambioGonzalo ?? baseRate) || baseRate
    : sellerSlug === 'renato'
      ? Number(venta?.tipoCambioRenato ?? baseRate) || baseRate
      : baseRate;
  return (Number(venta?.precioVenta ?? 0) || 0) / 2 - (valorUsd / 2) * sellerRate - envio / 2;
};
const getNetProfitForSeller = (venta, seller) => {
  const share = shareForSeller(venta, seller);
  if (!share) return 0;
  if (getVentaSeller(venta) === SPLIT_VENDOR) return getSplitNetProfit(venta, seller);
  const precioVenta = Number(venta?.precioVenta ?? 0) || 0;
  const costoTotal = Number(venta?.producto?.valor?.costoTotal ?? 0) || 0;
  return (Number(venta?.ganancia ?? (precioVenta - costoTotal)) || 0) * share;
};

export default function AnalisisGastos({ setVista }) {
  const [session, setSession] = useState(() => ({
    user: readSessionUser(),
    token: localStorage.getItem('token') || '',
  }));
  const sessionUser = session.user;
  const targetUser = useMemo(() => readSelectedGastosUser(sessionUser), [sessionUser]);
  const userSeller = useMemo(() => sellerFromUser(targetUser?.username ? targetUser : sessionUser), [targetUser, sessionUser]);
  const [rows, setRows] = useState([]);
  const [conceptCategories, setConceptCategories] = useState({});
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [showPie, setShowPie] = useState(false);
  const [pieConceptMode, setPieConceptMode] = useState('separado');
  const [showPieVida, setShowPieVida] = useState(false);
  const [vidaConceptDetail, setVidaConceptDetail] = useState(null);
  const [investmentConceptDetail, setInvestmentConceptDetail] = useState(null);
  const [showBolsaModal, setShowBolsaModal] = useState(false);
  const [bolsaModalAction, setBolsaModalAction] = useState('invest');
  const [bolsaPaymentMode, setBolsaPaymentMode] = useState('todo');
  const [bolsaPaymentAmount, setBolsaPaymentAmount] = useState('');
  const [bolsaPaymentDate, setBolsaPaymentDate] = useState('');
  const [bolsaSaving, setBolsaSaving] = useState(false);
  const [bolsaError, setBolsaError] = useState('');
  const [selectedPersona, setSelectedPersona] = useState(() => sellerFromUser(readSelectedGastosUser(readSessionUser())) || 'gonzalo');

  const today = new Date();
  const [month, setMonth] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);

  useEffect(() => {
    if (!session.token || !sessionUser) {
      setLoading(false);
      return;
    }
    const load = async () => {
      try {
        setErr('');
        setLoading(true);
        const token = session.token;
        const user = sessionUser || readSessionUser();
        const isAdmin = user?.role === 'admin';
        const targetId = targetUser?.id || user?.id;
        const userIdParam = isAdmin && targetId ? `?userId=${encodeURIComponent(String(targetId))}` : '';
        const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
        const gastosUrl = isAdmin ? `${API_URL}/gastos/all${userIdParam}` : `${API_URL}/gastos`;
        // Se cargan todas las ventas para que el bruto coincida con Ganancias.
        const ventasUrl = `${API_URL}/ventas`;

        const [resGastos, resVentas, resProductos, resConcepts] = await Promise.all([
          fetch(gastosUrl, { headers }),
          fetch(ventasUrl, { headers }),
          fetch(`${API_URL}/productos`, { headers }),
          fetch(`${API_URL}/catalog/expense-concepts`, { headers }).catch(() => null),
        ]);
        if (!resGastos.ok) throw new Error(`GET ${gastosUrl} -> ${await resGastos.text()}`);
        if (!resVentas.ok) throw new Error(`GET ${ventasUrl} -> ${await resVentas.text()}`);
        if (!resProductos.ok) throw new Error(`GET ${API_URL}/productos -> ${await resProductos.text()}`);

        const [dataGastos, dataVentas, dataProductos] = await Promise.all([resGastos.json(), resVentas.json(), resProductos.json()]);
        setRows(Array.isArray(dataGastos) ? dataGastos : []);
        setVentas(Array.isArray(dataVentas) ? dataVentas : []);
        setProductos(Array.isArray(dataProductos) ? dataProductos : []);
        if (resConcepts?.ok) {
          const dataConcepts = await resConcepts.json();
          setConceptCategories(buildExpenseConceptCategoryMap(dataConcepts));
        } else {
          setConceptCategories({});
        }
      } catch (e) {
        console.error('[AnalisisGastos] load error', e);
        setErr('No se pudo cargar los gastos y ventas.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [session.token, sessionUser, targetUser?.id, userSeller]);

  useEffect(() => {
    if (userSeller) setSelectedPersona(userSeller);
  }, [userSeller]);

  const monthRange = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    if (!year || !monthNumber) return { from: '', to: '' };
    const lastDay = new Date(year, monthNumber, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [month]);
  const filtered = useMemo(
    () => rows.filter((r) => {
      const date = String(r.fecha || '').slice(0, 10);
      return date >= monthRange.from && date <= monthRange.to;
    }),
    [rows, monthRange],
  );
  const gastosSolo = useMemo(
    () => filtered.filter((r) => {
      const c = normalizeConcept(r.concepto);
      return !isIncomeExpenseConcept(c, conceptCategories) && !isCardPaymentExpenseConcept(c, conceptCategories);
    }),
    [filtered, conceptCategories],
  );
  const gastosTodosMes = useMemo(
    () => filtered.filter((r) => {
      const c = normalizeConcept(r.concepto);
      return !isIncomeExpenseConcept(c, conceptCategories) && !isCardPaymentExpenseConcept(c, conceptCategories);
    }),
    [filtered, conceptCategories],
  );

  const toPen = (r) => {
    const m = Number(r.monto) || 0;
    return r.moneda === 'USD' ? m * TIPO_CAMBIO : m;
  };
  const getUsdEquivalent = (r) => {
    if (!r) return null;
    const explicitUsd = Number(r.montoUsdAplicado);
    if (Number.isFinite(explicitUsd) && explicitUsd > 0) return explicitUsd;

    const amount = Number(r.monto);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    if (r.moneda === 'USD') return amount;

    const isUsdTarget = r.metodoPago === 'debito' && r.moneda === 'PEN' && r.pagoObjetivo === 'USD';
    if (!isUsdTarget) return null;

    const tc = Number(r.tasaUsdPen);
    if (!Number.isFinite(tc) || tc <= 0) return null;
    return amount / tc;
  };

  const totalPen = gastosSolo.reduce((sum, r) => sum + toPen(r), 0);
  const totalTodoGastoPen = gastosTodosMes.reduce((sum, r) => sum + toPen(r), 0);
  const totalDebitoPen = useMemo(
    () => gastosSolo.filter((r) => r.metodoPago === 'debito').reduce((s, r) => s + toPen(r), 0),
    [gastosSolo],
  );
  const totalCreditoPen = useMemo(
    () => gastosSolo.filter((r) => r.metodoPago === 'credito').reduce((s, r) => s + toPen(r), 0),
    [gastosSolo],
  );
  const byConceptCredito = gastosSolo
    .filter((r) => r.metodoPago === 'credito')
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros', r.metodoPago);
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byConceptDebito = gastosSolo
    .filter((r) => r.metodoPago === 'debito')
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros', r.metodoPago);
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byConceptUnificado = useMemo(() => {
    const acc = {};
    [byConceptCredito, byConceptDebito].forEach((map) => {
      Object.entries(map).forEach(([key, value]) => {
        acc[key] = (acc[key] || 0) + Number(value || 0);
      });
    });
    return acc;
  }, [byConceptCredito, byConceptDebito]);
  const totalConceptosUnificadoPen = totalCreditoPen + totalDebitoPen;
  const byTarjeta = gastosSolo
    .filter((r) => r.metodoPago === 'credito')
    .reduce((acc, r) => {
      const key = r.tarjeta || 'N/A';
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const byConceptVida = gastosSolo
    .filter((r) => isLifeExpenseConcept(r.concepto, conceptCategories))
    .reduce((acc, r) => {
      const key = displayConcepto(r.concepto || 'otros', r.metodoPago);
      acc[key] = (acc[key] || 0) + toPen(r);
      return acc;
    }, {});
  const investmentMovs = useMemo(
    () => gastosSolo.filter((r) => isInvestmentPanelConcept(r.concepto, conceptCategories)),
    [gastosSolo, conceptCategories],
  );
  const byConceptInvestment = investmentMovs.reduce((acc, r) => {
    const key = displayConcepto(r.concepto || 'otros', r.metodoPago);
    acc[key] = (acc[key] || 0) + toPen(r);
    return acc;
  }, {});
  const investmentTotalPen = investmentMovs.reduce((sum, r) => sum + toPen(r), 0);

  const ventasMes = useMemo(
    () =>
      ventas.filter((v) => {
        const fecha = (v.fechaVenta || v.createdAt || '').slice(0, 7);
        return fecha === month;
      }),
    [ventas, month],
  );

  const productosMes = useMemo(
    () =>
      productos.filter((p) => {
        const fecha = (p?.valor?.fechaCompra || p?.fechaCompra || '').slice(0, 7);
        return fecha === month;
      }),
    [productos, month],
  );

  const ingresosBrutosPorPersona = useMemo(() => {
    const totals = { gonzalo: 0, renato: 0 };
    ventasMes.forEach((venta) => {
      SELLERS.forEach((seller) => {
        const share = shareForSeller(venta, seller);
        if (share) totals[seller] += (Number(venta?.precioVenta ?? 0) || 0) * share;
      });
    });
    return totals;
  }, [ventasMes]);

  const gananciasNetasPorPersona = useMemo(() => {
    const totales = { gonzalo: 0, renato: 0 };
    ventasMes.forEach((v) => {
      SELLERS.forEach((s) => {
        totales[s] += getNetProfitForSeller(v, s);
      });
    });
    return totales;
  }, [ventasMes]);

  const comprasInventarioPorPersona = useMemo(() => {
    const totales = { gonzalo: 0, renato: 0 };
    productosMes.forEach((p) => {
      const costo = Number(p?.valor?.costoTotal ?? 0) || 0;
      SELLERS.forEach((seller) => {
        const share = shareForProductoSeller(p, seller);
        if (!share) return;
        totales[seller] += costo * share;
      });
    });
    return totales;
  }, [productosMes]);

  const ingresoSeleccionado = ingresosBrutosPorPersona[selectedPersona] || 0;
  const gananciaNetaSeleccionada = gananciasNetasPorPersona[selectedPersona] || 0;
  const comprasInventarioSeleccionado = comprasInventarioPorPersona[selectedPersona] || 0;
  const gastoGeneralSeleccionado = totalTodoGastoPen;
  const balanceMes = ingresoSeleccionado - gastoGeneralSeleccionado;

  const carryoverByMonth = useMemo(() => {
    const monthKeys = new Set([month]);
    rows.forEach((row) => {
      const key = String(row?.fecha || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key) && key <= month) monthKeys.add(key);
    });
    ventas.forEach((venta) => {
      const key = String(venta?.fechaVenta || venta?.createdAt || '').slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(key) && key <= month) monthKeys.add(key);
    });

    let pendienteAnterior = 0;
    const result = new Map();
    Array.from(monthKeys).sort().forEach((key) => {
      const ingresoBruto = ventas.reduce((sum, venta) => {
        const ventaMonth = String(venta?.fechaVenta || venta?.createdAt || '').slice(0, 7);
        if (ventaMonth !== key) return sum;
        return sum + (Number(venta?.precioVenta ?? 0) || 0) * shareForSeller(venta, selectedPersona);
      }, 0);
      const gastoMes = rows.reduce((sum, row) => {
        if (String(row?.fecha || '').slice(0, 7) !== key) return sum;
        const concept = normalizeConcept(row?.concepto);
        if (isIncomeExpenseConcept(concept, conceptCategories) || isCardPaymentExpenseConcept(concept, conceptCategories)) return sum;
        return sum + toPen(row);
      }, 0);
      const resultadoMes = ingresoBruto - gastoMes;
      const resultadoFinal = resultadoMes - pendienteAnterior;
      const pendienteSiguiente = Math.max(0, -resultadoFinal);
      result.set(key, {
        ingresoBruto,
        gastoMes,
        resultadoMes,
        pendienteAnterior,
        resultadoFinal,
        pendienteSiguiente,
      });
      pendienteAnterior = pendienteSiguiente;
    });
    return result;
  }, [month, rows, ventas, selectedPersona, conceptCategories]);
  const currentCarryover = carryoverByMonth.get(month) || {
    pendienteAnterior: 0,
    resultadoFinal: balanceMes,
    pendienteSiguiente: Math.max(0, -balanceMes),
  };

  const daysInMonth = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return 30;
    return new Date(y, m, 0).getDate();
  }, [month]);

  const dailyTotals = useMemo(() => {
    const map = new Map();
    gastosSolo.forEach((r) => {
      const d = (r.fecha || '').slice(0, 10);
      map.set(d, (map.get(d) || 0) + toPen(r));
    });
    return Array.from(map.entries())
      .map(([d, v]) => ({ fecha: d, monto: v }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [gastosSolo]);
  const promedioDia = daysInMonth ? totalPen / daysInMonth : 0;
  const gastosVidaPen = useMemo(
    () =>
      gastosSolo
        .filter((r) => isLifeExpenseConcept(r.concepto, conceptCategories))
        .reduce((s, r) => s + toPen(r), 0),
    [gastosSolo, conceptCategories],
  );
  const gastosVidaMovs = useMemo(
    () =>
      gastosSolo.filter((r) => isLifeExpenseConcept(r.concepto, conceptCategories)),
    [gastosSolo, conceptCategories],
  );
  const vidaConceptRows = useMemo(() => {
    if (!vidaConceptDetail) return [];
    return gastosVidaMovs
      .filter((r) => displayConcepto(r.concepto || 'otros', r.metodoPago) === vidaConceptDetail)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.id || 0) - Number(a.id || 0));
  }, [gastosVidaMovs, vidaConceptDetail]);
  const vidaConceptTotal = vidaConceptRows.reduce((sum, r) => sum + toPen(r), 0);
  const investmentConceptRows = useMemo(() => {
    if (!investmentConceptDetail) return [];
    return investmentMovs
      .filter((r) => displayConcepto(r.concepto || 'otros', r.metodoPago) === investmentConceptDetail)
      .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')) || Number(b.id || 0) - Number(a.id || 0));
  }, [investmentMovs, investmentConceptDetail]);
  const investmentConceptTotal = investmentConceptRows.reduce((sum, r) => sum + toPen(r), 0);

  const prevMonthKey = useMemo(() => {
    const [y, m] = month.split('-').map(Number);
    if (!y || !m) return '';
    const dt = new Date(y, m - 1, 1);
    dt.setMonth(dt.getMonth() - 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
  }, [month]);
  const prevTotalPen = useMemo(
    () =>
      rows
        .filter((r) => {
          const c = normalizeConcept(r.concepto);
          return (r.fecha || '').startsWith(prevMonthKey) && c !== 'ingreso' && c !== 'pago_tarjeta';
        })
        .reduce((sum, r) => sum + toPen(r), 0),
    [rows, prevMonthKey],
  );
  const variationPct = prevTotalPen ? ((totalPen - prevTotalPen) / prevTotalPen) * 100 : 0;

  const bolsaProjection = useMemo(() => {
    const startMonth = '2026-01';
    if (!/^\d{4}-\d{2}$/.test(month) || month < startMonth) {
      return { enabled: false, calculatedMonthly: 0, monthly: 0, totalToInvest: 0, actualMonth: 0, pendingBefore: 0, pending: 0, credit: 0, requiredAccumulated: 0, investedAccumulated: 0 };
    }

    const months = [];
    const [endYear, endMonth] = month.split('-').map(Number);
    for (let year = 2026, monthNumber = 1; year < endYear || (year === endYear && monthNumber <= endMonth);) {
      months.push(`${year}-${String(monthNumber).padStart(2, '0')}`);
      monthNumber += 1;
      if (monthNumber > 12) {
        year += 1;
        monthNumber = 1;
      }
    }

    let balance = 0;
    let requiredAccumulated = 0;
    let investedAccumulated = 0;
    let current = null;
    months.forEach((monthKey) => {
      const grossIncome = ventas.reduce((sum, venta) => {
        const ventaMonth = String(venta?.fechaVenta || venta?.createdAt || '').slice(0, 7);
        if (ventaMonth !== monthKey) return sum;
        return sum + (Number(venta?.precioVenta ?? 0) || 0) * shareForSeller(venta, selectedPersona);
      }, 0);
      const calculatedMonthly = Math.max(0, grossIncome) * 0.02;
      const monthlyTarget = Math.max(1000, calculatedMonthly);
      const actual = rows.reduce((sum, row) => {
        if (String(row?.fecha || '').slice(0, 7) !== monthKey) return sum;
        if (normalizeConcept(row?.concepto) !== 'bolsa' || row?.metodoPago !== 'debito') return sum;
        return sum + toPen(row);
      }, 0);
      const pendingBefore = balance;
      const totalToInvest = Math.max(0, monthlyTarget + pendingBefore);
      requiredAccumulated += monthlyTarget;
      investedAccumulated += actual;
      balance += monthlyTarget - actual;
      if (monthKey === month) current = { calculatedMonthly, monthlyTarget, totalToInvest, actual, pendingBefore, balance, grossIncome };
    });

    const data = current || { calculatedMonthly: 0, monthlyTarget: 0, totalToInvest: 0, actual: 0, pendingBefore: 0, balance: 0, grossIncome: 0 };
    return {
      enabled: true,
      calculatedMonthly: data.calculatedMonthly,
      monthly: data.monthlyTarget,
      totalToInvest: data.totalToInvest,
      actualMonth: data.actual,
      monthDifference: data.actual - data.monthlyTarget,
      monthRemaining: Math.max(0, data.balance),
      pendingBefore: data.pendingBefore,
      pending: Math.max(0, data.balance),
      credit: Math.max(0, -data.balance),
      grossIncome: data.grossIncome,
      totalToDate: data.balance,
      requiredAccumulated,
      investedAccumulated,
    };
  }, [month, rows, ventas, selectedPersona]);

  const openBolsaModal = () => {
    if (!bolsaProjection.enabled) return;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const day = currentMonth === month
      ? String(now.getDate()).padStart(2, '0')
      : String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0');
    const isEditing = bolsaProjection.actualMonth > 0;
    setBolsaModalAction(isEditing ? 'edit' : 'invest');
    setBolsaPaymentMode(isEditing ? 'variable' : 'todo');
    setBolsaPaymentAmount((isEditing ? bolsaProjection.actualMonth : bolsaProjection.totalToInvest).toFixed(2));
    setBolsaPaymentDate(`${month}-${day}`);
    setBolsaError('');
    setShowBolsaModal(true);
  };

  const saveBolsaInvestment = async (event) => {
    event.preventDefault();
    if (bolsaSaving) return;
    const amount = bolsaPaymentMode === 'todo' ? bolsaProjection.totalToInvest : Number(bolsaPaymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setBolsaError('Ingresa un monto válido mayor a cero.');
      return;
    }
    if (!bolsaPaymentDate || !bolsaPaymentDate.startsWith(month)) {
      setBolsaError('La fecha debe pertenecer al mes seleccionado.');
      return;
    }

    try {
      setBolsaSaving(true);
      setBolsaError('');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` };
      const movements = rows
        .filter((row) => String(row?.fecha || '').startsWith(month) && normalizeConcept(row?.concepto) === 'bolsa' && row?.metodoPago === 'debito')
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));

      if (movements.length) {
        const [primary, ...duplicates] = movements;
        const response = await fetch(`${API_URL}/gastos/${primary.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ monto: Number(amount.toFixed(2)), moneda: 'PEN', fecha: bolsaPaymentDate, notas: `Inversión Bolsa - ${month}` }),
        });
        if (!response.ok) throw new Error('No se pudo editar la inversión.');
        const updated = await response.json();
        for (const duplicate of duplicates) {
          const deleteResponse = await fetch(`${API_URL}/gastos/${duplicate.id}`, { method: 'DELETE', headers });
          if (!deleteResponse.ok) throw new Error('La inversión se editó, pero no se pudieron unificar todos los registros del mes.');
        }
        const deletedIds = new Set(duplicates.map((movement) => movement.id));
        setRows((previous) => previous
          .filter((row) => !deletedIds.has(row.id))
          .map((row) => row.id === updated.id ? updated : row));
      } else {
        const isAdmin = sessionUser?.role === 'admin';
        const targetId = targetUser?.id || sessionUser?.id;
        const userIdParam = isAdmin && targetId ? `?userId=${encodeURIComponent(String(targetId))}` : '';
        const response = await fetch(`${API_URL}/gastos${userIdParam}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            concepto: 'bolsa',
            metodoPago: 'debito',
            moneda: 'PEN',
            monto: Number(amount.toFixed(2)),
            fecha: bolsaPaymentDate,
            notas: `Inversión Bolsa - ${month}`,
            allowDuplicate: true,
          }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || 'No se pudo registrar la inversión.');
        }
        const saved = await response.json();
        setRows((previous) => [saved, ...previous.filter((row) => row.id !== saved.id)]);
      }
      setShowBolsaModal(false);
    } catch (error) {
      setBolsaError(error?.message || 'No se pudo guardar la inversión.');
    } finally {
      setBolsaSaving(false);
    }
  };

  const deleteBolsaInvestment = async () => {
    if (bolsaSaving || bolsaProjection.actualMonth <= 0) return;
    try {
      setBolsaSaving(true);
      setBolsaError('');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}` };
      const movements = rows.filter((row) =>
        String(row?.fecha || '').startsWith(month)
        && normalizeConcept(row?.concepto) === 'bolsa'
        && row?.metodoPago === 'debito');
      for (const movement of movements) {
        const response = await fetch(`${API_URL}/gastos/${movement.id}`, { method: 'DELETE', headers });
        if (!response.ok) throw new Error('No se pudo eliminar la inversión registrada.');
        setRows((previous) => previous.filter((row) => row.id !== movement.id));
      }
      setShowBolsaModal(false);
    } catch (error) {
      setBolsaError(error?.message || 'No se pudo eliminar la inversión registrada.');
    } finally {
      setBolsaSaving(false);
    }
  };

  const buildPieData = (map, total) => {
    if (!total) return [];
    const palette = ['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#0ea5e9', '#f97316', '#14b8a6', '#a855f7', '#22c55e'];
    return sumValues(map).map(([label, val], idx) => ({
      label,
      pct: (val / total) * 100,
      monto: val,
      color: palette[idx % palette.length],
    }));
  };

  const pieDataDeb = useMemo(() => buildPieData(byConceptDebito, totalDebitoPen), [byConceptDebito, totalDebitoPen]);
  const pieDataCre = useMemo(() => buildPieData(byConceptCredito, totalCreditoPen), [byConceptCredito, totalCreditoPen]);
  const pieDataUnificado = useMemo(() => buildPieData(byConceptUnificado, totalConceptosUnificadoPen), [byConceptUnificado, totalConceptosUnificadoPen]);
  const pieDataVida = useMemo(() => buildPieData(byConceptVida, gastosVidaPen), [byConceptVida, gastosVidaPen]);

  const buildGradient = (data) => {
    if (!data.length) return 'conic-gradient(#e5e7eb 0deg 360deg)';
    let acc = 0;
    const stops = data.map(({ pct, color }) => {
      const start = acc;
      const end = acc + pct;
      acc = end;
      return `${color} ${start}% ${end}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };

  const pieGradientDeb = useMemo(() => buildGradient(pieDataDeb), [pieDataDeb]);
  const pieGradientCre = useMemo(() => buildGradient(pieDataCre), [pieDataCre]);
  const pieGradientUnificado = useMemo(() => buildGradient(pieDataUnificado), [pieDataUnificado]);
  const pieGradientVida = useMemo(() => buildGradient(pieDataVida), [pieDataVida]);
  const balanceVida = gananciaNetaSeleccionada - gastosVidaPen;

  const allLifeMovs = useMemo(
    () => rows.filter((r) => isLifeExpenseConcept(r.concepto, conceptCategories)),
    [rows, conceptCategories],
  );

  const buildLifeExpenseExport = () => {
    const normalizeRow = (r) => ({
      id: r.id,
      fecha: r.fecha || null,
      mes: String(r.fecha || '').slice(0, 7) || null,
      concepto: normalizeConcept(r.concepto),
      conceptoLabel: displayConcepto(r.concepto || 'otros', r.metodoPago),
      metodoPago: r.metodoPago || null,
      tarjetaOBanco: r.tarjeta || null,
      tarjetaPago: r.tarjetaPago || null,
      monedaOriginal: r.moneda || null,
      montoOriginal: Number(r.monto || 0),
      montoPen: +toPen(r).toFixed(2),
      montoUsdEquivalente: getUsdEquivalent(r) != null ? +getUsdEquivalent(r).toFixed(2) : null,
      tasaUsdPen: Number.isFinite(Number(r.tasaUsdPen)) ? Number(r.tasaUsdPen) : null,
      notas: r.notas || null,
      cuotasMeses: r.cuotasMeses ?? null,
      createdAt: r.createdAt || null,
      updatedAt: r.updatedAt || null,
    });
    const sumBy = (items, keyFn) => items.reduce((acc, item) => {
      const key = keyFn(item) || 'sin_dato';
      acc[key] = +((acc[key] || 0) + toPen(item)).toFixed(2);
      return acc;
    }, {});
    const historicalByMonth = allLifeMovs.reduce((acc, r) => {
      const key = String(r.fecha || '').slice(0, 7) || 'sin_mes';
      if (!acc[key]) acc[key] = { mes: key, totalPen: 0, movimientos: 0 };
      acc[key].totalPen = +(acc[key].totalPen + toPen(r)).toFixed(2);
      acc[key].movimientos += 1;
      return acc;
    }, {});

    return {
      tipo: 'gasto_de_vida_para_analisis_chatgpt',
      generadoEn: new Date().toISOString(),
      monedaBase: 'PEN',
      tipoCambioReferencia: TIPO_CAMBIO,
      instruccionParaChatGPT:
        'Analiza estos gastos de vida. Encuentra patrones, gastos altos, gastos repetidos, oportunidades de ahorro, categorias a revisar y acciones concretas para el siguiente mes.',
      usuario: {
        id: targetUser?.id || sessionUser?.id || null,
        username: targetUser?.username || sessionUser?.username || null,
        sellerAnalizado: selectedPersona,
      },
      periodoSeleccionado: {
        mes: month,
        totalPen: +gastosVidaPen.toFixed(2),
        movimientos: gastosVidaMovs.length,
        balanceVsGananciaNetaPen: +balanceVida.toFixed(2),
        gananciaNetaPen: +gananciaNetaSeleccionada.toFixed(2),
      },
      resumenMes: {
        porConceptoPen: Object.fromEntries(sumValues(byConceptVida).map(([k, v]) => [k, +v.toFixed(2)])),
        porMetodoPagoPen: sumBy(gastosVidaMovs, (r) => r.metodoPago),
        porTarjetaOBancoPen: sumBy(gastosVidaMovs, (r) => r.tarjeta || r.tarjetaPago || 'sin_tarjeta'),
        porDiaPen: dailyTotals
          .filter((d) => gastosVidaMovs.some((r) => String(r.fecha || '').slice(0, 10) === d.fecha))
          .map((d) => ({ fecha: d.fecha, totalPen: +d.monto.toFixed(2) })),
      },
      historicoGastoVida: Object.values(historicalByMonth).sort((a, b) => String(a.mes).localeCompare(String(b.mes))),
      movimientosMes: gastosVidaMovs
        .slice()
        .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.id || 0) - Number(b.id || 0))
        .map(normalizeRow),
      movimientosHistoricos: allLifeMovs
        .slice()
        .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')) || Number(a.id || 0) - Number(b.id || 0))
        .map(normalizeRow),
    };
  };

  const downloadLifeExpenseAnalysisFile = () => {
    const payload = buildLifeExpenseExport();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gasto_vida_chatgpt_${safeFilePart(month)}_${safeFilePart(targetUser?.username || sessionUser?.username)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (!session.token || !sessionUser) {
    return (
      <LoginGastos
        onLoggedIn={(user, token) => setSession({ user: user || null, token: token || '' })}
        onBack={() => (setVista ? setVista('home') : null)}
      />
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold">Analisis de gastos</h1>
            <p className="text-sm text-gray-600">Vista detallada por mes con cortes y sugerencias.</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700 flex items-center gap-2">
              Mes
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </label>
            {setVista && (
              <button
                onClick={() => setVista('gastos')}
                className="px-4 py-2 rounded-lg border text-sm bg-white hover:bg-gray-100 shadow-sm"
              >
                Volver
              </button>
            )}
          </div>
        </div>

        {err ? <div className="text-sm text-red-600">{err}</div> : null}

        {loading ? (
          <div className="text-sm text-gray-600">Cargando analisis...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Total gastado (mes)</div>
            <div className="text-2xl font-semibold mt-1">S/ {totalPen.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">{gastosSolo.length} movimientos</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Compras de productos (mes)</div>
            <div className="text-2xl font-semibold mt-1">S/ {comprasInventarioSeleccionado.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">Segun producto.vendedor para {selectedPersona}</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="text-sm text-gray-500">Promedio por dia</div>
            <div className="text-2xl font-semibold mt-1">S/ {promedioDia.toFixed(2)}</div>
            <div className="text-xs text-gray-500 mt-1">{daysInMonth} dias del mes</div>
          </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Comparacion vs mes anterior</div>
              <div className="text-2xl font-semibold mt-1">
                {prevTotalPen ? `${variationPct >= 0 ? '+' : ''}${variationPct.toFixed(1)}%` : 'Sin datos previos'}
              </div>
              <div className="text-xs text-gray-500 mt-1">Mes previo: S/ {prevTotalPen.toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">Inversión Bolsa</div>
                  <div className="text-2xl font-semibold mt-1 text-indigo-700">
                    {bolsaProjection.enabled ? `S/ ${bolsaProjection.totalToInvest.toFixed(2)}` : 'No aplica'}
                  </div>
                </div>
                {bolsaProjection.enabled && (
                  <button
                    type="button"
                    onClick={openBolsaModal}
                    className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700"
                  >
                    {bolsaProjection.actualMonth > 0 ? 'Editar inversión' : 'Registrar inversión'}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                {bolsaProjection.enabled
                  ? `Corresponde este mes: S/ ${bolsaProjection.monthly.toFixed(2)} (2% calculado: S/ ${bolsaProjection.calculatedMonthly.toFixed(2)})`
                  : 'El cálculo comienza en enero de 2026.'}
              </div>
              {bolsaProjection.enabled && (
                <div className="mt-1 space-y-0.5 text-xs">
                  <div className={bolsaProjection.pendingBefore > 0 ? 'text-amber-600' : bolsaProjection.pendingBefore < 0 ? 'text-green-600' : 'text-gray-400'}>
                    {bolsaProjection.pendingBefore > 0
                      ? `Faltante anterior: S/ ${bolsaProjection.pendingBefore.toFixed(2)}`
                      : bolsaProjection.pendingBefore < 0
                        ? `Excedente anterior: S/ ${Math.abs(bolsaProjection.pendingBefore).toFixed(2)}`
                        : 'Sin faltante ni excedente anterior.'}
                  </div>
                  <div className="text-gray-500">Registrado este mes: S/ {bolsaProjection.actualMonth.toFixed(2)}</div>
                  {bolsaProjection.actualMonth > 0 && (
                    <div className={bolsaProjection.credit > 0 ? 'text-green-600' : bolsaProjection.pending > 0 ? 'text-amber-600' : 'text-gray-500'}>
                      {bolsaProjection.credit > 0
                        ? `Excedente para el próximo mes: S/ ${bolsaProjection.credit.toFixed(2)}`
                        : bolsaProjection.pending > 0
                          ? `Faltante para el próximo mes: S/ ${bolsaProjection.pending.toFixed(2)}`
                          : 'Monto completo registrado.'}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-indigo-200 shadow-sm p-4">
              <div className="text-sm text-gray-500">Bolsa acumulado</div>
              <div className="text-2xl font-semibold mt-1 text-indigo-700">
                {bolsaProjection.enabled ? `S/ ${bolsaProjection.investedAccumulated.toFixed(2)}` : 'No aplica'}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {!bolsaProjection.enabled
                  ? 'Disponible desde enero de 2026.'
                  : 'Suma únicamente los montos que registraste en cada mes.'}
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div>
                <div className="text-sm text-gray-500">Balance ingreso - gasto</div>
                <div className="text-xs text-gray-500">Usa el mismo bruto por vendedor mostrado en Ganancias</div>
              </div>
              {userSeller ? (
                <span className="rounded-lg border bg-gray-50 px-3 py-1.5 text-sm capitalize text-gray-700">
                  {userSeller}
                </span>
              ) : (
                <select
                  value={selectedPersona}
                  onChange={(e) => setSelectedPersona(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm"
                >
                  {SELLERS.map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Ingreso bruto</div>
                <div className="text-lg font-semibold text-gray-900">S/ {ingresoSeleccionado.toFixed(2)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <div className="text-gray-500">Gasto total</div>
                  <div className="text-lg font-semibold text-gray-900">S/ {gastoGeneralSeleccionado.toFixed(2)}</div>
                  <div className="text-xs text-gray-500 mt-1">Del {monthRange.from} al {monthRange.to}</div>
                </div>
              <div className={`p-3 bg-gray-50 rounded-lg border ${balanceMes >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                <div className="text-gray-500">Resultado del mes</div>
                <div className={`text-lg font-semibold ${balanceMes >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceMes >= 0 ? '+' : '-'}S/ {Math.abs(balanceMes).toFixed(2)}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="text-amber-800">Excedente anterior</div>
                <div className="text-lg font-semibold text-amber-900">S/ {Number(currentCarryover.pendienteAnterior || 0).toFixed(2)}</div>
                <div className="text-xs text-amber-700 mt-1">Déficit pendiente del cierre anterior</div>
              </div>
              <div className={`p-3 rounded-lg border ${currentCarryover.resultadoFinal >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="text-gray-600">Resultado final</div>
                <div className={`text-lg font-semibold ${currentCarryover.resultadoFinal >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {currentCarryover.resultadoFinal >= 0 ? '+' : '-'}S/ {Math.abs(Number(currentCarryover.resultadoFinal || 0)).toFixed(2)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  {currentCarryover.pendienteSiguiente > 0
                    ? `Pasa S/ ${Number(currentCarryover.pendienteSiguiente).toFixed(2)} al próximo mes`
                    : 'Sin saldo pendiente para el próximo mes'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
              <div>
                <div className="text-sm text-gray-500">Balance gastos de vida</div>
                <div className="text-xs text-gray-500">Ganancia neta vs gasto vida (sin compras, inversion ni envios)</div>
              </div>
              {userSeller ? (
                <span className="rounded-lg border bg-gray-50 px-3 py-1.5 text-sm capitalize text-gray-700">
                  {userSeller}
                </span>
              ) : (
                <select
                  value={selectedPersona}
                  onChange={(e) => setSelectedPersona(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm"
                >
                  {SELLERS.map((s) => (
                    <option key={`vida-bal-${s}`} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Ingreso neto (ganancia)</div>
                <div className="text-lg font-semibold text-gray-900">S/ {gananciaNetaSeleccionada.toFixed(2)}</div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border">
                <div className="text-gray-500">Gasto vida</div>
                <div className="text-lg font-semibold text-gray-900">S/ {gastosVidaPen.toFixed(2)}</div>
                <div className="text-xs text-gray-500 mt-1">No incluye compras ni cuotas de compras.</div>
              </div>
              <div className={`p-3 bg-gray-50 rounded-lg border ${balanceVida >= 0 ? 'border-green-200' : 'border-red-200'}`}>
                <div className="text-gray-500">Resultado</div>
                <div className={`text-lg font-semibold ${balanceVida >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {balanceVida >= 0 ? '+' : '-'}S/ {Math.abs(balanceVida).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Gasto débito</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalDebitoPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Ticket prom.: S/ {(totalDebitoPen / Math.max(1, gastosSolo.filter(g=>g.metodoPago==='debito').length)).toFixed(2)}</div>
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="text-sm text-gray-500">Gasto crédito</div>
              <div className="text-2xl font-semibold mt-1">S/ {totalCreditoPen.toFixed(2)}</div>
              <div className="text-xs text-gray-500 mt-1">Ticket prom.: S/ {(totalCreditoPen / Math.max(1, gastosSolo.filter(g=>g.metodoPago==='credito').length)).toFixed(2)}</div>
            </div>
          </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-800">Gastos por concepto</h3>
                    <span className="text-xs text-gray-500">Credito y debito</span>
                  </div>
                  <button
                    onClick={() => {
                      setPieConceptMode('separado');
                      setShowPie(true);
                    }}
                    className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Ver grafico
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Credito</div>
                    {sumValues(byConceptCredito).length === 0 ? (
                      <div className="text-sm text-gray-500">Sin datos.</div>
                    ) : (
                      <ul className="space-y-1">
                        {sumValues(byConceptCredito).map(([k, v]) => (
                          <li key={`c-${k}`} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold">S/ {v.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-700 mb-2">Debito</div>
                    {sumValues(byConceptDebito).length === 0 ? (
                      <div className="text-sm text-gray-500">Sin datos.</div>
                    ) : (
                      <ul className="space-y-1">
                        {sumValues(byConceptDebito).map(([k, v]) => (
                          <li key={`d-${k}`} className="flex items-center justify-between text-sm">
                            <span className="capitalize">{k}</span>
                            <span className="font-semibold">S/ {v.toFixed(2)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-800">Gastos de vida</h3>
                    <span className="text-xs text-gray-500">Incluye debito y credito (sin inversion, bolsa ni envios)</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={downloadLifeExpenseAnalysisFile}
                      disabled={gastosVidaMovs.length === 0}
                      className="text-xs px-3 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Descargar para ChatGPT
                    </button>
                    <button
                      onClick={() => setShowPieVida(true)}
                      className="text-xs px-3 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                      Ver grafico
                    </button>
                  </div>
                </div>
                {sumValues(byConceptVida).length === 0 ? (
                  <div className="text-sm text-gray-500">Sin datos en el mes.</div>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {sumValues(byConceptVida).map(([k, v]) => (
                      <li key={`vida-${k}`}>
                        <button
                          type="button"
                          onClick={() => setVidaConceptDetail(k)}
                          className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-gray-50"
                        >
                          <span className="capitalize text-gray-800">{k}</span>
                          <span className="font-semibold text-gray-900">S/ {v.toFixed(2)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 text-xs text-gray-500">
                  Movs: {gastosVidaMovs.length} \u00b7 Total S/ {gastosVidaPen.toFixed(2)}
                </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Gastos por tarjeta / banco</h3>
                <span className="text-xs text-gray-500">Solo tarjetas de credito</span>
              </div>
              {sumValues(byTarjeta).length === 0 ? (
                <div className="text-sm text-gray-500">Sin datos en el mes.</div>
              ) : (
                <ul className="space-y-2">
                  {sumValues(byTarjeta).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{k}</span>
                      <span className="font-semibold">S/ {v.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-800">Gastos de inversion</h3>
                  <span className="text-xs text-gray-500">Inversion, bolsa y pago envios</span>
                </div>
              </div>
              {sumValues(byConceptInvestment).length === 0 ? (
                <div className="text-sm text-gray-500">Sin datos en el mes.</div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {sumValues(byConceptInvestment).map(([k, v]) => (
                    <li key={`inv-${k}`}>
                      <button
                        type="button"
                        onClick={() => setInvestmentConceptDetail(k)}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-gray-50"
                      >
                        <span className="capitalize text-gray-800">{k}</span>
                        <span className="font-semibold text-gray-900">S/ {v.toFixed(2)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 text-xs text-gray-500">
                Movs: {investmentMovs.length} · Total S/ {investmentTotalPen.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white rounded-xl border shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Gasto por dia</h3>
                <span className="text-xs text-gray-500">Tendencia del mes</span>
              </div>
              {dailyTotals.length === 0 ? (
                <div className="text-sm text-gray-500">Sin datos en el mes.</div>
              ) : (
                <ul className="space-y-2 max-h-60 overflow-auto">
                  {dailyTotals.map((d) => (
                    <li key={d.fecha} className="flex items-center justify-between text-sm">
                      <span>{d.fecha}</span>
                      <span className="font-semibold">S/ {d.monto.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          </>
        )}
      </div>
    </div>
    {showBolsaModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <form onSubmit={saveBolsaInvestment} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                {bolsaModalAction === 'edit' ? 'Editar inversión en Bolsa' : 'Registrar inversión en Bolsa'}
              </h3>
              <p className="mt-1 text-sm text-gray-600">Periodo {month}</p>
            </div>
            <button type="button" onClick={() => setShowBolsaModal(false)} className="text-gray-500 hover:text-gray-800">x</button>
          </div>

          <div className="mt-4 rounded-lg border bg-gray-50 p-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-gray-600">2% calculado del mes</span><strong>S/ {bolsaProjection.calculatedMonthly.toFixed(2)}</strong></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-gray-600">Corresponde este mes</span><strong>S/ {bolsaProjection.monthly.toFixed(2)}</strong></div>
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-gray-600">{bolsaProjection.pendingBefore < 0 ? 'Excedente anterior' : 'Faltante anterior'}</span>
              <strong>S/ {Math.abs(bolsaProjection.pendingBefore).toFixed(2)}</strong>
            </div>
            <div className="mt-1 flex justify-between gap-3 text-indigo-700"><span>Total a invertir</span><strong>S/ {bolsaProjection.totalToInvest.toFixed(2)}</strong></div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-gray-600">Ya invertido este mes</span><strong>S/ {bolsaProjection.actualMonth.toFixed(2)}</strong></div>
            <div className={`mt-1 flex justify-between gap-3 ${bolsaProjection.credit > 0 ? 'text-green-700' : 'text-amber-700'}`}>
              <span>{bolsaProjection.credit > 0 ? 'Excedente resultante' : 'Faltante resultante'}</span>
              <strong>S/ {(bolsaProjection.credit > 0 ? bolsaProjection.credit : bolsaProjection.pending).toFixed(2)}</strong>
            </div>
            <div className="mt-1 flex justify-between gap-3"><span className="text-gray-600">Bolsa acumulada registrada</span><strong>S/ {bolsaProjection.investedAccumulated.toFixed(2)}</strong></div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setBolsaPaymentMode('todo');
                setBolsaPaymentAmount(bolsaProjection.totalToInvest.toFixed(2));
                setBolsaError('');
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${bolsaPaymentMode === 'todo' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'bg-white text-gray-700'}`}
            >
              Todo el monto
            </button>
            <button
              type="button"
              onClick={() => {
                setBolsaPaymentMode('variable');
                setBolsaPaymentAmount('');
                setBolsaError('');
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${bolsaPaymentMode === 'variable' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'bg-white text-gray-700'}`}
            >
              Monto variable
            </button>
          </div>

          <label className="mt-4 block text-sm text-gray-700">
            Monto invertido (S/)
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={bolsaPaymentMode === 'todo' ? bolsaProjection.totalToInvest.toFixed(2) : bolsaPaymentAmount}
              onChange={(event) => setBolsaPaymentAmount(event.target.value)}
              disabled={bolsaPaymentMode === 'todo'}
              className="mt-1 w-full rounded-lg border px-3 py-2 disabled:bg-gray-100"
              placeholder="0.00"
            />
          </label>
          <label className="mt-3 block text-sm text-gray-700">
            Fecha de inversión
            <input
              type="date"
              value={bolsaPaymentDate}
              min={`${month}-01`}
              max={monthRange.to}
              onChange={(event) => setBolsaPaymentDate(event.target.value)}
              className="mt-1 w-full rounded-lg border px-3 py-2"
              required
            />
          </label>

          {bolsaError && <div className="mt-3 text-sm text-red-600">{bolsaError}</div>}
          <p className="mt-3 text-xs text-gray-500">Si el 2% es menor, corresponde el mínimo de S/ 1,000. Tú puedes registrar más o menos; la bolsa acumulada sólo cambia después de guardar.</p>

          <div className="mt-5 flex justify-end gap-2">
            {bolsaModalAction === 'edit' && (
              <button type="button" onClick={deleteBolsaInvestment} disabled={bolsaSaving} className="mr-auto rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60">
                Eliminar registro
              </button>
            )}
            <button type="button" onClick={() => setShowBolsaModal(false)} className="rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">Cancelar</button>
            <button type="submit" disabled={bolsaSaving} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-60">
              {bolsaSaving ? 'Guardando...' : bolsaModalAction === 'edit' ? 'Guardar cambios' : 'Guardar inversión'}
            </button>
          </div>
        </form>
      </div>
    )}
    {showPie && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-5xl relative">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPie(false)}
          >
            x
          </button>
          <h3 className="text-xl font-semibold mb-2">Gastos por concepto (%)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Distribucion del total gastado en el mes. Incluye montos y porcentajes por concepto.
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setPieConceptMode('unificado')}
              className={`text-xs px-3 py-1 rounded ${pieConceptMode === 'unificado' ? 'bg-indigo-600 text-white' : 'border bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Unificado
            </button>
            <button
              onClick={() => setPieConceptMode('separado')}
              className={`text-xs px-3 py-1 rounded ${pieConceptMode === 'separado' ? 'bg-indigo-600 text-white' : 'border bg-white text-gray-700 hover:bg-gray-50'}`}
            >
              Separado
            </button>
          </div>

          {pieConceptMode === 'unificado' && (
            <PieBlock title="Debito + Credito" total={totalConceptosUnificadoPen} data={pieDataUnificado} gradient={pieGradientUnificado} />
          )}
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-4 ${pieConceptMode === 'unificado' ? 'hidden' : ''}`}>
            <PieBlock title="Débito" total={totalDebitoPen} data={pieDataDeb} gradient={pieGradientDeb} />
            <PieBlock title="Crédito" total={totalCreditoPen} data={pieDataCre} gradient={pieGradientCre} />
          </div>
        </div>
      </div>
    )}
    {showPieVida && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-3xl relative">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setShowPieVida(false)}
          >
            x
          </button>
          <h3 className="text-xl font-semibold mb-2">Gastos de vida por concepto (%)</h3>
          <p className="text-sm text-gray-600 mb-4">
            Incluye debito y credito (sin inversion, bolsa ni envios)
          </p>
          <PieBlock title="Gastos de vida" total={gastosVidaPen} data={pieDataVida} gradient={pieGradientVida} />
        </div>
      </div>
    )}
    {vidaConceptDetail && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl relative max-h-[86vh] overflow-hidden">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setVidaConceptDetail(null)}
          >
            x
          </button>
          <div className="border-b px-5 py-4">
            <h3 className="text-xl font-semibold capitalize">{vidaConceptDetail}</h3>
            <p className="text-sm text-gray-600">
              {vidaConceptRows.length} movimientos · Total S/ {vidaConceptTotal.toFixed(2)}
            </p>
          </div>
          <div className="max-h-[68vh] overflow-auto p-5">
            {vidaConceptRows.length === 0 ? (
              <div className="text-sm text-gray-500">Sin movimientos.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Metodo</th>
                    <th className="p-2">Detalle</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {vidaConceptRows.map((r) => {
                    const usdEquivalent = getUsdEquivalent(r);
                    return (
                      <tr key={r.id || `${r.fecha}-${r.monto}-${r.notas}`} className="border-t">
                        <td className="p-2 align-top">{r.fecha || '-'}</td>
                        <td className="p-2 align-top capitalize">{r.metodoPago || '-'}</td>
                        <td className="p-2 align-top">{r.notas || r.tarjeta || '-'}</td>
                        <td className="p-2 align-top text-right">
                          <div className="font-semibold">S/ {toPen(r).toFixed(2)}</div>
                          {usdEquivalent != null && (
                            <div className="text-xs font-normal text-gray-500">$ {usdEquivalent.toFixed(2)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
    {investmentConceptDetail && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl relative max-h-[86vh] overflow-hidden">
          <button
            className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
            onClick={() => setInvestmentConceptDetail(null)}
          >
            x
          </button>
          <div className="border-b px-5 py-4">
            <h3 className="text-xl font-semibold capitalize">{investmentConceptDetail}</h3>
            <p className="text-sm text-gray-600">
              {investmentConceptRows.length} movimientos · Total S/ {investmentConceptTotal.toFixed(2)}
            </p>
          </div>
          <div className="max-h-[68vh] overflow-auto p-5">
            {investmentConceptRows.length === 0 ? (
              <div className="text-sm text-gray-500">Sin movimientos.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Metodo</th>
                    <th className="p-2">Detalle</th>
                    <th className="p-2 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {investmentConceptRows.map((r) => {
                    const usdEquivalent = getUsdEquivalent(r);
                    return (
                      <tr key={r.id || `${r.fecha}-${r.monto}-${r.notas}`} className="border-t">
                        <td className="p-2 align-top">{r.fecha || '-'}</td>
                        <td className="p-2 align-top capitalize">{r.metodoPago || '-'}</td>
                        <td className="p-2 align-top">{r.notas || r.tarjeta || '-'}</td>
                        <td className="p-2 align-top text-right">
                          <div className="font-semibold">S/ {toPen(r).toFixed(2)}</div>
                          {usdEquivalent != null && (
                            <div className="text-xs font-normal text-gray-500">$ {usdEquivalent.toFixed(2)}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );
}

function PieBlock({ title, total, data, gradient }) {
  return (
    <div className="bg-gray-50 border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-800">{title}</span>
        <span className="text-sm text-gray-600">S/ {Number(total || 0).toFixed(2)}</span>
      </div>
      {(!data || data.length === 0) ? (
        <div className="text-sm text-gray-500">No hay datos.</div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div
            className="mx-auto"
            style={{
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: gradient,
              border: '6px solid #e5e7eb',
            }}
          />
          <div className="flex-1 space-y-1 max-h-44 overflow-auto text-sm">
            {data.map((d) => (
              <div key={`${title}-${d.label}`} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm" style={{ background: d.color }} />
                  <span className="capitalize text-gray-800">{d.label}</span>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="font-semibold text-gray-900">{d.pct.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600">S/ {Number(d.monto || 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
