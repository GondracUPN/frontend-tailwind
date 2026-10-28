import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import EveryMacImportAdmin from './EveryMacImportAdmin';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), del: jest.fn() } }));

const URL = 'https://everymac.com/systems/apple/macbook-air/specs/macbook-air-m6-10-core-cpu-10-core-gpu-13-2027-specs.html';
const result = {
  url: URL, ok: true, modelId: 'macbook-air-m6', title: 'MacBook Air (M6)', nuevo: true,
  config: { chip: 'M6', nucleos: '10 CPU / 10 GPU', pantalla: '13', ram: ['16', '24', '32'], almacenamiento: ['512', '1TB', '2TB'] }, warnings: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockImplementation((path) => Promise.resolve(path === '/apple-catalog/pending' ? [{ id: 'macbook-air-m6', title: 'MacBook Air (M6)', released: '2027-03-01' }] : { seed: 168, imported: [] }));
});

test('previsualiza los enlaces y solo entonces permite importarlos a la BD', async () => {
  api.post.mockResolvedValueOnce({ mode: 'preview', results: [result], diff: { added: ['macbook-air-m6'], changed: [] } })
    .mockResolvedValueOnce({ mode: 'import', saved: 1, results: [result], diff: { added: ['macbook-air-m6'], changed: [] } });
  render(<EveryMacImportAdmin />);
  expect(await screen.findByText(/Lanzamientos detectados por AppleDB/)).toBeInTheDocument();

  const importButton = screen.getByRole('button', { name: 'Importar a la base de datos' });
  expect(importButton).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Enlaces de EveryMac'), { target: { value: `${URL}\n${URL}` } });
  fireEvent.click(screen.getByRole('button', { name: 'Previsualizar' }));
  expect(await screen.findByText('MacBook Air (M6)', { selector: 'strong' })).toBeInTheDocument();
  expect(screen.getByText('16 / 24 / 32')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/apple-catalog/everymac/preview', { urls: [URL] });

  fireEvent.click(screen.getByRole('button', { name: 'Importar a la base de datos' }));
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/apple-catalog/everymac/import', { urls: [URL] }));
  expect(await screen.findByText(/Guardadas 1 ficha/)).toBeInTheDocument();
});
