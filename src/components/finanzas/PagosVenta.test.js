import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PagosVenta from './PagosVenta';
import { finanzasApi } from '../../services/finanzas';

jest.mock('../../services/finanzas', () => ({
  finanzasApi: {
    detalleVenta: jest.fn(),
    cuentas: jest.fn(),
    resolverClientePedido: jest.fn(),
    saldosCliente: jest.fn(),
  },
  esErrorDePermiso: () => false,
  sesionFinanciera: () => ({ esAdmin: true }),
  limpiarError: (e) => e.message,
  nuevaClave: () => 'clave-test',
}));

const detalle = (finanzas) => ({
  venta: { id: 414, vendedor: 'Gonzalo', fechaComercial: '2026-11-05', precio: 3500, estadoComercial: 'entregada', conciliacionHistorica: 'no_aplica' },
  finanzas: { precio: 3500, cobradoCliente: 3500, saldoPendiente: 0, pendienteLiquidacion: 0, estadoCobro: 'pagado', estadoLiquidacion: 'directo',
    gananciaComercial: 731.12, gananciaFinal: 731.12, margenLiberado: 731.12, margenPendiente: 0, porcentajeLiberado: 1,
    comisiones: 0, costosVinculados: 0, devoluciones: 0, contracargosNetos: 0, ...finanzas },
  pagos: [{ id: 28, montoPen: 3500, origen: 'ingreso_venta', estado: 'disponible', saldoConvertido: 0, liquidaciones: [] }],
  costosVinculados: [],
  timeline: [{ pagoId: 28, tipo: 'pago', fecha: '2026-11-05', monto: 3500, estado: 'disponible', cuenta: 'BCP', metodo: 'transferencia' }],
});

beforeEach(() => {
  jest.clearAllMocks();
  finanzasApi.cuentas.mockResolvedValue([]);
  finanzasApi.resolverClientePedido.mockResolvedValue(null);
});

test('sin comisiones y cobrado al 100% muestra una sola ganancia y nombra la devolución del pago', async () => {
  finanzasApi.detalleVenta.mockResolvedValue(detalle({}));
  render(<PagosVenta ventaId={414} />);
  expect(await screen.findByText('Ganancia')).toBeInTheDocument();
  expect(screen.getByText('Sin comisiones ni costos · 100% cobrado')).toBeInTheDocument();
  ['Ganancia comercial', 'Ganancia final', 'Margen liberado', 'Comisiones y costos'].forEach((label) =>
    expect(screen.queryByText(label)).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Devolver este pago' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Devolución' })).not.toBeInTheDocument();
});

test('sin precio pactado ni contracargo; devolver este pago solo pide fecha, importe y cuenta', async () => {
  finanzasApi.detalleVenta.mockResolvedValue(detalle({}));
  render(<PagosVenta ventaId={414} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Devolver este pago' }));
  expect(screen.queryByText(/precio pactado/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Contracargo' })).not.toBeInTheDocument();
  ['Fecha', 'Importe', 'Cuenta'].forEach((label) => expect(screen.getByLabelText(label)).toBeInTheDocument());
  expect(screen.queryByLabelText('Referencia')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Nota')).not.toBeInTheDocument();
});

test('con comisiones mantiene el desglose de ganancias', async () => {
  finanzasApi.detalleVenta.mockResolvedValue(detalle({ comisiones: 50, gananciaFinal: 681.12, margenLiberado: 681.12 }));
  render(<PagosVenta ventaId={414} />);
  expect(await screen.findByText('Ganancia comercial')).toBeInTheDocument();
  ['Ganancia final', 'Margen liberado', 'Comisiones y costos'].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
});
