import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalAdelantoDetalle from './ModalAdelantoDetalle';

jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

const inicial = {
  id: 4,
  productoId: 9,
  montoAdelanto: 500,
  montoVenta: 2000,
  fechaAdelanto: '2026-06-04',
  cuotas: [{ fecha: '2026-06-04', monto: 500 }],
};

function Harness() {
  const [adelanto, setAdelanto] = useState(inicial);
  return (
    <ModalAdelantoDetalle
      adelanto={adelanto}
      producto={{ id: 9 }}
      onClose={jest.fn()}
      onCompletar={jest.fn()}
      onSaved={setAdelanto}
    />
  );
}

test('agrega un nuevo adelanto y actualiza el total y el saldo restante', async () => {
  api.post.mockResolvedValue({
    ...inicial,
    montoAdelanto: 1200,
    cuotas: [
      { fecha: '2026-06-04', monto: 500 },
      { fecha: '2026-06-10', monto: 700 },
    ],
  });

  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: 'Nuevo adelanto' }));
  fireEvent.change(screen.getByLabelText('Fecha'), {
    target: { value: '2026-06-10' },
  });
  fireEvent.change(screen.getByLabelText('Nuevo monto adelantado (S/)'), {
    target: { value: '700' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar adelanto' }));

  await waitFor(() => {
    expect(api.post).toHaveBeenCalledWith('/ventas/adelanto/4/cuotas', {
      fechaCuota: '2026-06-10',
      montoCuota: 700,
    });
  });

  expect(await screen.findByText('S/ 1200.00')).toBeInTheDocument();
  expect(screen.getByText('S/ 800.00')).toBeInTheDocument();
  expect(screen.getByText('Adelanto 2')).toBeInTheDocument();
  expect(screen.getByText('2026-06-10')).toBeInTheDocument();
});

test('no permite que un nuevo adelanto supere el saldo pendiente', () => {
  render(<Harness />);

  fireEvent.click(screen.getByRole('button', { name: 'Nuevo adelanto' }));
  fireEvent.change(screen.getByLabelText('Fecha'), {
    target: { value: '2026-06-10' },
  });
  fireEvent.change(screen.getByLabelText('Nuevo monto adelantado (S/)'), {
    target: { value: '1501' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar adelanto' }));

  expect(screen.getByRole('alert')).toHaveTextContent(
    'El nuevo adelanto no puede superar el saldo pendiente de S/ 1500.00.',
  );
  expect(api.post).not.toHaveBeenCalled();
});
