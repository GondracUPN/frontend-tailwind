import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import './chartSetup';
import ChartShell from './ChartShell';
import useProfitData from './useProfitData';
import { formatCurrency, formatPercent } from './format';
import { mockRows } from './profitMocks';
import { getProfitSeries } from '../../services/analytics';

const GROUPS = [
  { id: 'day', label: 'Dia' },
  { id: 'month', label: 'Mes' },
  { id: 'year', label: 'Año' },
];

const MONTHS = Array.from({ length: 12 }, (_, idx) => {
  const value = String(idx + 1).padStart(2, '0');
  return { value, label: value };
});

export default function ProfitTimeSeries({ from, to, filters }) {
  const [groupBy, setGroupBy] = useState('month');
  const [showMock, setShowMock] = useState(false);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const resolveYearMonth = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const [y, m] = dateStr.split('-');
    if (!y || !m) return null;
    return { year: y, month: m };
  };

  useEffect(() => {
    const now = new Date();
    const fallbackYear = String(now.getFullYear());
    const fallbackMonth = String(now.getMonth() + 1).padStart(2, '0');
    const source = resolveYearMonth(from) || resolveYearMonth(to);
    setSelectedYear(source?.year || fallbackYear);
    setSelectedMonth(source?.month || fallbackMonth);
  }, [from, to]);

  useEffect(() => {
    let mounted = true;
    const loadYears = async () => {
      try {
        const res = await getProfitSeries({ ...filters, groupBy: 'year' });
        const rows = Array.isArray(res?.rows) ? res.rows : [];
        const years = rows
          .map((r) => String(r.period || '').trim())
          .filter(Boolean)
          .sort();
        if (mounted) setAvailableYears(years);
      } catch {
        if (mounted) setAvailableYears([]);
      }
    };
    loadYears();
    return () => { mounted = false; };
  }, [filters]);

  const years = useMemo(() => {
    const set = new Set(availableYears);
    if (selectedYear) set.add(selectedYear);
    return Array.from(set).sort();
  }, [availableYears, selectedYear]);

  const monthRange = (year, month) => {
    if (!year || !month) return { from: undefined, to: undefined };
    const y = Number(year);
    const m = Number(month);
    if (!y || !m) return { from: undefined, to: undefined };
    const lastDay = new Date(y, m, 0).getDate();
    return {
      from: `${year}-${String(month).padStart(2, '0')}-01`,
      to: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  };

  const yearRange = (year) => {
    if (!year) return { from: undefined, to: undefined };
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  };

  const range = useMemo(() => {
    if (groupBy === 'day') return monthRange(selectedYear, selectedMonth);
    if (groupBy === 'month') return yearRange(selectedYear);
    return { from: undefined, to: undefined };
  }, [groupBy, selectedYear, selectedMonth]);

  const { data, loading, error, retry } = useProfitData({
    ...filters,
    from: range.from,
    to: range.to,
    groupBy,
  });
  const rows = data?.rows || [];

  const displayRows = rows.length ? rows : (showMock ? mockRows(groupBy) : []);
  const labels = displayRows.map((r) => r.period);
  const profits = displayRows.map((r) => r.profit);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Ganancia',
          data: profits,
          borderColor: '#2563eb',
          backgroundColor: 'rgba(37, 99, 235, 0.15)',
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    }),
    [labels, profits],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => {
              const row = displayRows[ctx.dataIndex];
              if (!row) return '';
              return [
                `Ingresos: ${formatCurrency(row.income)}`,
                `Costos: ${formatCurrency(row.cost)}`,
                `Ganancia: ${formatCurrency(row.profit)}`,
                `Margen: ${formatPercent(row.margin)}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (v) => formatCurrency(v),
          },
        },
      },
    }),
    [displayRows],
  );

  return (
    <ChartShell
      title="Ganancia en el tiempo"
      loading={loading}
      error={error}
      empty={!loading && !error && displayRows.length === 0}
      onRetry={retry}
      onShowMock={() => setShowMock(true)}
      showMock={showMock}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2 text-sm">
        {GROUPS.map((g) => (
          <button
            key={g.id}
            className={`px-2 py-1 rounded border ${groupBy === g.id ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}
            onClick={() => { setShowMock(false); setGroupBy(g.id); }}
          >
            {g.label}
          </button>
        ))}
        {groupBy !== 'year' ? (
          <select
            className="border rounded px-2 py-1 text-sm bg-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        ) : null}
        {groupBy === 'day' ? (
          <select
            className="border rounded px-2 py-1 text-sm bg-white"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        ) : null}
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
