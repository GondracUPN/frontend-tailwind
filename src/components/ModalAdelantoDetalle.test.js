import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalAdelantoDetalle from './ModalAdelantoDetalle';
import ModalEditarAdelantoCuota from './ModalEditarAdelantoCuota';
jest.mock('../api', () => ({ __esModule: true, default: { post: jest.fn(), patch: jest.fn(), del: jest.fn(), get: jest.fn() } }));
const initial = { id: 4, productoId: 9, precio: 2000, cobrado: 500, falta: 1500, estado: 'reservado', producto: { nombre: 'iPhone', codigo: 'MS-9', vendedor: 'Gonzalo' }, pagos: [{ index: 0, fecha: '2026-06-04', monto: 500, banco: 'bcp', tipoPago: 'direct', origen: 'reserva', editable: true }] };
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(initial); api.post.mockResolvedValue({}); api.patch.mockResolvedValue({}); api.del.mockResolvedValue(null); });
const start = async (props = {}) => { render(<ModalAdelantoDetalle adelanto={{ id: 4 }} onClose={jest.fn()} {...props} />); await screen.findByText('iPhone · MS-9'); };
const openPayment = async () => { await start(); fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' })); };
test('registra un pago y vuelve a cargar el resumen del servidor', async () => {
  const onSaved = jest.fn(); await start({ onSaved });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '700' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-06-10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas', { montoCuota: 700, fechaCuota: '2026-06-10', incomeBank: 'bcp', incomePaymentType: 'direct' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(initial));
});
test('muestra un error en línea si se supera lo que falta', async () => {
  await openPayment(); fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '1501' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  expect(screen.getByText(/El pago supera lo que falta/)).toBeInTheDocument(); expect(api.post).not.toHaveBeenCalled();
});
test('corrige en línea sin apilar otro diálogo', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: 'Corregir pago 1' }));
  fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '650' } });
  fireEvent.click(screen.getByRole('button', { name: 'Corregir pago', exact: true }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas/0', expect.objectContaining({ montoCuota: 650 })));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
});
test('pide confirmación con monto antes de quitar un pago', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: 'Corregir pago 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Quitar pago' }));
  expect(screen.getByText(/También se quita de Gastos/)).toHaveTextContent('500'); expect(api.del).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole('button', { name: 'Quitar pago' }); fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(api.del).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas/0'));
});
test('registra el último pago con la opción de cerrar marcada por defecto', async () => {
  await openPayment(); expect(screen.getByLabelText('Cerrar la venta con este pago')).toBeChecked();
  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.5' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-09-11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas', expect.objectContaining({ montoCuota: 1500, cerrarVenta: { tipoCambio: 3.5, fechaVenta: '2026-09-11' } })));
});
test('deja en solo lectura el pago registrado en Finanzas', async () => {
  api.get.mockResolvedValue({ ...initial, pagos: [{ ...initial.pagos[0], origen: 'finanzas', editable: false }] });
  await start(); expect(screen.getByText('Registrado en Finanzas')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: /Corregir/ })).not.toBeInTheDocument();
});
test('cierra con Escape y devuelve el foco al botón que abrió el panel', async () => {
  const opener = document.createElement('button'); document.body.append(opener); opener.focus(); const onClose = jest.fn();
  const view = render(<ModalAdelantoDetalle adelanto={{ id: 4 }} onClose={onClose} />); await screen.findByText('iPhone · MS-9');
  fireEvent.keyDown(document, { key: 'Escape' }); expect(onClose).toHaveBeenCalled(); view.unmount(); expect(opener).toHaveFocus(); opener.remove();
});
test('confirma la cancelación y registra la devolución con el flujo existente', async () => {
  await start(); fireEvent.click(screen.getByRole('button', { name: 'Cancelar reserva' }));
  expect(screen.getByText(/¿Cancelar la reserva y devolver/)).toHaveTextContent('500'); expect(api.del).not.toHaveBeenCalled();
  const buttons = screen.getAllByRole('button', { name: 'Cancelar reserva' }); fireEvent.click(buttons[buttons.length - 1]);
  await waitFor(() => expect(api.del).toHaveBeenCalledWith('/ventas/adelanto/4'));
});
test('desde Gastos abre la corrección y permite registrar otro pago', async () => {
  render(<ModalEditarAdelantoCuota adelantoId={4} index={0} onClose={jest.fn()} />);
  expect(await screen.findByRole('heading', { name: 'Corregir pago' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar otro pago' }));
  expect(screen.getByRole('heading', { name: 'Registrar pago' })).toBeInTheDocument();
  expect(screen.getByLabelText('Monto (S/)')).toHaveValue(1500);
});
test('en una venta cerrada registra otro pago hasta el cobro al cerrar', async () => {
  api.get.mockResolvedValue({ ...initial, cobrado: 2000, falta: 0, estado: 'vendido', ventaId: 405, fechaVenta: '2026-09-11',
    pagos: [initial.pagos[0], { index: -1, fecha: '2026-09-11', monto: 1500, banco: 'bcp', tipoPago: 'direct', origen: 'cierre', editable: true }] });
  await start();
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  expect(screen.getByText(/se descuenta del cobro al cerrar/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '1600' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  expect(screen.getByText(/no puede superar el cobro al cerrar/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '400' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-09-01' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas', { montoCuota: 400, fechaCuota: '2026-09-01', incomeBank: 'bcp', incomePaymentType: 'direct' }));
});
