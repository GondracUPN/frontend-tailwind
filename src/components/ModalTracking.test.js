import { fireEvent, render, screen } from '@testing-library/react';
import api from '../api';
import ModalTracking from './ModalTracking';

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue(null);
});

test('permite elegir Amz y no genera un enlace de rastreo', async () => {
  render(<ModalTracking producto={{ id: 7 }} onClose={jest.fn()} onSaved={jest.fn()} />);

  expect(await screen.findByRole('heading', { name: 'Tracking de Producto #7' })).toBeInTheDocument();
  const trackingInput = screen.getByRole('textbox');
  const carrierSelect = screen.getByRole('combobox', { name: 'Transportista' });

  fireEvent.change(trackingInput, { target: { value: 'TBA123456789' } });
  fireEvent.change(carrierSelect, { target: { value: 'Amz' } });

  expect(carrierSelect).toHaveValue('Amz');
  expect(screen.queryByRole('link', { name: 'Ver Tracking (Transportista)' })).not.toBeInTheDocument();
});
