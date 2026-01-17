import React, { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import './chartSetup';
import ChartShell from './ChartShell';
import useProfitData from './useProfitData';
import { formatCurrency, formatPercent } from './format';
import { mockRows } from './profitMocks';

const inferGroupBy = (from, to) => {
  if (!from || !to) return 'month';
  if (from.slice(0, 7) === to.slice(0, 7)) return 'day';
  if (from.slice(0, 4) === to.slice(0, 4)) return 'month';
  return 'year';
};

export default function IncomeCostProfitChart({ from, to, filters }) {
  const [showMock, setShowMock] = useState(false);
  const groupBy = inferGroupBy(from, to);
  const { data, loading, error, retry } = useProfitData({ ...filters, from, to, groupBy });
  const rows = data?.rows || [];

  const displayRows = rows.length ? rows : (showMock ? mockRows(groupBy) : []);
  const labels = displayRows.map((r) => r.period);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Ingresos',
          data: displayRows.map((r) => r.income),
          backgroundColor: 'rgba(16, 185, 129, 0.6)',
        },
        {
          label: 'Costos',
          data: displayRows.map((r) => r.cost),
          backgroundColor: 'rgba(239, 68, 68, 0.6)',
        },
        {
          label: 'Ganancia',
          data: displayRows.map((r) => r.profit),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
        },
      ],
    }),
    [labels, displayRows],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => {
              const row = displayRows[ctx.dataIndex];
              if (!row) return '';
              const markup = row.cost > 0 ? (row.profit / row.cost) * 100 : 0;
              return [
                `Ingresos: ${formatCurrency(row.income)}`,
                `Costos: ${formatCurrency(row.cost)}`,
                `Ganancia: ${formatCurrency(row.profit)}`,
                `Markup: ${formatPercent(markup)}`,
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
      title="Ingresos vs Costos vs Ganancia"
      loading={loading}
      error={error}
      empty={!loading && !error && displayRows.length === 0}
      onRetry={retry}
      onShowMock={() => setShowMock(true)}
      showMock={showMock}
    >
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
