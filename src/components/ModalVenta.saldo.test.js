import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalVenta from './ModalVenta';
import api from '../api';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const producto = { id: 477, tipo: 'iphone', vendedor: 'Gonzalo (Jorge)',
  valor: { monedaCompra: 'USD', valorProducto: 400, valorSoles: 1400, costoTotal: 1500 } };
const origenes = [
  { id: 1, sku: 454, fecha: '2026-01-01', disponible: '1000.00', tipo_cambio: '3.4000' },
  { id: 2, sku: 455, fecha: '2026-01-02', disponible: '1000.00', tipo_cambio: '3.6000' },
];
let disponible;
beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('user', JSON.stringify({ role: 'admin' }));
  disponible = '2000.00';
  api.get.mockImplementation(async path => path.endsWith('/saldos')
    ? { disponible, saldos: origenes, movimientos: [], devoluciones: [] }
    : path === '/finanzas/cuentas' ? [{ id: 1, nombre: 'BCP', tipo: 'banco', activo: true }] : []);
  api.post.mockImplementation(async (path, body) => path.endsWith('/resolver-pedido')
    ? { id: body.vendedor.includes('Jorge') ? 1 : 2, nombre: 'Jorge', clase: 'externo', admite_saldo: true }
    : { id: 999, ...body });
  window.alert = jest.fn();
});

test('un pedido nuevo empieza pendiente y no supone un cobro directo al guardar', async () => {
  render(<ModalVenta producto={producto} onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  expect(screen.getByLabelText('Estado del pago')).toHaveValue('pendiente');
  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.4' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1300' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    precioVenta: 1300, incomeParts: [{ type: 'cash', amount: 1300 }],
  })));
});

test('elige saldo como forma de pago y conserva el cambio proporcional de los orígenes consumidos', async () => {
  render(<ModalVenta producto={producto} onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-11-09' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1500' } });
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'saldo_cliente' } });
  await waitFor(() => expect(screen.getByLabelText('Saldo que se utilizará (S/)')).toHaveValue(1500));
  expect(screen.getByLabelText('Forma de pago')).toHaveValue('saldo_cliente');
  expect(screen.getByLabelText('Cambio histórico del saldo')).toHaveTextContent('3.4642');
  expect(screen.getByLabelText('Cambio histórico del saldo')).toHaveTextContent('SKU 454 · S/ 1,000.00');
  expect(screen.getByLabelText('Cambio histórico del saldo')).toHaveTextContent('SKU 455 · S/ 500.00');
  expect(screen.queryByLabelText('Tipo de cambio')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Banco donde ingresó la venta')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    clienteId: 1, precioVenta: 1500, saldoCliente: expect.objectContaining({ monto: 1500, pagoAdicional: false }),
  })));
  const body = api.post.mock.calls.find(([path]) => path === '/ventas')[1];
  expect(body).not.toHaveProperty('incomePaymentType');
  expect(body).not.toHaveProperty('incomeParts');
  expect(body).not.toHaveProperty('tipoCambio');
});

test('aplica parte del saldo, confirma la diferencia pendiente y permite volver a pago directo', async () => {
  render(<ModalVenta producto={producto} onClose={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1500' } });
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'saldo_cliente' } });
  fireEvent.change(await screen.findByLabelText('Saldo que se utilizará (S/)'), { target: { value: '500' } });
  fireEvent.change(screen.getByLabelText(/¿El cliente ya pagó/), { target: { value: 'no' } });
  expect(screen.getByLabelText('Cambio histórico del saldo')).toHaveTextContent('3.4000');
  expect(screen.getByText(/Diferencia pendiente:/)).toHaveTextContent('S/ 1,000.00');
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'direct' } });
  expect(screen.getByLabelText('Tipo de cambio')).toBeInTheDocument();
  expect(screen.queryByLabelText('Banco donde ingresó la venta')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Saldo que se utilizará (S/)')).not.toBeInTheDocument();
});

test('envía el cambio del adicional cuando saldo y dinero nuevo son iguales', async () => {
  render(<ModalVenta producto={producto} onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1300' } });
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'saldo_cliente' } });
  fireEvent.change(await screen.findByLabelText('Saldo que se utilizará (S/)'), { target: { value: '650' } });
  fireEvent.change(screen.getByLabelText(/¿El cliente ya pagó/), { target: { value: 'si' } });
  fireEvent.change(screen.getByLabelText('Tipo de cambio del pago adicional'), { target: { value: '3.6' } });
  await screen.findByRole('option', { name: 'BCP' });
  fireEvent.change(screen.getByLabelText('Cuenta que recibe'), { target: { value: '1' } });
  expect(screen.getByLabelText('Tipo de cambio total de la venta')).toHaveTextContent('3.4971');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    saldoCliente: expect.objectContaining({ monto: 650, pagoAdicional: true, tipoCambioPagoAdicional: 3.6 }),
  })));
});

test('guarda saldo y diferencia pagada con fechas anteriores al registro del saldo', async () => {
  api.get.mockImplementation(async path => path.endsWith('/saldos')
    ? { disponible: '995.00', saldos: [{ id: 1, sku: 483, fecha: '2026-11-09', disponible: '995.00', tipo_cambio: '3.4010' }], movimientos: [], devoluciones: [] }
    : path === '/finanzas/cuentas' ? [{ id: 1, nombre: 'BCP', tipo: 'banco', activo: true }] : []);
  render(<ModalVenta producto={producto} onClose={jest.fn()} onSaved={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-10-27' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1300' } });
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'saldo_cliente' } });
  fireEvent.change(await screen.findByLabelText('Fecha de aplicación del saldo'), { target: { value: '2026-10-27' } });
  fireEvent.change(screen.getByLabelText(/¿El cliente ya pagó/), { target: { value: 'si' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago adicional'), { target: { value: '2026-10-27' } });
  await screen.findByRole('option', { name: 'BCP' });
  fireEvent.change(screen.getByLabelText('Cuenta que recibe'), { target: { value: '1' } });
  expect(screen.getByText(/Diferencia pagada:/)).toHaveTextContent('S/ 305.00');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    saldoCliente: expect.objectContaining({ monto: 995, fecha: '2026-10-27', pagoAdicional: true, fechaPago: '2026-10-27' }),
  })));
});

test('solo ofrece saldo a clientes con saldo positivo y desactiva su uso al cambiar comprador', async () => {
  const view = render(<ModalVenta producto={producto} onClose={jest.fn()} />);
  await screen.findByRole('option', { name: 'Saldo a favor del cliente' });
  fireEvent.change(screen.getByLabelText('Forma de pago'), { target: { value: 'saldo_cliente' } });
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: 'Gonzalo' } });
  await waitFor(() => expect(screen.queryByRole('option', { name: 'Saldo a favor del cliente' })).not.toBeInTheDocument());
  expect(screen.getByLabelText('Forma de pago')).toHaveValue('direct');
  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: '' } });
  expect(screen.queryByRole('option', { name: 'Saldo a favor del cliente' })).not.toBeInTheDocument();
  view.unmount();
  disponible = '0.00';
  render(<ModalVenta producto={producto} onClose={jest.fn()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/finanzas/clientes/1/saldos'));
  expect(screen.queryByRole('option', { name: 'Saldo a favor del cliente' })).not.toBeInTheDocument();
});
