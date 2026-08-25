import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalVenta from './ModalVenta';

jest.mock('../api', () => ({
  __esModule: true,
  default: { post: jest.fn(), get: jest.fn(), patch: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

test('confirma la venta si se pierde la respuesta del guardado', async () => {
  const saved = {
    id: 15,
    productoId: 7,
    fechaVenta: '2026-07-20',
    precioVenta: 1500,
  };
  api.post.mockRejectedValueOnce(new Error('network error'));
  api.get.mockResolvedValueOnce([saved]);
  const onSaved = jest.fn();
  const onClose = jest.fn();

  render(
    <ModalVenta
      producto={{ id: 7, vendedor: 'Gonzalo', valor: { valorProducto: 300 } }}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );

  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.75' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-20' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/producto/7'));
  expect(onSaved).toHaveBeenCalledWith(saved);
  expect(onClose).toHaveBeenCalled();
});

test('sincroniza fecha y monto del ingreso cuando se edita la venta', async () => {
  localStorage.setItem('user', JSON.stringify({ id: 1, username: 'gonzalo', role: 'admin' }));
  localStorage.setItem('token', 'gastos-token');
  const venta = {
    id: 15,
    productoId: 7,
    vendedor: 'gonzalo',
    tipoCambio: 3.75,
    fechaVenta: '2026-07-20',
    precioVenta: 1500,
    ganancia: 300,
    porcentajeGanancia: 25,
  };
  const updated = { ...venta, fechaVenta: '2026-07-21', precioVenta: 1550 };
  api.patch
    .mockResolvedValueOnce(updated)
    .mockResolvedValueOnce({ id: 88, fecha: '2026-07-21', monto: 1550 });
  api.get
    .mockResolvedValueOnce([{ id: 1, username: 'gonzalo', role: 'admin' }])
    .mockResolvedValueOnce([{
      id: 88,
      concepto: 'ingreso',
      metodoPago: 'debito',
      moneda: 'PEN',
      monto: 1500,
      fecha: '2026-07-20',
      tarjeta: 'bcp',
      notas: '7',
    }]);

  render(
    <ModalVenta
      producto={{ id: 7, vendedor: 'Gonzalo', valor: { valorProducto: 300, costoEnvio: 0 } }}
      venta={venta}
      onSaved={jest.fn()}
      onClose={jest.fn()}
    />,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-21' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1550' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/gastos/88', expect.objectContaining({
    monto: 1550,
    fecha: '2026-07-21',
    notas: '__SALE_INCOME__:7',
  })));
});

test('guarda la venta sin exigir una sesión de Gastos en el navegador', async () => {
  const saved = {
    id: 283,
    productoId: 321,
    vendedor: 'Gonzalo',
    fechaVenta: '2026-07-28',
    precioVenta: 3000,
  };
  api.post.mockResolvedValueOnce(saved);
  const onSaved = jest.fn();

  render(
    <ModalVenta
      producto={{ id: 321, vendedor: 'Gonzalo', valor: { valorProducto: 300 } }}
      onSaved={onSaved}
      onClose={jest.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.75' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-28' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '3000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
  expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    productoId: 321,
    precioVenta: 3000,
    incomeBank: 'bcp',
  }));
  expect(api.patch).not.toHaveBeenCalled();
});

test('prioriza Gonzalo con cliente del producto sobre el vendedor genérico de una venta antigua', async () => {
  const venta = {
    id: 18,
    productoId: 44,
    vendedor: 'Gonzalo',
    tipoCambio: 3.7,
    fechaVenta: '2026-08-20',
    precioVenta: 1800,
    ganancia: 250,
    porcentajeGanancia: 16,
  };

  render(
    <ModalVenta
      producto={{ id: 44, vendedor: 'Gonzalo (Jorge)', valor: { valorProducto: 350 } }}
      venta={venta}
      onSaved={jest.fn()}
      onClose={jest.fn()}
    />,
  );

  await waitFor(() => expect(screen.getAllByText('Gonzalo (Jorge)').length).toBeGreaterThan(0));
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
  expect(screen.getByLabelText('Vendedor')).toHaveValue('Gonzalo (Jorge)');
});

test('sincroniza Gonzalo con cliente hacia la venta y el producto', async () => {
  const saved = { id: 30, productoId: 45, vendedor: 'Gonzalo (Jorge)', tipoCambio: 3.7, fechaVenta: '2026-08-21', precioVenta: 1900 };
  api.post.mockResolvedValueOnce(saved);
  api.patch.mockResolvedValueOnce({ id: 45, vendedor: 'Gonzalo (Jorge)', valor: { valorProducto: 360 } });

  render(
    <ModalVenta
      producto={{ id: 45, vendedor: 'Gonzalo', valor: { valorProducto: 360 } }}
      onSaved={jest.fn()}
      onClose={jest.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText('Vendedor'), { target: { value: 'Gonzalo (Jorge)' } });
  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.7' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-08-21' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1900' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({ vendedor: 'Gonzalo (Jorge)' })));
  expect(api.patch).toHaveBeenCalledWith('/productos/45', { vendedor: 'Gonzalo (Jorge)' });
});

test('para accesorios recibe el precio total, calcula el unitario y muestra el resumen', async () => {
  api.get.mockResolvedValueOnce({ unidadesVendidas: 4, unidadesDisponibles: 15, ventaBruta: 240, costoVendido: 100, gananciaNeta: 140, tipoCambioPromedio: 3.72, ventas: [] });
  api.post.mockResolvedValueOnce({ id: 90, precioVenta: 150, cantidad: 3 });
  render(
    <ModalVenta
      producto={{ id: 399, tipo: 'accesorios', stockActual: 15, vendedor: 'Gonzalo', valor: { valorProducto: 20 } }}
      onSaved={jest.fn()}
      onClose={jest.fn()}
    />,
  );

  expect(screen.queryByText('Tipo de venta')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Precio total de venta (S/)')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText('Resumen de ventas del accesorio')).toHaveTextContent('Ingreso por ventas'));
  expect(screen.getByLabelText('Resumen de ventas del accesorio')).toHaveTextContent('S/ 240.00');
  expect(screen.queryByText('Ganancia neta')).not.toBeInTheDocument();
  expect(screen.queryByText('Costo vendido')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Cantidad'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Precio total de venta (S/)'), { target: { value: '150' } });

  expect(screen.getByText('S/ 50.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.75' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-08-14' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    cantidad: 3,
    precioVenta: 150,
    tipoCambio: 3.75,
  })));
});
