import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalCostos from './ModalCostos';

jest.mock('../api', () => ({
  __esModule: true,
  default: { patch: jest.fn() },
}));

test('permite editar envío base y prorrateado en un producto agrupado', async () => {
  api.patch.mockResolvedValue({ id: 8 });
  render(<ModalCostos
    producto={{
      id: 8,
      envioGrupoId: 'grp-1',
      valor: {
        valorProducto: 100,
        valorDec: 20,
        peso: 2,
        fechaCompra: '2026-08-01T05:00:00.000Z',
        costoEnvio: 90,
        costoEnvioProrrateado: 35,
      },
    }}
    onSaved={jest.fn()}
    onClose={jest.fn()}
  />);

  fireEvent.change(screen.getByLabelText('Costo de envío (S/)'), { target: { value: '100' } });
  fireEvent.change(screen.getByLabelText('Costo de envío prorrateado (S/)'), { target: { value: '42' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/productos/8', expect.objectContaining({
    valor: expect.objectContaining({
      costoEnvio: '100',
      costoEnvioProrrateado: '42',
      fechaCompra: '2026-08-01',
    }),
  })));
});
