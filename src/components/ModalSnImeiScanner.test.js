import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalSnImeiScanner from './ModalSnImeiScanner';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

test('acepta un SN manual de diez letras', async () => {
  api.get.mockResolvedValue({ items: [], total: 0 });
  render(<ModalSnImeiScanner onClose={jest.fn()} />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/sickw/history?limit=150'));

  fireEvent.change(screen.getByLabelText('SN o IMEI manual'), {
    target: { value: 'GXQTQJCTWH' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Usar' }));

  expect(screen.getByRole('button', { name: /SN manual GXQTQJCTWH/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Consultar Apple Basic Info' })).toBeEnabled();
  expect(screen.queryByText('Ingresa un SN o IMEI valido.')).not.toBeInTheDocument();
});
