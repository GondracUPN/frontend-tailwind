import { fireEvent, render, screen } from '@testing-library/react';
import SalesProjection from './SalesProjection';

test('compara el valor real hasta hoy y permite ver la proyección del año siguiente', () => {
  render(<SalesProjection
    salesRows={[{ month: '2025-08', ventas: 2, ingresos: 2000, ganancia: 400 }, { month: '2026-01', ventas: 3, ingresos: 3000, ganancia: 600 }]}
    purchases={[{ fechaCompra: '2025-08-01', costoTotal: 1000 }, { fechaCompra: '2026-01-01', costoTotal: 1400 }]}
    asOf={new Date(2026, 9, 9)}
  />);
  expect(screen.getByRole('heading', { name: 'Proyección de 2026' })).toBeInTheDocument();
  expect(screen.getAllByText(/Real hasta hoy/)).toHaveLength(5);
  expect(screen.queryByText(/Cierre estimado/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Supuestos/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Año proyectado'), { target: { value: '2026' } });
  expect(screen.getByRole('heading', { name: 'Proyección de 2027' })).toBeInTheDocument();
  expect(screen.getAllByText('Proyección para 2027')).toHaveLength(5);
  expect(screen.getByRole('row', { name: /Ene 2027/ })).toBeInTheDocument();
});
