import { act, fireEvent, render as renderComponent, screen, waitFor, within } from '@testing-library/react';
import api from '../api';
import AccessoryCatalogPanel from './AccessoryCatalogPanel';
jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn() } }));
const row = { key: 'ref-5-owner', nombre: 'Cable USB-C', comprador: 'Gonzalo', disponible: 6, codigos: [10, 11],
  referenciaId: 5, productoId: 10, seleccionado: false, enviado: false, faltantes: [] };
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue([row]); });
const render = (component) => {
  const view = renderComponent(component);
  fireEvent.click(screen.getByRole('button', { name: /^Pendientes de enviar/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Enviados al catálogo/ }));
  return view;
};
test('publica varios, muestra estado persistido, filtra y retira', async () => {
  api.get.mockResolvedValue([row, { ...row, key: 'ref-6-owner', nombre: 'Cargador' }]);
  api.post.mockResolvedValue([{ ...row, seleccionado: true, enviado: true }]);
  const view = render(<AccessoryCatalogPanel />);
  fireEvent.click(await screen.findByLabelText('Seleccionar Cable USB-C · ACC-10 · ACC-11'));
  fireEvent.click(screen.getByLabelText('Seleccionar Cargador · ACC-10 · ACC-11'));
  fireEvent.click(screen.getByRole('button', { name: 'Enviar seleccionados (2)' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/accesorios/catalogo/seleccion', { keys: ['ref-5-owner', 'ref-6-owner'], seleccionado: true }));
  expect(await screen.findByText('Enviado a preparación')).toBeVisible();
  view.unmount(); api.get.mockResolvedValue([{ ...row, seleccionado: true, enviado: true }]);
  render(<AccessoryCatalogPanel />); expect(await screen.findByText('Enviado a preparación')).toBeVisible();
  expect(within(screen.getByRole('region', { name: 'Pendientes de enviar' })).queryByText('Cable USB-C')).not.toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Enviados al catálogo' })).getByText('Cable USB-C')).toBeVisible();
  api.post.mockResolvedValue([row]); fireEvent.click(screen.getByRole('button', { name: 'Retirar del catálogo' }));
  await screen.findByText('Accesorios retirados del catálogo.');
  expect(await screen.findByText('No enviado')).toBeVisible();
});

test('separa enviados y pendientes sin mostrar compradores y bloquea accesorios con stock cero', async () => {
  api.get.mockResolvedValue([
    { ...row, nombre: 'Apple Pencil Pro', disponible: 0, codigos: [438] },
    { ...row, key: 'sent', nombre: 'Cable enviado', seleccionado: true, enviado: true },
    { ...row, key: 'queued', nombre: 'Cargador pendiente', seleccionado: true, enviado: false, error: 'Catálogo HTTP 503.' },
  ]);
  render(<AccessoryCatalogPanel />);
  await screen.findByText('Apple Pencil Pro');
  const pending = screen.getByRole('region', { name: 'Pendientes de enviar' });
  const sent = screen.getByRole('region', { name: 'Enviados al catálogo' });
  expect(within(pending).getByText('Cargador pendiente')).toBeVisible();
  expect(within(sent).getByText('Cable enviado')).toBeVisible();
  expect(within(sent).queryByText('Apple Pencil Pro')).not.toBeInTheDocument();
  expect(screen.queryByText('Gonzalo')).not.toBeInTheDocument();
  expect(screen.queryByRole('columnheader', { name: 'Comprador' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('Seleccionar Apple Pencil Pro · ACC-438')).toBeDisabled();
  expect(within(pending).getByRole('button', { name: 'Enviar al catálogo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Enviar seleccionados (0)' })).toBeDisabled();
  expect(screen.getByText('Sin stock')).toBeVisible();
  expect(api.post).not.toHaveBeenCalled();
});

test('si el stock baja después de marcarlo, no permite el envío múltiple y aún permite retirar agotados', async () => {
  jest.useFakeTimers();
  try {
    render(<AccessoryCatalogPanel />);
    fireEvent.click(await screen.findByLabelText('Seleccionar Cable USB-C · ACC-10 · ACC-11'));
    expect(screen.getByRole('button', { name: 'Enviar seleccionados (1)' })).toBeEnabled();
    api.get.mockResolvedValue([{ ...row, disponible: 0 }]);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByRole('button', { name: 'Enviar seleccionados (0)' })).toBeDisabled();
    api.get.mockResolvedValue([{ ...row, disponible: 0, seleccionado: true, enviado: true }]);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByRole('button', { name: 'Retirar del catálogo' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Retirar seleccionados' })).toBeEnabled();
  } finally { jest.useRealTimers(); }
});
test('explica faltantes, completa la referencia y muestra errores de envío', async () => {
  api.get.mockImplementation(async (path) => path.endsWith('/5') ? { id: 5, modelo: 'Cable USB-C' } : [{ ...row, faltantes: ['precio publicado mayor que cero'] }]);
  render(<AccessoryCatalogPanel />);
  expect(await screen.findByText(/Falta: precio publicado/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Enviar al catálogo' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  expect(await screen.findByRole('dialog', { name: 'Editar referencia' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Precio publicado'), { target: { value: '30' } });
  api.post.mockResolvedValue([{ ...row, seleccionado: true, error: 'Catálogo HTTP 503.' }]);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar referencia' }));
  expect(await screen.findByText('Catálogo HTTP 503.')).toBeVisible();
  expect(api.patch).toHaveBeenCalledWith('/accesorios/referencias/5', expect.objectContaining({ precioPublicadoSoles: 30 }));
});
test('completa accesorios antiguos usando la ficha de inventario existente', async () => {
  api.get.mockResolvedValue([{ ...row, referenciaId: null }]); const edit = jest.fn();
  render(<AccessoryCatalogPanel onEdit={edit} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  expect(edit).toHaveBeenCalledWith(10);
});

test('refresca el retiro recibido del catálogo sin recargar Servicios', async () => {
  jest.useFakeTimers();
  try {
    api.get.mockResolvedValue([{ ...row, seleccionado: true, enviado: true }]);
    render(<AccessoryCatalogPanel />);
    expect(await screen.findByText('Enviado a preparación')).toBeVisible();
    api.get.mockResolvedValue([{ ...row, seleccionado: false, enviado: false }]);
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(await screen.findByText('No enviado')).toBeVisible();
    expect(api.post).not.toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});
