import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FinancialDashboard from './FinancialDashboard';
import { getFinancialDashboard } from '../../services/analytics';

jest.mock('../../services/analytics', () => ({ getFinancialDashboard: jest.fn(), invalidateAnalyticsCache: jest.fn() }));
jest.mock('react-chartjs-2', () => ({ Line: () => <div data-testid="financial-chart" /> }));

test('muestra ganancia bruta y deja sin dato el resultado operativo incompleto', async () => {
  getFinancialDashboard.mockResolvedValue({
    definitions: { capital: 'Costo de compras', inventory: 'Stock', income: 'Ventas' },
    summary: { capitalInvested: 100, inventoryCapital: 40, recoveredCapital: 60, income: 90, cost: 60, grossProfit: 30, margin: 33.33, markup: 50, medianDays: 10, operatingExpenses: null, operatingResult: null, expenseStatus: 'Sin clasificación' },
    comparison: null, evolution: [{ period: '2026-02', income: 90, cost: 60, grossProfit: 30, purchases: 0 }],
    categories: [], models: [], states: [], sales: [], purchases: [], inventory: { records: [], aging: [], byStatus: [] }, insights: [], projection: null,
  });
  render(<FinancialDashboard view="ganancias" from="2026-02-01" to="2026-02-28" filters={{ vendedor: 'Gonzalo' }} />);
  await waitFor(() => expect(getFinancialDashboard).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-02-01', vendedor: 'Gonzalo' })));
  expect(await screen.findByText('(=) Ganancia bruta')).toBeInTheDocument();
  expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Sin clasificación').length).toBeGreaterThan(0);
});

test('muestra el capital acumulado y abre compras anteriores al período', async () => {
  getFinancialDashboard.mockResolvedValue({
    definitions: { capital: 'Costo acumulado', inventory: 'Stock', income: 'Ventas' },
    summary: { capitalInvested: 100, purchaseCapitalInPeriod: 0, inventoryCapital: 100, recoveredCapital: 0, income: 0, cost: 0, grossProfit: 0 },
    comparison: null, evolution: [], categories: [], models: [], states: [], sales: [],
    purchases: [{ id: 1, name: 'MacBook Air', purchaseDate: '2026-01-10', units: 1, capital: 100 }],
    inventory: { records: [], aging: [], byStatus: [] }, insights: [], projection: null,
  });

  render(<FinancialDashboard view="resumen" from="2026-02-01" to="2026-02-28" />);
  const capital = await screen.findByRole('button', { name: /Capital invertido/i });
  expect(capital).toHaveTextContent('S/ 100.00');
  expect(capital).toHaveTextContent('Compras del período: S/ 0.00');
  fireEvent.click(capital);
  expect(screen.getByRole('dialog', { name: 'Todos los productos comprados' })).toHaveTextContent('MacBook Air');
});
