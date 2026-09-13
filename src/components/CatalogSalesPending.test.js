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
  fireEvent.click(confirmButtons[0]);
  fireEvent.click(confirmButtons[1]);

  expect(api.post).toHaveBeenCalledTimes(2);
  expect(api.post).toHaveBeenNthCalledWith(1, '/integrations/catalog-sales/1/confirm', { exchangeRate: 3.7, incomeBank: 'bcp' });
  expect(api.post).toHaveBeenNthCalledWith(2, '/integrations/catalog-sales/2/confirm', { exchangeRate: 3.8, incomeBank: 'bcp' });
  expect(screen.getAllByRole('button', { name: 'Procesando...' })).toHaveLength(2);

  first.resolve({});
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Procesando...' })).toHaveLength(1));

  second.resolve({});
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Procesando...' })).not.toBeInTheDocument());
});
