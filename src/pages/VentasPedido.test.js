import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import VentasPedido from './VentasPedido';
import { finanzasApi } from '../services/finanzas';
import { getPedidoSalesSummary } from '../services/analytics';
jest.mock('../services/finanzas', () => ({ finanzasApi: { clientes: jest.fn(), saldosCliente: jest.fn() }, sesionFinanciera: () => ({ esAdmin: true }), limpiarError: e => e.message }));
jest.mock('../services/analytics', () => ({ getPedidoSalesSummary: jest.fn(), invalidateAnalyticsCache: jest.fn() }));
test('conserva el contenido de Análisis: resumen, clientes, pendientes y entregados', async () => {
  finanzasApi.clientes.mockResolvedValue([]);
  getPedidoSalesSummary.mockResolvedValue({ rows: [
    { id: 'camino-1', productoId: 507, codigoProducto: 'MS-507', cliente: 'Jorge', producto: 'iPad Pro', fecha: '2026-10-28', estadoPago: 'sin_pago', estadoPedido: 'en_camino_sin_pago' },
    { id: 'venta-2', productoId: 477, codigoProducto: 'MS-477', cliente: 'Jorge', producto: 'iPhone 14 Pro', fecha: '2026-10-27', estadoPago: 'pagado', montoVenta: 1220, montoAdelanto: 1220, saldo: 0, ganancia: 220, costo: 1000 },
    { id: 'camino-3', productoId: 454, codigoProducto: 'MS-454', cliente: 'Jorge', producto: 'iPad Air', estadoPago: 'sin_pago', tieneReembolso: true },
  ] });
  render(<VentasPedido />);
  expect(await screen.findByText('iPhone 14 Pro')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Clientes' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Productos en camino y faltos de pago' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Productos cancelados y entregados' })).toBeVisible();
  expect(screen.getAllByText('Markup').length).toBeGreaterThan(0);
  expect(screen.getByText('MS-507')).toBeVisible();
  expect(screen.queryByText('MS-454')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-28' } });
  expect(screen.queryByText('iPhone 14 Pro')).not.toBeInTheDocument();
});
