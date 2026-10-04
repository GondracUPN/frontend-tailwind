import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalGastoDebito from './ModalGastoDebito';
import { createExpenseWithDuplicateCheck } from '../utils/createExpense';

jest.mock('../utils/createExpense', () => ({
  createExpenseWithDuplicateCheck: jest.fn(),
  ExpenseDuplicateCancelledError: class ExpenseDuplicateCancelledError extends Error {},
}));

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn(() => new Promise(() => {}));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 12, concepto: 'ingreso' });
});

test('ingreso x500 muestra el faltante y guarda cantidad y destinatario', async () => {
  render(<ModalGastoDebito defaultConcept="ingresos" onClose={jest.fn()} onSaved={jest.fn()} expenseConcepts={[]} />);
  fireEvent.change(screen.getByLabelText('Monto'), { target: { value: '5000' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'x500' }));
  fireEvent.change(screen.getByLabelText('Cantidad de 500'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  expect(screen.getByText(/no puede superar el monto/)).toBeInTheDocument();
  expect(createExpenseWithDuplicateCheck).not.toHaveBeenCalled();

  fireEvent.change(screen.getByLabelText('Cantidad de 500'), { target: { value: '8' } });
  expect(screen.getByText('Faltante: S/ 1000.00')).toBeInTheDocument();
  expect(screen.getByText('Faltan 2 transferencias de S/ 500 · Última: S/ 500.00')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('¿A quién se le dio?'), { target: { value: 'renato' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith(
    expect.objectContaining({ monto: 5000, cantidad500: 8, destinatario500: 'renato' }),
    expect.any(Object),
  ));
});

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

test('Bolsa inicia en soles y no cambia sola despues de una eleccion manual', () => {
  const props = {
    defaultConcept: 'bolsa',
    onClose: jest.fn(),
    onSaved: jest.fn(),
    expenseConcepts: [],
  };
  const { rerender } = render(<ModalGastoDebito {...props} />);

  expect(screen.getByRole('button', { name: 'Soles' })).toHaveClass('bg-emerald-700');

  fireEvent.click(screen.getByRole('button', { name: 'Dolares' }));
  expect(screen.getByRole('button', { name: 'Dolares' })).toHaveClass('bg-emerald-700');

  rerender(<ModalGastoDebito {...props} expenseConcepts={[{
    value: 'concepto_nuevo',
    label: 'Concepto nuevo',
    appliesDebit: true,
    metadata: { defaultCurrency: 'PEN' },
  }]} />);

  expect(screen.getByRole('button', { name: 'Dolares' })).toHaveClass('bg-emerald-700');
});
