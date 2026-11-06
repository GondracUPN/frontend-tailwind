import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SaldoClienteVenta from './SaldoClienteVenta';
import { finanzasApi } from '../../services/finanzas';
jest.mock('../../services/finanzas', () => ({
  finanzasApi: {
    resolverClientePedido: jest.fn(),
    saldosCliente: jest.fn(),
    cuentas: jest.fn(),
    generarSaldo: jest.fn(),
  },
  sesionFinanciera: () => ({ esAdmin: true }),
  limpiarError: (e) => e.message,
  nuevaClave: () => 'saldo-clave-test',
}));
const externo = {
  id: 1,
  nombre: 'Jorge',
  pedido_key: 'jorge',
  clase: 'externo',
  admite_saldo: true,
};
const saldo = {
  id: 7,
  venta_id: 50,
  sku: 476,
  original: '1000.00',
  disponible: '1000.00',
  fecha: '2026-11-01',
  tipo_cambio: '3.4000',
  equivalente_usd: '294.12',
  moneda: 'PEN',
  monto_original: '1000.00',
};
beforeEach(() => {
  jest.clearAllMocks();
  finanzasApi.resolverClientePedido.mockResolvedValue(externo);
  finanzasApi.saldosCliente.mockResolvedValue({
    disponible: '1000.00',
    saldos: [saldo],
    movimientos: [],
    ventas: [
      {
        ventaId: 50,
        sku: 476,
        deuda: '0.00',
        convertible: '1000.00',
        pagos: [{ id: 1, montoPen: '1000.00', fechaPago: '2026-10-10' }],
      },
    ],
  });
  finanzasApi.cuentas.mockResolvedValue([
    { id: 1, nombre: 'Banco', activo: true, tipo: 'banco' },
  ]);
});
test('Gonzalo (Jorge) consulta su saldo sin pedir otro selector de cliente', async () => {
  const changed = jest.fn();
  render(
    <SaldoClienteVenta
      vendedor="Gonzalo (Jorge)"
      precio={1300}
      onChange={changed}
    />,
  );
  await screen.findByText('Saldo de Jorge');
  expect(finanzasApi.resolverClientePedido).toHaveBeenCalledWith({
    vendedor: 'Gonzalo (Jorge)',
  });
  expect(finanzasApi.saldosCliente).toHaveBeenCalledWith(1);
  expect(
    screen.queryByLabelText('Cliente de la venta'),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Registrar comprador' }),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText('Aplicar saldo a favor')).not.toBeChecked();
  fireEvent.click(screen.getByLabelText('Aplicar saldo a favor'));
  const respuesta = screen.getByLabelText(/¿El cliente ya pagó/);
  fireEvent.change(respuesta, { target: { value: 'no' } });
  await waitFor(() =>
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        clienteId: 1,
        valido: true,
        saldoCliente: expect.objectContaining({
          monto: 1000,
          pagoAdicional: false,
          fechaPago: undefined,
        }),
      }),
    ),
  );
  fireEvent.change(respuesta, { target: { value: 'si' } });
  expect(screen.getByLabelText('Fecha del pago adicional')).toBeInTheDocument();
  fireEvent.change(await screen.findByLabelText('Cuenta que recibe'), {
    target: { value: '1' },
  });
  await waitFor(() =>
    expect(changed).toHaveBeenLastCalledWith(
      expect.objectContaining({
        valido: true,
        saldoCliente: expect.objectContaining({
          pagoAdicional: true,
          cuentaId: 1,
        }),
      }),
    ),
  );
});
test.each(['Gonzalo', 'Renato', 'ambos'])(
  '%s no ofrece controles de saldo ni registra otro comprador',
  (vendedor) => {
    render(<SaldoClienteVenta vendedor={vendedor} precio={1300} />);
    expect(screen.queryByText(/Saldo de/)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText('Aplicar saldo a favor'),
    ).not.toBeInTheDocument();
    expect(finanzasApi.resolverClientePedido).not.toHaveBeenCalled();
  },
);
test('historial de Jorge muestra solo sus saldos, sin listado general de ventas, deudas o motivo', async () => {
  finanzasApi.saldosCliente.mockResolvedValue({
    disponible: '1000.00',
    saldos: [saldo],
    movimientos: [],
    ventas: [{ ventaId: 999, sku: 999, deuda: '5000.00', pagos: [] }],
  });
  render(<SaldoClienteVenta vendedor="Gonzalo (Jorge)" precio={1300} />);
  await screen.findByText('Historial de Jorge');
  expect(screen.queryByText(/Venta #999/)).not.toBeInTheDocument();
  expect(
    screen.queryByText('Historial de saldos, pagos y deudas'),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Motivo de origen')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Convertir/ }),
  ).not.toBeInTheDocument();
});
