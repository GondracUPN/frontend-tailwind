import { fireEvent, render, screen, within } from '@testing-library/react';
import AccessorySalesPanel from './AccessorySalesPanel';

const returnedSale = { id: 7, cantidad: 4, cantidadDevuelta: 1, precioVenta: 600, precioDevuelto: 150, __share: 0.5, fechaVenta: '2026-10-08' };
const groups = [
  { id: 'tag', name: 'AirTag – 2.ª generación', units: 3, sales: [returnedSale] },
  { id: 'pencil', name: 'Apple Pencil USB-C', units: 2, sales: [{ id: 8, cantidad: 2, precioVenta: 300, fechaVenta: '2026-09-03' }] },
];
const props = { seller: 'Gonzalo', period: 'Todos los meses · 2026', groups, totals: { units: 5, revenue: 525, profit: 100, pendingCount: 0 } };

test('busca sin alterar los totales y conserva devoluciones y participación del vendedor', () => {
  render(<AccessorySalesPanel {...props} onEdit={jest.fn()} onResolve={jest.fn()} />);
  const panel = screen.getByRole('region', { name: 'Ventas de accesorios de Gonzalo' });
  expect(within(panel).getByText('S/ 225.00')).toBeInTheDocument();
  expect(within(panel).getByText(/3 unidades · 1 devuelta.*50% compartido/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'generacion' } });
  expect(screen.queryByText('Apple Pencil USB-C')).not.toBeInTheDocument();
  expect(screen.getByText('AirTag – 2.ª generación')).toBeInTheDocument();
  expect(screen.getByText('S/ 225.00')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no existe' } });
  expect(screen.getByText(/No hay accesorios que coincidan/)).toBeInTheDocument();
});

test('edita y devuelve exactamente la venta elegida', () => {
  const onEdit = jest.fn();
  const onResolve = jest.fn();
  render(<AccessorySalesPanel {...props} onEdit={onEdit} onResolve={onResolve} />);
  const tag = screen.getByRole('region', { name: 'AirTag – 2.ª generación' });
  fireEvent.click(within(tag).getByRole('button', { name: 'Editar' }));
  expect(onEdit).toHaveBeenCalledWith(returnedSale);
  fireEvent.click(within(tag).getByRole('button', { name: 'Devolver / corregir' }));
  expect(onResolve).toHaveBeenCalledWith(returnedSale);
});

test('el detalle se mantiene en la página sin abrir un diálogo ni bloquear su desplazamiento', () => {
  const overflow = document.body.style.overflow;
  const { container } = render(<AccessorySalesPanel {...props} onEdit={jest.fn()} onResolve={jest.fn()} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(container).toContainElement(screen.getByRole('region', { name: 'Ventas de accesorios de Gonzalo' }));
  expect(document.body.style.overflow).toBe(overflow);
});
