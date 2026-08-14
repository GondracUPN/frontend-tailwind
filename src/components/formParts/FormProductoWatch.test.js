import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormProductoWatch from './FormProductoWatch';

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
  fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Ultra' } });
  fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: '2' } });

  await waitFor(() => expect(screen.getByTestId('detalle')).toHaveTextContent('"tamano":"49 mm"'));
  expect(screen.getByTestId('detalle')).toHaveTextContent('"conexion":"GPS + Cel"');
  expect(screen.getAllByRole('combobox')[2]).toBeDisabled();
  expect(screen.getAllByRole('combobox')[3]).toBeDisabled();
});
