import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalEditarGasto from './ModalEditarGasto';

test('al editar un pago en soles recalcula el monto USD con el tipo de cambio', async () => {
  const originalFetch = global.fetch;
  localStorage.setItem('token', 'test-token');
  const gasto = {
    id: 9, concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: 'PEN', monto: 375,
    fecha: '2026-10-05', tarjeta: 'bcp', tarjetaPago: 'io', tasaUsdPen: '3.7500', montoUsdAplicado: '100.00',
  };
  global.fetch = jest.fn(async (url, options = {}) => ({
    ok: true,
    json: async () => options.method === 'PATCH' ? { ...gasto, monto: '380.00' }
      : String(url).includes('/cards') ? [{ type: 'io', label: 'iO' }] : [],
  }));
  const onSaved = jest.fn();
  try {
    render(<ModalEditarGasto gasto={gasto} onClose={jest.fn()} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'iO' });
    fireEvent.change(screen.getByLabelText('Monto (S/)'), { target: { value: '380' } });
    fireEvent.change(screen.getByLabelText('Tipo de cambio (S/ por $)'), { target: { value: '3.8' } });
    expect(screen.getByText('Equivale a $ 100.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const patch = global.fetch.mock.calls.find(([, options]) => options?.method === 'PATCH');
    expect(JSON.parse(patch[1].body)).toMatchObject({
      monto: 380, fecha: '2026-10-05', moneda: 'PEN', tipoCambioDia: 3.8,
      pagoObjetivo: 'USD', montoUsdAplicado: 100,
    });
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
  }
});
