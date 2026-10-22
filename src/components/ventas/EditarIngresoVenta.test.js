import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EditarIngresoVenta from './EditarIngresoVenta';
import api from '../../api';
jest.mock('../../api', () => ({ get: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

test('el lápiz de un adelanto de Gastos abre el panel en su pago', () => {
  const onAdvance = jest.fn();
  render(<EditarIngresoVenta ingreso={{ notas: '__SALE_ADVANCE__:10:1', saleSku: 'MS-279' }} onAdvance={onAdvance} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar adelanto 2 de MS-279' }));
  expect(onAdvance).toHaveBeenCalledWith({ id: 10, index: 1 });
  expect(api.get).not.toHaveBeenCalled();
});

test('el cobro de cierre de una venta reservada abre el mismo panel', async () => {
  api.get.mockResolvedValue({ adelantoId: 10 }); const onAdvance = jest.fn(); const onSale = jest.fn();
  render(<EditarIngresoVenta ingreso={{ notas: '__SALE_INCOME__:279:405', saleId: 405 }} onAdvance={onAdvance} onSale={onSale} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(onAdvance).toHaveBeenCalledWith({ id: 10 })); expect(onSale).not.toHaveBeenCalled();
});

test('conserva el editor de ingresos para ventas sin reserva', async () => {
  api.get.mockResolvedValue({ adelantoId: null }); const onSale = jest.fn();
  render(<EditarIngresoVenta ingreso={{ saleId: 405 }} onAdvance={jest.fn()} onSale={onSale} />);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(onSale).toHaveBeenCalledWith(405));
});
