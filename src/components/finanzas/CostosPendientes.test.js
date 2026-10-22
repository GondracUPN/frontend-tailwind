import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CompletarCosto } from './CostosPendientes';
import { finanzasApi } from '../../services/finanzas';

jest.mock('../../services/finanzas', () => ({ finanzasApi: { completarCosto: jest.fn() }, limpiarError: (e) => e.message }));
test('completa el costo total con referencia y comunica el resultado a las vistas', async () => {
  finanzasApi.completarCosto.mockResolvedValue({ costoPendiente: false });
  const done = jest.fn();
  render(<CompletarCosto ventaId={7} onDone={done} />);
  fireEvent.click(screen.getByRole('button', { name: 'Completar costo' }));
  fireEvent.change(screen.getByLabelText('Costo total de venta 7'), { target: { value: '50' } });
  fireEvent.change(screen.getByLabelText('Referencia de costo 7'), { target: { value: 'Factura C-10' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar costo' }));
  await waitFor(() => expect(done).toHaveBeenCalled());
  expect(finanzasApi.completarCosto).toHaveBeenCalledWith(7, { costoTotal: 50, documento: 'Factura C-10' });
});
