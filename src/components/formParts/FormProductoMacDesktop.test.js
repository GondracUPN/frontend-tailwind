import { fireEvent, render, screen } from '@testing-library/react';
import api from '../../api';
import FormProductoMacDesktop from './FormProductoMacDesktop';
import catalogForms from '../../__fixtures__/appleCatalogForms.json';

jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn() } }));
beforeEach(() => api.get.mockResolvedValue(catalogForms));

test('Mac mini ofrece solamente modelos Apple Silicon del catálogo y no pide pantalla', async () => {
  render(<FormProductoMacDesktop tipo="macmini" detalle={{}} onChange={jest.fn()} />);

  expect(await screen.findByRole('option', { name: 'M4' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'M4 Pro' })).toBeInTheDocument();
  expect(screen.getByLabelText('Procesador')).toBeInTheDocument();
  expect(screen.queryByText(/Intel/i)).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Pantalla')).not.toBeInTheDocument();
});

test('iMac fija el chip desde el modelo y conserva la pantalla de 24"', async () => {
  const onChange = jest.fn();
  render(<FormProductoMacDesktop tipo="imac" detalle={{}} onChange={onChange} />);

  fireEvent.change(await screen.findByLabelText('Procesador'), { target: { value: 'M4' } });
  expect(onChange).toHaveBeenCalledWith('procesador', 'M4');
});
