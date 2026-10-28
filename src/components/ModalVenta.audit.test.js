// Regresiones del informe de auditoría. Cada caso corregido exige la regla deseada.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalVenta from './ModalVenta';
import VentaRapidaModal from './finanzas/VentaRapidaModal';
import { finanzasApi } from '../services/finanzas';

jest.mock('../api', () => ({ __esModule: true, API_URL: 'http://audit.invalid',
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() } }));
jest.mock('../services/finanzas', () => ({
  finanzasApi: { accesorios: jest.fn(), cuentas: jest.fn(), ventaRapida: jest.fn() },
  nuevaClave: () => 'audit-only-key', esErrorDePermiso: () => false, limpiarError: String,
  METODOS_PAGO: [['efectivo', 'Efectivo']],
}));

const saved = { id: 900, productoId: 7, vendedor: 'Gonzalo', fechaVenta: '2026-10-20', precioVenta: 80 };
const ingreso = { id: 77, saleId: 900, concepto: 'ingreso', metodoPago: 'debito',
  moneda: 'PEN', tarjeta: 'bcp', monto: '80.00', fecha: '2026-10-20', notas: '__SALE_INCOME__:7:900' };
let oldFetch;
beforeEach(() => {
  jest.resetAllMocks(); localStorage.clear();
  localStorage.setItem('token', 'audit-only');
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'gonzalo', role: 'admin' }));
  oldFetch = global.fetch;
  api.post.mockImplementation(async (path) => path.endsWith('/cotizar') ? { cotizacionToken: 'a'.repeat(64), costoTotal: 10 } : saved);
  api.get.mockImplementation(async (path) => path === '/auth/users'
    ? [{ id: 1, username: 'gonzalo', role: 'admin' }] : [ingreso]);
  global.fetch = jest.fn().mockResolvedValueOnce({ status: 409, ok: false,
    json: async () => ({ code: 'DUPLICATE_GASTO', duplicates: [ingreso] }) })
    .mockResolvedValueOnce({ status: 201, ok: true, json: async () => ({ id: 78 }) });
});
afterEach(() => { global.fetch = oldFetch; jest.restoreAllMocks(); });

async function vender(confirmar, accesorio = false) {
  jest.spyOn(window, 'confirm').mockReturnValue(confirmar);
  const onSaved = jest.fn();
  render(<ModalVenta producto={{ id: 7, tipo: accesorio ? 'accesorios' : 'macbook', vendedor: 'Gonzalo',
    stockActual: 1, stockInicial: 1, valor: { valorProducto: 10, monedaCompra: accesorio ? 'PEN' : 'USD' } }} onSaved={onSaved} onClose={jest.fn()} />);
  if (!accesorio) fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.7' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-10-20' } });
  fireEvent.change(screen.getByLabelText(accesorio ? 'Precio total de venta (S/)' : 'Precio de venta (S/)'), { target: { value: '80' } });
  if (accesorio) await waitFor(() => expect(screen.queryByText('Cotizando…')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
}

test('AUDIT corregido: accesorio simple usa el único ingreso del servidor', async () => {
  await vender(true, true);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(api.patch).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

test('AUDIT corregido: guardar una venta no ofrece cancelar un ingreso que ya existe', async () => {
  await vender(false);
  expect(global.fetch).not.toHaveBeenCalled();
  expect(window.confirm).not.toHaveBeenCalled();
  expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({ precioVenta: 80 }));
});

test('AUDIT corregido: venta rápida avisa a ventas y Gastos al guardar', async () => {
  finanzasApi.accesorios.mockResolvedValue([]);
  finanzasApi.cuentas.mockResolvedValue([{ id: 1, codigo: 'efectivo', tipo: 'efectivo', nombre: 'Caja', activo: true }]);
  finanzasApi.ventaRapida.mockResolvedValue({ ventas: [saved] });
  const salesEvent = jest.fn(); const gastosEvent = jest.fn();
  window.addEventListener('ventas-updated', salesEvent);
  window.addEventListener('gastos:changed', gastosEvent);
  const onSaved = jest.fn();
  try {
    render(<VentaRapidaModal onClose={jest.fn()} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'Caja' });
    fireEvent.change(screen.getByPlaceholderText('Nombre (p. ej. Mica iPhone 15)'), { target: { value: 'Mica auditoría' } });
    fireEvent.change(screen.getByLabelText('Precio unit.'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(salesEvent).toHaveBeenCalledTimes(1); expect(gastosEvent).toHaveBeenCalledTimes(1);
  } finally {
    window.removeEventListener('ventas-updated', salesEvent);
    window.removeEventListener('gastos:changed', gastosEvent);
  }
});
