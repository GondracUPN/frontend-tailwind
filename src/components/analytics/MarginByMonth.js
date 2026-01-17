import React, { useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import './chartSetup';
import ChartShell from './ChartShell';
import useProfitData from './useProfitData';
import { formatCurrency, formatPercent } from './format';
import { mockRows } from './profitMocks';

export default function MarginByMonth({ from, to, filters }) {
  const [showMock, setShowMock] = useState(false);
  const groupBy = 'month';
  const { data, loading, error, retry } = useProfitData({ ...filters, from, to, groupBy });

  const displayRows = useMemo(() => {
    const rows = data?.rows || [];
    return rows.length ? rows : (showMock ? mockRows(groupBy) : []);
  }, [data, showMock, groupBy]);
  const labels = useMemo(() => displayRows.map((r) => r.period), [displayRows]);
  const utilidad = useMemo(
    () => displayRows.map((r) => (r.income > 0 ? (r.profit / r.income) * 100 : 0)),
    [displayRows],
  );
  const markup = useMemo(
    () => displayRows.map((r) => (r.cost > 0 ? (r.profit / r.cost) * 100 : 0)),
    [displayRows],
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Utilidad',
          data: utilidad,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          tension: 0.3,
          pointRadius: 3,
        },
        {
          label: 'Markup',
          data: markup,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.2)',
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    }),
    [labels, utilidad, markup],
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
              const util = row.income > 0 ? (row.profit / row.income) * 100 : 0;
              const mark = row.cost > 0 ? (row.profit / row.cost) * 100 : 0;
              return [
                `Ingresos: ${formatCurrency(row.income)}`,
                `Costos: ${formatCurrency(row.cost)}`,
                `Ganancia: ${formatCurrency(row.profit)}`,
                `Utilidad: ${formatPercent(util)}`,
                `Markup: ${formatPercent(mark)}`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (v) => formatPercent(v),
          },
          suggestedMin: 0,
        },
      },
    }),
    [displayRows],
  );

  return (
    <ChartShell
      title="Margenes de ganancia por mes"
      loading={loading}
      error={error}
      empty={!loading && !error && displayRows.length === 0}
      onRetry={retry}
      onShowMock={() => setShowMock(true)}
      showMock={showMock}
    >
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </ChartShell>
  );
}
