import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VentasPedido from './VentasPedido';
import { finanzasApi } from '../services/finanzas';
import { getPedidoSalesSummary } from '../services/analytics';

jest.mock('../services/finanzas', () => ({
  finanzasApi: { clientes: jest.fn(), saldosCliente: jest.fn() },
  sesionFinanciera: () => ({ esAdmin: true }), limpiarError: e => e.message,
}));
jest.mock('../services/analytics', () => ({ getPedidoSalesSummary: jest.fn(), invalidateAnalyticsCache: jest.fn() }));

test('muestra ventas y deuda por cliente sin sumar pagos antiguos por confirmar', async () => {
  getPedidoSalesSummary.mockResolvedValue({ rows: [
    { ventaId: 10, cliente: 'Jorge', codigoProducto: 'MS-477', producto: 'iPhone 14 Pro' },
    { ventaId: 11, cliente: 'Kenny', codigoProducto: 'MS-518', producto: 'iPad Air' },
  ] });
  finanzasApi.clientes.mockResolvedValue([
    { id: 1, nombre: 'Jorge', clase: 'externo', admite_saldo: true },
    { id: 2, nombre: 'Kenny', clase: 'externo', admite_saldo: true },
  ]);
  finanzasApi.saldosCliente.mockImplementation(async id => ({ disponible: '0.00', ventas: id === 1 ? [
    { ventaId: 10, sku: 477, fecha: '2026-10-27', precioVenta: '1300.00', pagado: '1000.00', deudaConfirmada: '300.00' },
    { ventaId: 9, sku: 454, fecha: '2026-09-10', precioVenta: '30000.00', pagado: '0.00', deuda: '30000.00', pendienteConciliacion: true },
  ] : [{ ventaId: 11, sku: 518, fecha: '2026-11-09', precioVenta: '800.00', pagado: '800.00', deudaConfirmada: '0.00' }] }));
  render(<VentasPedido />);
  expect(await screen.findByRole('table', { name: 'Ventas de Jorge' })).toBeVisible();
  expect(screen.getByText('Por cobrar: S/ 300.00')).toBeVisible();
  expect(screen.getByText('MS-477')).toBeVisible();
  expect(screen.getByText('Pago por confirmar')).toBeVisible();
  expect(screen.queryByText('MS-518')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Kenny' }));
  expect(screen.getByRole('table', { name: 'Ventas de Kenny' })).toBeVisible();
  expect(screen.getByText('MS-518')).toBeVisible();
  expect(screen.queryByText('MS-477')).not.toBeInTheDocument();
});
