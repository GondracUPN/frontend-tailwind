import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

test('el historial muestra solo devoluciones y su parte pagada, sin saldos anulados ni las demás compras', async () => {
  finanzasApi.saldosCliente.mockResolvedValue({ disponible: '250.00',
    saldos: [{ ...saldo, sku: 455, disponible: '0.00', anulada_at: '2026-11-07' }], movimientos: [],
    ventas: [{ ventaId: 80, sku: 999, estadoComercial: 'entregada' }],
    devoluciones: [{ id: 5, sku: 454, fecha: '2026-11-01', precio_venta: '1000.00', saldo_generado: '250.00',
      importe_sin_pagar: '750.00', disponible: '250.00', motivo: 'No llegó a Eshopex.', estado: 'reclamo_abierto' }] });
  render(<SaldoClienteVenta vendedor="Gonzalo (Jorge)" />);
  await screen.findByText('Historial de productos devueltos de Jorge');
  expect(screen.getByText(/SKU 454/)).toBeInTheDocument();
  expect(screen.queryByText(/SKU 455/)).not.toBeInTheDocument();
  expect(screen.queryByText(/SKU 999/)).not.toBeInTheDocument();
  expect(screen.getByText('Importe sin pagar')).toBeInTheDocument();
  expect(screen.queryByText('TC histórico / estado')).not.toBeInTheDocument();
});
test('en una venta ya pagada el saldo se resume en una línea plegable sin pedir el precio', async () => {
  render(<SaldoClienteVenta ventaId={50} vendedor="Gonzalo (Jorge)" precio={0} />);
  const resumen = await screen.findByText(/^Jorge tiene .*1,?000\.00 a favor$/);
  expect(screen.queryByText(/Ingresa el precio del nuevo producto/)).not.toBeInTheDocument();
  expect(screen.queryByText('Saldo de Jorge')).not.toBeInTheDocument();
  const plegable = screen.getByRole('group', { name: 'Saldo de Jorge' });
  expect(plegable).not.toHaveAttribute('open');
  fireEvent.click(resumen);
  expect(within(plegable).getByRole('button', { name: 'Devolver saldo a favor' })).toBeInTheDocument();
  expect(screen.getAllByRole('group')).toHaveLength(1);
});
test('con saldo por cobrar mantiene el bloque completo para aplicar el saldo', async () => {
  render(<SaldoClienteVenta ventaId={50} vendedor="Gonzalo (Jorge)" precio={500} />);
  expect(await screen.findByText('Saldo de Jorge')).toBeVisible();
  expect(screen.getByLabelText('Aplicar saldo a favor')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Devolver saldo a favor' })).toBeVisible();
});
test('el historial de devoluciones no muestra el listado general de ventas ni controles de conversión', async () => {
  finanzasApi.saldosCliente.mockResolvedValue({
    disponible: '1000.00',
    saldos: [saldo],
    movimientos: [],
    ventas: [{ ventaId: 999, sku: 999, deuda: '5000.00', pagos: [] }],
  });
  render(<SaldoClienteVenta vendedor="Gonzalo (Jorge)" precio={1300} />);
  await screen.findByText('Historial de productos devueltos de Jorge');
  expect(screen.queryByText(/Venta #999/)).not.toBeInTheDocument();
  expect(
    screen.queryByText('Historial de saldos, pagos y deudas'),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Motivo de origen')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Convertir/ }),
  ).not.toBeInTheDocument();
});
