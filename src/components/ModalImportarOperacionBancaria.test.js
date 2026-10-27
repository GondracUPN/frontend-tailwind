import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ModalImportarOperacionBancaria from './ModalImportarOperacionBancaria';
import { createExpenseWithDuplicateCheck } from '../utils/createExpense';

jest.mock('../api', () => ({ API_URL: 'https://example.test' }));
jest.mock('../utils/createExpense', () => ({
  createExpenseWithDuplicateCheck: jest.fn(),
  ExpenseDuplicateCancelledError: class extends Error {},
}));

const receipt = `Interbank
Constancia de pago
Código de operación
0524863
Fecha y hora
23 Oct 2026
02:03 PM
Cuenta cargo
Cuenta Simple
Dólares
285 3147915703
Tarjeta de crédito
Visa Platinum
Soles
422224******7645
Moneda y monto
US$ 96.50`;

beforeEach(() => {
  jest.clearAllMocks();
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 1 });
});

test('muestra y guarda el pago con la cuenta Interbank y moneda del cargo', async () => {
  const onSaved = jest.fn();
  render(<ModalImportarOperacionBancaria userId={7} ownerName="Walter" cards={[{ tipo: 'interbank' }]} onSaved={onSaved} />);
  fireEvent.change(screen.getByPlaceholderText(/Pega aquí/), { target: { value: receipt } });
  fireEvent.click(screen.getByRole('button', { name: 'Analizar lote' }));
  expect(screen.getByText('Interbank •••• 5703')).toBeInTheDocument();
  expect(screen.getByLabelText('La deuda pagada era en')).toHaveValue('USD');
  fireEvent.click(screen.getByRole('button', { name: 'Importar 1 operación' }));
  await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith({
    concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: 'USD', monto: 96.5,
    fecha: '2026-10-23', tarjeta: 'interbank', tarjetaPago: 'interbank', pagoObjetivo: 'USD',
    notas: '__BANK_IMPORT__:INTERBANK:0524863',
  }, { userId: 7 }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ id: 1 }));
});

test('reconoce el marcador Interbank al reimportar una operación guardada', () => {
  render(<ModalImportarOperacionBancaria cards={[{ tipo: 'interbank' }]} rows={[{ id: 1, notas: '__BANK_IMPORT__:INTERBANK:0524863' }]} />);
  fireEvent.change(screen.getByPlaceholderText(/Pega aquí/), { target: { value: receipt } });
  fireEvent.click(screen.getByRole('button', { name: 'Analizar lote' }));
  expect(screen.getByText(/Ya existe: al importar/)).toBeInTheDocument();
});
