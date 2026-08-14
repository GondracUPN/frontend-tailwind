import { fireEvent, render, screen } from '@testing-library/react';
import FormProductoMacDesktop from './FormProductoMacDesktop';

test('Mac mini ofrece solamente versiones con chips Apple', () => {
  const onChange = jest.fn();
  render(<FormProductoMacDesktop tipo="macmini" detalle={{}} onChange={onChange} />);

  expect(screen.getByRole('option', { name: 'Mac mini M1' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Mac mini M4 Pro' })).toBeInTheDocument();
  expect(screen.queryByText(/Intel/i)).not.toBeInTheDocument();
});

test('iMac permite elegir sus versiones Apple Silicon', () => {
  const onChange = jest.fn();
  render(<FormProductoMacDesktop tipo="imac" detalle={{}} onChange={onChange} />);

  fireEvent.change(screen.getByLabelText('Versión / chip Apple'), { target: { value: 'M4' } });
  expect(onChange).toHaveBeenCalledWith('procesador', 'M4');
  expect(screen.getByRole('option', { name: 'iMac M1' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'iMac M3' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'iMac M4' })).toBeInTheDocument();
});
