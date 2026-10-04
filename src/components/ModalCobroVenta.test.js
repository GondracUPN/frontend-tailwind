import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalCobroVenta from './ModalCobroVenta';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({ tipoCambio: 3.7 });
  api.patch.mockResolvedValue({});
});

test('registra cobros parciales x500 y envía el tipo de cambio a la venta', async () => {
  const onSaved = jest.fn();
  render(<ModalCobroVenta gasto={{ id: 31, saleId: 7, saleSku: 'MS-366', salePaymentType: 'debt', monto: '5200', saleReceivedAmount: '0.00' }} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByText(/Faltante: S\/ 5200.00/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Pagos de S/ 500 recibidos'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Último monto recibido'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Fecha del último pago recibido'), { target: { value: '2026-10-02' } });
  await waitFor(() => expect(screen.getByLabelText('Tipo de cambio de la venta')).toHaveValue(3.7));
  fireEvent.change(screen.getByLabelText('Tipo de cambio de la venta'), { target: { value: '3.8' } });
  expect(screen.getByText(/Faltante: S\/ 4000.00/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobro' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/31', {
    receivedAmount: 1200, paidAt: '2026-10-02', exchangeRate: 3.8,
  }));
  expect(onSaved).toHaveBeenCalled();
});

test('mantiene el pago con tarjeta en cero hasta registrar un importe', async () => {
  render(<ModalCobroVenta gasto={{ id: 32, saleId: 8, saleSku: 'MS-367', salePaymentType: 'card', monto: '1800', saleReceivedAmount: '0.00' }} onClose={jest.fn()} onSaved={jest.fn()} />);
  fireEvent.change(screen.getByLabelText('Fecha en que pagó con tarjeta'), { target: { value: '2026-10-02' } });
  expect(screen.getByText(/Recibido:/)).toHaveTextContent('S/ 0.00');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobro' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Registra un monto recibido');
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Monto recibido hasta ahora'), { target: { value: '800' } });
  expect(screen.getByText(/Recibido:/)).toHaveTextContent('S/ 800.00');
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cobro' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/32', { receivedAmount: 800, paidAt: '2026-10-02' }));
});
