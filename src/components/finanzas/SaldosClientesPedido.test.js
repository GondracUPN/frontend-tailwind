import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import SaldosClientesPedido from './SaldosClientesPedido';
import { finanzasApi } from '../../services/finanzas';
jest.mock('../../services/finanzas', () => ({
  finanzasApi: { clientes: jest.fn() },
  sesionFinanciera: () => ({ esAdmin: true }),
  limpiarError: e => e.message,
}));

test('muestra el crédito actual de clientes y abre inventario para comprar', async () => {
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
