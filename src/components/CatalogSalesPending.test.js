import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import CatalogSalesPending from './CatalogSalesPending';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

jest.mock('../utils/salesSync', () => ({
  notifySalesChanged: jest.fn(),
}));

const deferred = () => {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
};

test('permite confirmar varias ventas del catálogo simultáneamente', async () => {
  const rows = [
    { id: 1, eventType: 'sale.created', sku: 'SKU-1', amount: 100, exchangeRate: 3.7, soldAt: '2026-09-04', status: 'pending_confirmation' },
    { id: 2, eventType: 'sale.created', sku: 'SKU-2', amount: 200, exchangeRate: 3.8, soldAt: '2026-09-04', status: 'pending_confirmation' },
  ];
  const first = deferred();
  const second = deferred();
  api.get.mockImplementation((path) => path.endsWith('/pending')
    ? Promise.resolve(rows)
    : Promise.resolve({ seller: 'Gonzalo', cards: [{ tipo: 'bcp' }] }));
  api.post
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  jest.spyOn(window, 'confirm').mockReturnValue(true);

  render(<CatalogSalesPending />);

  const confirmButtons = await screen.findAllByRole('button', { name: 'Confirmar venta' });
  expect(screen.queryByLabelText('Tarjeta de crédito para SKU-1')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para SKU-1'), { target: { value: 'card' } });
  fireEvent.change(screen.getByLabelText('Tarjeta de crédito para SKU-1'), { target: { value: '60' } });
  fireEvent.click(screen.getAllByRole('button', { name: '+ Otro medio' })[0]);
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para SKU-1'), { target: { value: 'cash' } });
  fireEvent.change(screen.getByLabelText('Efectivo para SKU-1'), { target: { value: '40' } });
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para SKU-2'), { target: { value: 'debt' } });
  fireEvent.change(screen.getByLabelText('x500 para SKU-2'), { target: { value: '200' } });
  fireEvent.click(confirmButtons[0]);
  fireEvent.click(confirmButtons[1]);

  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(1, '/integrations/catalog-sales/1/confirm', { exchangeRate: 3.7, incomeBank: 'bcp', incomeParts: [{ type: 'card', amount: 60 }, { type: 'cash', amount: 40 }] });
  expect(api.post).toHaveBeenNthCalledWith(2, '/integrations/catalog-sales/2/confirm', { exchangeRate: 3.8, incomeBank: 'bcp', incomeParts: [{ type: 'debt', amount: 200 }] });
  expect(screen.getAllByRole('button', { name: 'Procesando...' })).toHaveLength(2);

  first.resolve({});
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Procesando...' })).toHaveLength(1));

  second.resolve({});
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Procesando...' })).not.toBeInTheDocument());
});

test('guarda el tipo de cambio al escribir, sin botón adicional', async () => {
  api.get.mockImplementation((path) => path.endsWith('/pending')
    ? Promise.resolve([{ id: 3, eventType: 'sale.created', sku: 'MS-3', amount: 5200, exchangeRate: 0, soldAt: '2026-10-02', status: 'pending_confirmation' }])
    : Promise.resolve({ seller: 'Gonzalo', cards: [{ tipo: 'bcp' }] }));
  api.post.mockResolvedValue({});
  render(<CatalogSalesPending />);
  const rate = await screen.findByLabelText('Tipo de cambio para MS-3');
  expect(rate).toHaveValue(3.7);
  expect(screen.queryByRole('button', { name: 'Poner tipo de cambio' })).not.toBeInTheDocument();
  fireEvent.change(rate, { target: { value: '3.8' } });
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integrations/catalog-sales/3/exchange-rate', { exchangeRate: 3.8 }), { timeout: 1500 });
});

test('permite confirmar una venta con cobro directo', async () => {
  api.get.mockImplementation((path) => path.endsWith('/pending')
    ? Promise.resolve([{ id: 4, eventType: 'sale.created', sku: 'MS-4', amount: 900, exchangeRate: 0, soldAt: '2026-10-02', status: 'pending_confirmation' }])
    : Promise.resolve({ seller: 'Gonzalo', cards: [{ tipo: 'bcp' }] }));
  api.post.mockResolvedValue({});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<CatalogSalesPending />);
  await screen.findByLabelText('Agregar forma de cobro para MS-4');
  expect(screen.queryByLabelText('Pago directo para MS-4')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-4'), { target: { value: 'direct' } });
  fireEvent.change(screen.getByLabelText('Pago directo para MS-4'), { target: { value: '900' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integrations/catalog-sales/4/confirm', {
    exchangeRate: 3.7, incomeBank: 'bcp', incomeParts: [{ type: 'direct', amount: 900 }],
  }));
});

test('recalcula ambos medios al editar cualquiera y limita el total de la venta', async () => {
  api.get.mockImplementation((path) => path.endsWith('/pending')
    ? Promise.resolve([{ id: 6, eventType: 'sale.created', sku: 'MS-6', amount: 2000, exchangeRate: 3.7, soldAt: '2026-10-08', status: 'pending_confirmation' }])
    : Promise.resolve({ seller: 'Gonzalo', cards: [{ tipo: 'bcp' }] }));
  api.post.mockResolvedValue({});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<CatalogSalesPending />);
  fireEvent.change(await screen.findByLabelText('Agregar forma de cobro para MS-6'), { target: { value: 'direct' } });
  fireEvent.change(screen.getByLabelText('Pago directo para MS-6'), { target: { value: '1500' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Otro medio' }));
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-6'), { target: { value: 'debt' } });
  expect(screen.getByLabelText('x500 para MS-6')).toHaveValue(500);
  fireEvent.change(screen.getByLabelText('x500 para MS-6'), { target: { value: '800' } });
  expect(screen.getByLabelText('Pago directo para MS-6')).toHaveValue(1200);
  fireEvent.change(screen.getByLabelText('Pago directo para MS-6'), { target: { value: '1300' } });
  expect(screen.getByLabelText('x500 para MS-6')).toHaveValue(700);
  fireEvent.change(screen.getByLabelText('x500 para MS-6'), { target: { value: '2500' } });
  expect(screen.getByLabelText('x500 para MS-6')).toHaveValue(2000);
  expect(screen.getByLabelText('Pago directo para MS-6')).toHaveValue(null);
  fireEvent.change(screen.getByLabelText('Pago directo para MS-6'), { target: { value: '1300' } });
  expect(screen.getByLabelText('x500 para MS-6')).toHaveValue(700);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integrations/catalog-sales/6/confirm', {
    exchangeRate: 3.7, incomeBank: 'bcp', incomeParts: [{ type: 'direct', amount: 1300 }, { type: 'debt', amount: 700 }],
  }));
});

test('permite las cuatro formas de cobro y limpia el importe al quitar una', async () => {
  api.get.mockImplementation((path) => path.endsWith('/pending')
    ? Promise.resolve([{ id: 5, eventType: 'sale.created', sku: 'MS-5', amount: 100, exchangeRate: 3.7, soldAt: '2026-10-02', status: 'pending_confirmation' }])
    : Promise.resolve({ seller: 'Gonzalo', cards: [{ tipo: 'bcp' }] }));
  api.post.mockResolvedValue({});
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<CatalogSalesPending />);
  await screen.findByLabelText('Agregar forma de cobro para MS-5');
  expect(screen.queryByLabelText('Tarjeta de débito receptora para MS-5')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-5'), { target: { value: 'direct' } });
  fireEvent.change(screen.getByLabelText('Pago directo para MS-5'), { target: { value: '40' } });
  expect(screen.getByLabelText('Tarjeta de débito receptora para MS-5')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '+ Otro medio' }));
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-5'), { target: { value: 'card' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Otro medio' }));
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-5'), { target: { value: 'debt' } });
  fireEvent.change(screen.getByLabelText('x500 para MS-5'), { target: { value: '30' } });
  expect(screen.getByLabelText('Tarjeta de crédito para MS-5')).toHaveValue(30);
  fireEvent.click(screen.getByRole('button', { name: '+ Otro medio' }));
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para MS-5'), { target: { value: 'cash' } });
  fireEvent.change(screen.getByLabelText('Efectivo para MS-5'), { target: { value: '20' } });
  expect(screen.queryByRole('button', { name: '+ Otro medio' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Quitar Tarjeta de crédito para MS-5' }));
  expect(screen.queryByLabelText('Tarjeta de crédito para MS-5')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Efectivo para MS-5'), { target: { value: '50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integrations/catalog-sales/5/confirm', {
    exchangeRate: 3.7, incomeBank: 'bcp', incomeParts: [{ type: 'direct', amount: 40 }, { type: 'debt', amount: 10 }, { type: 'cash', amount: 50 }],
  }));
});

test('registra una venta que nunca pasó a catálogo con pago mixto', async () => {
  api.get.mockImplementation((path) => {
    if (path.endsWith('/pending')) return Promise.resolve([]);
    if (path === '/productos') return Promise.resolve([{ id: 7, codigoInventario: 77, nombre: 'iPhone', stockActual: 1, catalogoEnviado: false, vendedor: 'Gonzalo' }]);
    if (path.startsWith('/ventas/ultimas')) return Promise.resolve([]);
    return Promise.resolve({});
  });
  api.post.mockResolvedValue({ id: 99 });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
  render(<CatalogSalesPending />);
  fireEvent.click(await screen.findByRole('button', { name: 'Venta que no pasó a catálogo' }));
  await screen.findByRole('option', { name: /77/ });
  fireEvent.change(screen.getByLabelText('Producto sin catálogo'), { target: { value: '7' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta manual'), { target: { value: '2026-10-07' } });
  fireEvent.change(screen.getByLabelText('Precio de venta manual'), { target: { value: '1000' } });
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para venta manual'), { target: { value: 'direct' } });
  fireEvent.change(screen.getByLabelText('Pago directo para venta manual'), { target: { value: '300' } });
  fireEvent.click(screen.getByRole('button', { name: '+ Otro medio' }));
  fireEvent.change(screen.getByLabelText('Agregar forma de cobro para venta manual'), { target: { value: 'cash' } });
  fireEvent.change(screen.getByLabelText('Efectivo para venta manual'), { target: { value: '700' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar venta' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', expect.objectContaining({
    productoId: 7, precioVenta: 1000, incomeSku: 'MS-77', incomeParts: [{ type: 'direct', amount: 300 }, { type: 'cash', amount: 700 }],
  })));
});
