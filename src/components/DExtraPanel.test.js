import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import DExtraPanel from './DExtraPanel';

jest.mock('../api', () => ({ __esModule: true, default: { patch: jest.fn() } }));

test('abre una reserva para registrar otro pago sin cerrar D.Extra', () => {
  const onAdvance = jest.fn();
  const onClose = jest.fn();
  render(<DExtraPanel debts={[{ id: 'advance-10', adelantoId: 10, title: 'MS-279', total: 2600, received: 700, pending: 1900, startedAt: '2026-06-27', kinds: ['advance'], history: [], collectionRows: [] }]} onClose={onClose} onAdvance={onAdvance} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cobrar MS-279' }));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago del adelanto' }));
  expect(onAdvance).toHaveBeenCalledWith(10);
  expect(onClose).not.toHaveBeenCalled();
});

test('muestra solo lo que falta y cobra dentro del mismo cuadro', async () => {
  const row = { id: 3, saleId: 1, saleSku: 'MS-77', salePaymentType: 'card', monto: '1000.00', saleReceivedAmount: '400.00', tarjeta: 'bcp', salePaymentHistory: [{ amount: 400, paidAt: '2026-09-03' }] };
  const onCollected = jest.fn();
  const onClose = jest.fn();
  api.patch.mockResolvedValue({ ...row, saleReceivedAmount: '1000.00' });
  render(<DExtraPanel debts={[{
    id: 'sale-1', title: 'MS-77', total: 1000, received: 400, pending: 600,
    startedAt: '2026-09-01', kinds: ['card'], history: [{ date: '2026-09-03', amount: 400, type: 'card' }], collectionRows: [row],
  }]} onClose={onClose} onCollected={onCollected} />);
  expect(screen.getByText('Falta S/ 600.00')).toBeInTheDocument();
  expect(screen.queryByText(/2026-09-03/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cobrar MS-77' }));
  expect(screen.getAllByText(/2026-09-03/).length).toBeGreaterThan(0);
  fireEvent.change(screen.getByLabelText('Nuevo pago recibido'), { target: { value: '600' } });
  fireEvent.change(screen.getByLabelText('Fecha del pago'), { target: { value: '2026-10-20' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar pago' }));
  await waitFor(() => expect(onCollected).toHaveBeenCalledWith(expect.objectContaining({ id: 3 })));
  expect(api.patch).toHaveBeenCalledWith('/gastos/sale-income/3', { paymentAmount: 600, paidAt: '2026-10-20', bank: 'bcp' });
  expect(onClose).not.toHaveBeenCalled();
});
