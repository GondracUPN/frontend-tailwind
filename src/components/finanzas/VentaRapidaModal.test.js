import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../api';
import { finanzasApi } from '../../services/finanzas';
import VentaRapidaModal from './VentaRapidaModal';

jest.mock('../../api', () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock('../../services/finanzas', () => ({ finanzasApi: { accesorios: jest.fn(), cuentas: jest.fn(), ventaRapida: jest.fn() },
  nuevaClave: () => 'quick-test-key', esErrorDePermiso: () => false, limpiarError: (error) => error.message,
  METODOS_PAGO: [['efectivo', 'Efectivo']] }));

beforeEach(() => {
  jest.resetAllMocks();
  finanzasApi.accesorios.mockResolvedValue([{ productoId: 101, codigo: 101, nombre: 'Cable', comprador: 'Renato', stock: 5, precioPublicado: 25, precioMinimo: 20 }]);
  finanzasApi.cuentas.mockResolvedValue([{ id: 1, activo: true, codigo: 'efectivo', tipo: 'efectivo', nombre: 'Caja' }]);
  finanzasApi.ventaRapida.mockResolvedValue({ ventas: [{ id: 1 }] });
  api.post.mockImplementation(async (_, body) => ({ cotizacionToken: 'a'.repeat(64), costoTotal: body.cantidad === 5 ? 65 : 10 }));
});

test('venta rápida aplica mayorista por cantidad sin sobrescribir un descuento escrito a mano', async () => {
  finanzasApi.accesorios.mockResolvedValue([{ productoId: 101, nombre: 'Cable', comprador: 'Renato', stock: 20,
    precioPublicado: 25, precioMinimo: 15, precioMayorista: 18, cantidadMinimaMayorista: 5 }]);
  render(<VentaRapidaModal onClose={jest.fn()} />);
  await screen.findByRole('option', { name: /Cable · Renato/ });
  fireEvent.change(screen.getByLabelText('Accesorio'), { target: { value: '101' } });
  fireEvent.change(screen.getByLabelText('Cant.'), { target: { value: '5' } });
  expect(screen.getByLabelText('Precio unit.')).toHaveValue('18');
  fireEvent.change(screen.getByLabelText('Cant.'), { target: { value: '4' } });
  expect(screen.getByLabelText('Precio unit.')).toHaveValue('25');
  fireEvent.change(screen.getByLabelText('Precio unit.'), { target: { value: '14' } });
  fireEvent.change(screen.getByLabelText('Cant.'), { target: { value: '5' } });
  expect(screen.getByLabelText('Precio unit.')).toHaveValue('14');
  expect(screen.getByRole('alert')).toHaveTextContent('por debajo del precio mínimo');
});

test('precarga publicado y mínimo, cotiza varios lotes del comprador y permite descuento con aviso', async () => {
  const onSaved = jest.fn();
  render(<VentaRapidaModal onClose={jest.fn()} onSaved={onSaved} />);
  await screen.findByRole('option', { name: /Cable · Renato · 5/ });
  fireEvent.change(screen.getByLabelText('Accesorio'), { target: { value: '101' } });
  expect(screen.getByLabelText('Precio unit.')).toHaveValue('25');
  fireEvent.change(screen.getByLabelText('Cant.'), { target: { value: '5' } });
  fireEvent.change(screen.getByLabelText('Precio unit.'), { target: { value: '19' } });
  expect(screen.getByRole('alert')).toHaveTextContent('por debajo del precio mínimo');
  await waitFor(() => expect(screen.getByText(/Costo total cotizado:/)).toHaveTextContent('65.00'));
  expect(api.post).toHaveBeenLastCalledWith('/ventas/accesorios/cotizar', expect.objectContaining({ productoId: 101, cantidad: 5, comprador: 'Renato' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar venta' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(finanzasApi.ventaRapida).toHaveBeenCalledWith(expect.objectContaining({ items: [expect.objectContaining({ productoId: 101, cantidad: 5, precioUnitario: 19, cotizacionToken: 'a'.repeat(64) })] }));
});

test('si cambia el stock al confirmar, muestra el error y recotiza', async () => {
  finanzasApi.ventaRapida.mockRejectedValue(new Error('HTTP 409 - La cotización cambió'));
  render(<VentaRapidaModal onClose={jest.fn()} />);
  await screen.findByRole('option', { name: /Cable · Renato/ });
  fireEvent.change(screen.getByLabelText('Accesorio'), { target: { value: '101' } });
  await waitFor(() => expect(screen.getByText(/Costo total cotizado:/)).toHaveTextContent('10.00'));
  const calls = api.post.mock.calls.length;
  await waitFor(() => expect(screen.getByRole('button', { name: 'Registrar venta' })).not.toBeDisabled());
  fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
  expect(await screen.findByText('HTTP 409 - La cotización cambió')).toBeVisible();
  await waitFor(() => expect(api.post.mock.calls.length).toBeGreaterThan(calls));
});
