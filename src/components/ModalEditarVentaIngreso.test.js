import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalEditarVentaIngreso from './ModalEditarVentaIngreso';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));

test('edita la venta y todos los cobros por su ID, no el gasto aislado', async () => {
  api.get.mockResolvedValue({ saleId: 12, sku: 'MS-340', amount: 4000, soldAt: '2026-10-08', incomeBank: 'bcp',
    parts: [{ type: 'direct', amount: 3000 }, { type: 'cash', amount: 1000 }] });
  api.patch.mockResolvedValue({ id: 12 });
  const onSaved = jest.fn();
  render(<ModalEditarVentaIngreso saleId={12} onClose={jest.fn()} onSaved={onSaved} />);
  await screen.findByLabelText('Directo de venta vinculada');
  fireEvent.change(screen.getByLabelText('Precio de venta vinculado'), { target: { value: '4200' } });
  fireEvent.change(screen.getByLabelText('Efectivo de venta vinculada'), { target: { value: '5000' } });
  expect(screen.getByLabelText('Efectivo de venta vinculada')).toHaveValue(4200);
  fireEvent.change(screen.getByLabelText('Efectivo de venta vinculada'), { target: { value: '1300' } });
  expect(screen.getByLabelText('Directo de venta vinculada')).toHaveValue(2900);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/ventas/12', {
    precioVenta: 4200, fechaVenta: '2026-10-08', incomeBank: 'bcp',
    incomeParts: [{ type: 'direct', amount: 2900 }, { type: 'cash', amount: 1300 }],
  }));
  expect(onSaved).toHaveBeenCalled();
});
