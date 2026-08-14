import { fireEvent, render, screen } from '@testing-library/react';
import ModalGastoDebito from './ModalGastoDebito';

beforeEach(() => {
  global.fetch = jest.fn(() => new Promise(() => {}));
  localStorage.setItem('token', 'test-token');
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
