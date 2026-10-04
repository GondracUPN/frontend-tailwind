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
  fireEvent.change(screen.getByLabelText('Forma de cobro para SKU-1'), { target: { value: 'card' } });
  fireEvent.change(screen.getByLabelText('Forma de cobro para SKU-2'), { target: { value: 'debt' } });
  expect(screen.getAllByText(/Ingreso inicial: S\/ 0.00/)).toHaveLength(2);
  fireEvent.click(confirmButtons[0]);
  fireEvent.click(confirmButtons[1]);

  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(1, '/integrations/catalog-sales/1/confirm', { exchangeRate: 3.7, incomeBank: 'bcp', paymentType: 'card' });
  expect(api.post).toHaveBeenNthCalledWith(2, '/integrations/catalog-sales/2/confirm', { exchangeRate: 3.8, incomeBank: 'bcp', paymentType: 'debt' });
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
  await screen.findByLabelText('Forma de cobro para MS-4');
  fireEvent.change(screen.getByLabelText('Forma de cobro para MS-4'), { target: { value: 'direct' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar venta' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/integrations/catalog-sales/4/confirm', {
    exchangeRate: 3.7, incomeBank: 'bcp', paymentType: 'direct',
  }));
});
