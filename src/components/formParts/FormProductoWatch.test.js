import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../api';
import FormProductoWatch from './FormProductoWatch';
import catalogForms from '../../__fixtures__/appleCatalogForms.json';

jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn() } }));
beforeEach(() => api.get.mockResolvedValue(catalogForms));

function Harness() {
  const [detalle, setDetalle] = useState({});
  return (
    <>
      <FormProductoWatch detalle={detalle} onChange={(field, value) => setDetalle((current) => ({ ...current, [field]: value }))} />
      <output data-testid="detalle">{JSON.stringify(detalle)}</output>
    </>
  );
}

test('Ultra fija automáticamente 49 mm y GPS + Cel', async () => {
  render(<Harness />);
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'Ultra' } });
  fireEvent.change(await screen.findByLabelText('Serie'), { target: { value: 'watch-ultra-3' } });

  await waitFor(() => expect(screen.getByTestId('detalle')).toHaveTextContent('"tamano":"49 mm"'));
  expect(screen.getByTestId('detalle')).toHaveTextContent('"conexion":"GPS + Cel"');
  expect(screen.getByLabelText('Tamaño de caja')).toBeDisabled();
  expect(screen.getByLabelText('Conectividad')).toBeDisabled();
});
