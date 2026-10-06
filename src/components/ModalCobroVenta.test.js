import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalCobroVenta from './ModalCobroVenta';

jest.mock('../api', () => ({ __esModule: true, default: { patch: jest.fn() } }));

beforeEach(() => {
  jest.clearAllMocks();
  api.patch.mockResolvedValue({});
});

test('registra pagos x500 con fecha y mantiene vacíos los campos del nuevo pago', async () => {
  const onSaved = jest.fn();
  render(<ModalCobroVenta gasto={{ id: 31, saleId: 7, saleSku: 'MS-366', salePaymentType: 'debt', monto: '5200', saleReceivedAmount: '500.00', salePaymentHistory: [{ amount: 500, paidAt: '2026-10-02', units500: 1 }] }} onClose={jest.fn()} onSaved={onSaved} />);
  expect(screen.getByText('2026-10-02 · 1 × 500')).toBeInTheDocument();
  expect(screen.getByLabelText(/Pagos de S\/ 500 que vas a registrar/)).toHaveValue(null);
  expect(screen.getByLabelText('Fecha del pago')).toHaveValue('');
  fireEvent.change(screen.getByLabelText(/Pagos de S\/ 500 que vas a registrar/), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-10-05' } });
  fireEvent.change(screen.getByLabelText('Tipo de cambio (opcional)'), { target: { value: '3.8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/31', {
    paymentCount: 3, paidAt: '2026-10-05', exchangeRate: 3.8,
  }));
  expect(onSaved).toHaveBeenCalled();
});

test('en deuda normal solo agrega el importe nuevo hasta el saldo máximo', async () => {
  render(<ModalCobroVenta gasto={{ id: 32, saleId: 8, salePaymentType: 'card', monto: '2600', saleReceivedAmount: '900.00', salePaymentHistory: [{ amount: 900, paidAt: '2026-10-02' }] }} onClose={jest.fn()} onSaved={jest.fn()} />);
  const amount = screen.getByLabelText('Nuevo pago recibido');
  expect(amount).toHaveValue(null);
  expect(amount).toHaveAttribute('max', '1700');
  fireEvent.change(amount, { target: { value: '1701' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-10-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  expect(screen.getByRole('alert')).toHaveTextContent('no puede superar S/ 1700.00');
  expect(api.patch).not.toHaveBeenCalled();
  fireEvent.change(amount, { target: { value: '1700' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/32', { paymentAmount: 1700, paidAt: '2026-10-05' }));
});

test('muestra el último monto x500 y permite corregir el cambio una vez pagado', async () => {
  const { unmount } = render(<ModalCobroVenta gasto={{ id: 33, saleId: 9, salePaymentType: 'debt', monto: '1200', saleReceivedAmount: '1000.00', saleExchangeRate: '3.7000' }} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.queryByLabelText(/Pagos de S\/ 500 que vas a registrar/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Último monto recibido'), { target: { value: '200' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-10-05' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/33', { paymentAmount: 200, paidAt: '2026-10-05' }));

  unmount();
  render(<ModalCobroVenta gasto={{ id: 34, saleId: 10, salePaymentType: 'card', monto: '1200', saleReceivedAmount: '1200.00', saleExchangeRate: '3.7000' }} onClose={jest.fn()} onSaved={jest.fn()} />);
  expect(screen.getByText('✓ Deuda pagada')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tipo de cambio (opcional)'), { target: { value: '3.8' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambio' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/34', { exchangeRate: 3.8 }));
});
