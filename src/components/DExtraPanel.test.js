import { fireEvent, render, screen } from '@testing-library/react';
import DExtraPanel from './DExtraPanel';

test('muestra total pendiente, importe original, fechas y acceso al cobro', () => {
  const row = { id: 3, salePaymentType: 'card' };
  const onCollect = jest.fn();
  render(<DExtraPanel debts={[{
    id: 'sale-1', title: 'MS-77', total: 1000, received: 400, pending: 600,
    startedAt: '2026-09-01', kinds: ['card'], history: [{ date: '2026-09-03', amount: 400, type: 'card' }], collectionRows: [row],
  }]} onClose={jest.fn()} onCollect={onCollect} />);
  expect(screen.getByText('Total por cobrar').parentElement).toHaveTextContent('S/ 600.00');
  expect(screen.getByText('MS-77').parentElement.parentElement).toHaveTextContent('S/ 1000.00');
  expect(screen.getByText(/2026-09-03/)).toHaveTextContent('S/ 400.00');
  fireEvent.click(screen.getByRole('button', { name: 'Cobrar Tarjeta' }));
  expect(onCollect).toHaveBeenCalledWith(row);
});
