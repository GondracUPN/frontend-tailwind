import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import VentaResolutionModal from './VentaResolutionModal';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), del: jest.fn() } }));
beforeEach(() => {
  jest.resetAllMocks();
  api.get.mockImplementation(async (path) => path === '/finanzas/cuentas'
    ? [{ id: 1, nombre: 'BCP', activo: true, moneda: 'PEN', tipo: 'banco' }]
    : path.endsWith('/devoluciones') ? [] : { id: 10, cantidad: 3, estadoComercial: 'entregada' });
  api.post.mockResolvedValue({ id: 2 });
});

test('devuelve una unidad con importe y destino explícitos; no borra la venta', async () => {
  const onSaved = jest.fn();
  render(<VentaResolutionModal ventaId={10} onSaved={onSaved} onClose={jest.fn()} />);
  await screen.findByText('Unidades que se pueden devolver: 3');
  fireEvent.change(screen.getByLabelText('Dinero devuelto'), { target: { value: '80' } });
  fireEvent.change(screen.getByLabelText('Destino físico'), { target: { value: 'disponible' } });
  fireEvent.change(screen.getByLabelText('Cuenta de salida'), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText('Motivo'), { target: { value: 'Se devuelve una mica' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar devolución' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith('/ventas/10/devoluciones', expect.objectContaining({ cantidad: 1, monto: 80, destino: 'disponible', cuentaId: 1, operacionKey: expect.any(String) }));
  expect(api.del).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Corregir error sin cobros' })).not.toBeInTheDocument();
});
