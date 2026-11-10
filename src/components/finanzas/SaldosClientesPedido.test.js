import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SaldosClientesPedido from './SaldosClientesPedido';
import { finanzasApi } from '../../services/finanzas';
jest.mock('../../services/finanzas', () => ({
  finanzasApi: { clientes: jest.fn(), saldosCliente: jest.fn() },
  sesionFinanciera: () => ({ esAdmin: true }),
  limpiarError: e => e.message,
}));

test('muestra el crédito actual de clientes y abre inventario para comprar', async () => {
  finanzasApi.saldosCliente.mockImplementation(async id => ({ disponible: id === 1 ? '1000.00' : id === 2 ? '300.00' : '0.00', ventas: [] }));
  finanzasApi.clientes.mockResolvedValue([
    { id: 1, nombre: 'Jorge', clase: 'externo', admite_saldo: true, disponible: '1000.00' },
    { id: 2, nombre: 'Kenny', clase: 'externo', admite_saldo: true, disponible: '300.00' },
    { id: 3, nombre: 'Agotado', clase: 'externo', admite_saldo: true, disponible: '0.00' },
    { id: 4, nombre: 'Propio', clase: 'propio', disponible: '500.00' },
  ]);
  const comprar = jest.fn();
  render(<SaldosClientesPedido onComprar={comprar} />);
  expect(await screen.findByText('Jorge')).toBeVisible();
  expect(screen.getByText('Kenny')).toBeVisible();
  expect(screen.queryByText('Agotado')).not.toBeInTheDocument();
  expect(screen.queryByText('Propio')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Comprar en inventario' }));
  expect(comprar).toHaveBeenCalledTimes(1);
});

test('muestra deuda sin saldo, ambos importes y adelantos, excluyendo ventas anuladas y reembolsos', async () => {
  finanzasApi.clientes.mockResolvedValue([
    { id: 1, nombre: 'Jorge', clase: 'externo', admite_saldo: true },
    { id: 2, nombre: 'Kenny', clase: 'externo', admite_saldo: true },
  ]);
  finanzasApi.saldosCliente.mockImplementation(async id => ({ disponible: id === 1 ? '995.00' : '0.00', ventas: [
    { deuda: id === 1 ? '305.00' : '400.00' }, { deuda: '1300.00', anulada: true }, { deuda: '1000.00', afectada: true },
  ] }));
  render(<SaldosClientesPedido revision={{ rows: [
    { adelantoId: 1, cliente: 'Kenny', saldo: 50 },
    { adelantoId: 2, cliente: 'Kenny', saldo: 600, tieneReembolso: true },
    { adelantoId: 3, ventaId: 2, cliente: 'Kenny', saldo: 500 },
    { adelantoId: 4, cliente: 'Nuevo', saldo: 100 },
  ] }} />);
  expect(await screen.findByText('Kenny')).toBeVisible();
  expect(screen.getByText('S/ 995.00')).toBeVisible();
  expect(screen.getByText('S/ 305.00')).toBeVisible();
  expect(screen.getByText('S/ 450.00')).toBeVisible();
  expect(screen.getByText('Nuevo')).toBeVisible();
  expect(screen.getByText('S/ 100.00')).toBeVisible();
});
