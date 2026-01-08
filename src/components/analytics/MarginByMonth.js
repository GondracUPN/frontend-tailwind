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
  const rows = data?.rows || [];

  const displayRows = rows.length ? rows : (showMock ? mockRows(groupBy) : []);
  const labels = displayRows.map((r) => r.period);
  const margins = displayRows.map((r) => r.margin);

  const chartData = useMemo(
    () => ({
      labels,
      datasets: [
        {
          label: 'Margen',
          data: margins,
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          tension: 0.3,
          pointRadius: 3,
        },
      ],
    }),
    [labels, margins],
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
      title="Margen de ganancia por mes"
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
