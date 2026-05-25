import React, { useMemo, useState } from 'react';

const TIPO_CAMBIO = 3.7;

const CARD_LABEL = {
  interbank: 'Interbank',
  bcp: 'BCP Visa',
  bcp_amex: 'BCP Amex',
  bcp_visa: 'BCP Visa',
  visa_qore: 'Visa Qore',
  bbva: 'BBVA',
  io: 'IO',
  saga: 'Saga',
};

const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const FIXED_CYCLES = {
  bcp_amex: [
    [11, 21, 12, 22, 1, 18],
    [12, 22, 1, 22, 2, 18],
    [1, 23, 2, 20, 3, 18],
    [2, 21, 3, 20, 4, 20],
    [3, 21, 4, 22, 5, 18],
    [4, 23, 5, 22, 6, 18],
    [5, 23, 6, 22, 7, 20],
    [6, 23, 7, 22, 8, 18],
    [7, 23, 8, 21, 9, 21],
    [8, 22, 9, 22, 10, 19],
    [9, 23, 10, 22, 11, 18],
    [10, 23, 11, 20, 12, 21],
  ],
  bcp_visa: [
    [11, 26, 12, 24, 1, 20],
    [12, 25, 1, 23, 2, 23],
    [1, 24, 2, 25, 3, 23],
    [2, 26, 3, 25, 4, 21],
    [3, 26, 4, 24, 5, 20],
    [4, 25, 5, 25, 6, 22],
    [5, 26, 6, 25, 7, 21],
    [6, 26, 7, 24, 8, 20],
    [7, 25, 8, 25, 9, 22],
    [8, 26, 9, 25, 10, 20],
    [9, 26, 10, 23, 11, 23],
    [10, 24, 11, 25, 12, 22],
  ],
  interbank: [
    [11, 27, 12, 23, 1, 20],
    [12, 27, 1, 26, 2, 20],
    [1, 27, 2, 26, 3, 20],
    [2, 27, 3, 26, 4, 20],
    [3, 27, 4, 24, 5, 20],
    [4, 25, 5, 26, 6, 22],
    [5, 27, 6, 26, 7, 20],
    [6, 27, 7, 24, 8, 20],
    [7, 25, 8, 26, 9, 21],
    [8, 27, 9, 25, 10, 20],
    [9, 26, 10, 26, 11, 20],
    [10, 27, 11, 26, 12, 21],
  ],
};

const cardCycleKey = (card) => {
  const key = String(card || '').trim().toLowerCase();
  if (key === 'visa_qore') return 'bcp_visa';
  if (key === 'bcp') return 'bcp_visa';
  return key;
};
const normalizeCard = (card) => String(card || '').trim().toLowerCase();

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const makeDate = (year, month, day) => new Date(year, month - 1, day);
const addMonths = (year, month, delta) => {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
const isWeekend = (d) => d.getDay() === 0 || d.getDay() === 6;
const nextBusinessDay = (d) => {
  const out = new Date(d);
  while (isWeekend(out)) out.setDate(out.getDate() + 1);
  return out;
};
const parseYmd = (value) => {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return makeDate(Number(m[1]), Number(m[2]), Number(m[3]));
};
const inRange = (date, start, end) => {
  if (!date) return false;
  const t = date.getTime();
  return t >= start.getTime() && t <= end.getTime();
};
const fmtDate = (d) =>
  d.toLocaleDateString('es-PE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
const fmtPen = (value) => `S/ ${Number(value || 0).toFixed(2)}`;
const fmtUsd = (value) => `$ ${Number(value || 0).toFixed(2)}`;

const fixedCycle = (key, year, month) => {
  const row = FIXED_CYCLES[key]?.[month - 1];
  if (!row) return null;
  const [sm, sd, em, ed, dm, dd] = row;
  const startYear = sm > month ? year - 1 : year;
  const endYear = em > month ? year - 1 : year;
  const dueYear = dm < month ? year + 1 : year;
  return {
    start: makeDate(startYear, sm, sd),
    end: makeDate(endYear, em, ed),
    due: makeDate(dueYear, dm, dd),
  };
};

const dynamicCycle = (key, year, month) => {
  if (key === 'io') {
    const start = addMonths(year, month, -2);
    const end = addMonths(year, month, -1);
    return {
      start: makeDate(start.year, start.month, 26),
      end: makeDate(end.year, end.month, 25),
      due: makeDate(year, month, 12),
    };
  }

  if (key === 'bbva') {
    const start = addMonths(year, month, -2);
    const end = addMonths(year, month, -1);
    return {
      start: makeDate(start.year, start.month, 21),
      end: makeDate(end.year, end.month, 20),
      due: nextBusinessDay(makeDate(year, month, 16)),
    };
  }

  return null;
};

const getCycle = (card, year, month) => {
  const key = cardCycleKey(card);
  return fixedCycle(key, year, month) || dynamicCycle(key, year, month);
};

const summarizeRows = (rows, card, cycle) => {
  const items = rows.filter((g) => {
    const rowCard = normalizeCard(g.tarjeta);
    return rowCard === normalizeCard(card) && inRange(parseYmd(g.fecha), cycle.start, cycle.end);
  });

  const totals = items.reduce(
    (acc, g) => {
      const amount = Number(g.monto || 0) || 0;
      if (g.moneda === 'USD') acc.usd += amount;
      else acc.pen += amount;
      return acc;
    },
    { pen: 0, usd: 0 },
  );
  totals.totalPen = totals.pen + totals.usd * TIPO_CAMBIO;
  return { items, totals };
};

const getPaymentAllocation = (g) => {
  const amount = Number(g?.monto || 0) || 0;
  const usdApplied = Number(g?.montoUsdAplicado);
  const hasUsdApplied = g?.montoUsdAplicado != null && Number.isFinite(usdApplied) && usdApplied > 0;
  const tc = (() => {
    const rate = Number(g?.tasaUsdPen);
    if (Number.isFinite(rate) && rate > 0) return rate;
    if (hasUsdApplied && amount > 0) {
      const derived = amount / usdApplied;
      if (Number.isFinite(derived) && derived > 0) return derived;
    }
    return TIPO_CAMBIO;
  })();
  const explicitUsd = g?.pagoObjetivo === 'USD';
  const explicitPen = g?.pagoObjetivo === 'PEN';
  const targetUsd = explicitUsd || hasUsdApplied || g?.moneda === 'USD' || !explicitPen;

  if (targetUsd) {
    const amountUsd = g?.moneda === 'USD'
      ? amount
      : (hasUsdApplied ? usdApplied : amount / tc);
    return { currency: 'USD', amount: Number.isFinite(amountUsd) ? amountUsd : 0 };
  }

  const amountPen = g?.moneda === 'USD' ? amount * tc : amount;
  return { currency: 'PEN', amount: Number.isFinite(amountPen) ? amountPen : 0 };
};

const isCardPayment = (g) =>
  g?.metodoPago === 'debito' && String(g?.concepto || '').trim().toLowerCase() === 'pago_tarjeta';

const monthIndex = (year, month) => year * 12 + month;
const monthsBetween = (from, to) => {
  const out = [];
  const start = monthIndex(from.year, from.month);
  const end = monthIndex(to.year, to.month);
  for (let i = start; i <= end; i += 1) {
    const year = Math.floor((i - 1) / 12);
    const month = ((i - 1) % 12) + 1;
    out.push({ year, month });
  }
  return out;
};

const buildAllocatedCycles = ({ rows, creditRows, cardKeys, selectedYear, selectedMonth }) => {
  const dates = rows.map((g) => parseYmd(g.fecha)).filter(Boolean);
  const minDate = dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : makeDate(selectedYear, selectedMonth, 1);
  const startMonth = addMonths(minDate.getFullYear(), minDate.getMonth() + 1, -2);
  const endMonth = addMonths(selectedYear, selectedMonth, 4);
  const months = monthsBetween(startMonth, endMonth);

  const allByKey = new Map();
  cardKeys.forEach((card) => {
    const cycles = months
      .map(({ year, month }) => {
        const cycle = getCycle(card, year, month);
        if (!cycle) return null;
        const summary = summarizeRows(creditRows, card, cycle);
        return {
          card,
          year,
          month,
          ym: `${year}-${pad(month)}`,
          cycle,
          ...summary,
          usedPen: summary.totals.totalPen,
          paidPenAmount: 0,
          paidUsdAmount: 0,
          paidPen: 0,
          pendingPenAmount: summary.totals.pen,
          pendingUsdAmount: summary.totals.usd,
          pendingPen: summary.totals.totalPen,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.cycle.due.getTime() - b.cycle.due.getTime());

    const payments = rows
      .filter((g) => isCardPayment(g) && normalizeCard(g.tarjetaPago) === normalizeCard(card))
      .map((g) => ({ date: parseYmd(g.fecha) || makeDate(1900, 1, 1), ...getPaymentAllocation(g) }))
      .filter((p) => p.amount > 0)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    payments.forEach((payment) => {
      let remaining = payment.amount;
      for (const cycle of cycles) {
        if (remaining <= 0) break;
        const pendingKey = payment.currency === 'USD' ? 'pendingUsdAmount' : 'pendingPenAmount';
        const paidKey = payment.currency === 'USD' ? 'paidUsdAmount' : 'paidPenAmount';
        if (cycle[pendingKey] <= 0) continue;
        const applied = Math.min(cycle[pendingKey], remaining);
        cycle[paidKey] += applied;
        cycle[pendingKey] -= applied;
        remaining -= applied;
      }
    });

    cycles.forEach((cycle) => {
      const paidPen = cycle.paidPenAmount + cycle.paidUsdAmount * TIPO_CAMBIO;
      const pendingPen = cycle.pendingPenAmount + cycle.pendingUsdAmount * TIPO_CAMBIO;
      allByKey.set(`${card}:${cycle.ym}`, {
        ...cycle,
        paidPenAmount: +cycle.paidPenAmount.toFixed(2),
        paidUsdAmount: +cycle.paidUsdAmount.toFixed(2),
        paidPen: +paidPen.toFixed(2),
        pendingPenAmount: +Math.max(0, cycle.pendingPenAmount).toFixed(2),
        pendingUsdAmount: +Math.max(0, cycle.pendingUsdAmount).toFixed(2),
        pendingPen: +Math.max(0, pendingPen).toFixed(2),
      });
    });
  });

  return allByKey;
};

const monthLabel = (value) => {
  const [year, month] = String(value || '').split('-').map(Number);
  return year && month ? `${MONTHS[month - 1]} ${year}` : '';
};

export default function ModalCiclosTarjeta({ rows = [], cards = [], onClose }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);

  const creditRows = useMemo(
    () => rows.filter((g) => g.metodoPago === 'credito'),
    [rows],
  );

  const cardKeys = useMemo(() => {
    const set = new Set();
    cards.forEach((c) => {
      const card = c?.tipo || c?.type;
      if (card) set.add(card);
    });
    creditRows.forEach((g) => g.tarjeta && set.add(g.tarjeta));
    return Array.from(set.values()).filter(Boolean).sort();
  }, [cards, creditRows]);

  const allocatedCycles = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return new Map();
    return buildAllocatedCycles({
      rows,
      creditRows,
      cardKeys,
      selectedYear: year,
      selectedMonth: m,
    });
  }, [rows, creditRows, cardKeys, month]);

  const selectedRows = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return [];
    return cardKeys.map((card) => {
      const row = allocatedCycles.get(`${card}:${year}-${pad(m)}`);
      if (row) return row;
      const cycle = getCycle(card, year, m);
      if (!cycle) {
        return {
          card,
          cycle: null,
          items: [],
          totals: { pen: 0, usd: 0, totalPen: 0 },
          usedPen: 0,
          paidPenAmount: 0,
          paidUsdAmount: 0,
          paidPen: 0,
          pendingPenAmount: 0,
          pendingUsdAmount: 0,
          pendingPen: 0,
        };
      }
      return {
        card,
        cycle,
        items: [],
        totals: { pen: 0, usd: 0, totalPen: 0 },
        usedPen: 0,
        paidPenAmount: 0,
        paidUsdAmount: 0,
        paidPen: 0,
        pendingPenAmount: 0,
        pendingUsdAmount: 0,
        pendingPen: 0,
      };
    });
  }, [cardKeys, allocatedCycles, month]);

  const selectedTotal = selectedRows.reduce(
    (acc, row) => {
      acc.pen += row.totals.pen;
      acc.usd += row.totals.usd;
      acc.usedPen += row.usedPen || row.totals.totalPen || 0;
      acc.paidPenAmount += row.paidPenAmount || 0;
      acc.paidUsdAmount += row.paidUsdAmount || 0;
      acc.paidPen += row.paidPen || 0;
      acc.pendingPenAmount += row.pendingPenAmount || 0;
      acc.pendingUsdAmount += row.pendingUsdAmount || 0;
      acc.pendingPen += row.pendingPen || 0;
      return acc;
    },
    {
      pen: 0,
      usd: 0,
      usedPen: 0,
      paidPenAmount: 0,
      paidUsdAmount: 0,
      paidPen: 0,
      pendingPenAmount: 0,
      pendingUsdAmount: 0,
      pendingPen: 0,
    },
  );

  const nextMonths = useMemo(() => {
    const [year, m] = month.split('-').map(Number);
    if (!year || !m) return [];
    return [0, 1, 2, 3].map((delta) => {
      const target = addMonths(year, m, delta);
      const ym = `${target.year}-${pad(target.month)}`;
      const total = cardKeys.reduce((sum, card) => {
        const row = allocatedCycles.get(`${card}:${ym}`);
        return sum + Number(row?.pendingPen || 0);
      }, 0);
      return { ym, total };
    });
  }, [cardKeys, allocatedCycles, month]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div>
            <h3 className="text-xl font-semibold">Pagos por ciclo de facturacion</h3>
            <p className="text-sm text-gray-600">Calcula lo usado segun el periodo de compras y la fecha limite de pago.</p>
          </div>
          <button className="text-gray-500 hover:text-gray-800" onClick={onClose}>x</button>
        </div>

        <div className="max-h-[78vh] overflow-auto p-5 space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <label className="text-sm text-gray-700">
              Mes de pago
              <input
                type="month"
                className="mt-1 block rounded-lg border px-3 py-2 text-sm"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <div className="text-gray-500">Por pagar</div>
                <div className="font-semibold">{fmtPen(selectedTotal.pendingPen)}</div>
                <div className="text-xs text-gray-500">
                  {fmtUsd(selectedTotal.pendingUsdAmount)} | {fmtPen(selectedTotal.pendingPenAmount)}
                </div>
              </div>
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <div className="text-gray-500">Usado</div>
                <div className="font-semibold">{fmtPen(selectedTotal.usedPen)}</div>
                <div className="text-xs text-gray-500">
                  {fmtUsd(selectedTotal.usd)} | {fmtPen(selectedTotal.pen)}
                </div>
              </div>
              <div className="rounded-lg border bg-gray-50 px-3 py-2">
                <div className="text-gray-500">Pagado</div>
                <div className="font-semibold">{fmtPen(selectedTotal.paidPen)}</div>
                <div className="text-xs text-gray-500">
                  {fmtUsd(selectedTotal.paidUsdAmount)} | {fmtPen(selectedTotal.paidPenAmount)}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border">
            <div className="border-b bg-gray-50 px-4 py-3">
              <div className="font-semibold">Mes de pago: {monthLabel(month)}</div>
              <div className="text-xs text-gray-500">TC referencial {TIPO_CAMBIO}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-[980px] w-full text-sm">
                <thead className="bg-white text-left text-gray-600">
                  <tr>
                    <th className="p-2">Tarjeta</th>
                    <th className="p-2">Periodo de compras</th>
                    <th className="p-2">Fecha de pago</th>
                    <th className="p-2 text-right">Usado</th>
                    <th className="p-2 text-right">Pagado</th>
                    <th className="p-2 text-right">Por pagar</th>
                    <th className="p-2 text-right">Movs.</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRows.map((row) => (
                    <tr key={row.card} className="border-t">
                      <td className="p-2 font-semibold">{CARD_LABEL[row.card] || row.card}</td>
                      <td className="p-2">
                        {row.cycle ? `${ymd(row.cycle.start)} al ${ymd(row.cycle.end)}` : 'Sin ciclo configurado'}
                      </td>
                      <td className="p-2">{row.cycle ? fmtDate(row.cycle.due) : '-'}</td>
                      <td className="p-2 text-right">
                        <div className="font-semibold">{fmtPen(row.usedPen)}</div>
                        <div className="text-xs text-gray-500">
                          {fmtUsd(row.totals.usd)} | {fmtPen(row.totals.pen)}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="font-semibold text-emerald-700">{fmtPen(row.paidPen)}</div>
                        <div className="text-xs text-gray-500">
                          {fmtUsd(row.paidUsdAmount)} | {fmtPen(row.paidPenAmount)}
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        <div className="font-semibold">{fmtPen(row.pendingPen)}</div>
                        <div className="text-xs text-gray-500">
                          {fmtUsd(row.pendingUsdAmount)} | {fmtPen(row.pendingPenAmount)}
                        </div>
                      </td>
                      <td className="p-2 text-right">{row.items.length}</td>
                    </tr>
                  ))}
                  {selectedRows.length === 0 && (
                    <tr>
                      <td className="p-3 text-gray-500" colSpan={7}>No hay tarjetas ni consumos de credito.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold text-gray-800">Proximos meses</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {nextMonths.map((row) => (
                <div key={row.ym} className="rounded-xl border bg-gray-50 p-3">
                  <div className="text-sm text-gray-600">{monthLabel(row.ym)}</div>
                  <div className="mt-1 text-lg font-semibold">{fmtPen(row.total)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
