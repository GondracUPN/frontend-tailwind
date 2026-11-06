import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Ebay, { isBlockedEbaySeller } from './Ebay';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/analytics', () => ({ getAnalyticsSummary: jest.fn() }));

test.each(['shop.one-2-extra', 'my-shop.one-2', 'shop-one-2', 'shop.one-20', 'shopone2'])('no bloquea nombres parecidos: %s', (seller) => {
  expect(isBlockedEbaySeller({ seller }, ['shop.one-2'])).toBe(false);
});

test('compara el vendedor completo y no el título o un nombre de tienda parecido', () => {
  expect(isBlockedEbaySeller({ seller: ' Shop.One-2 ' }, ['shop.one-2'])).toBe(true);
  expect(isBlockedEbaySeller({ seller: 'other', storeName: 'shop.one-2', title: 'shop.one-2' }, ['shop.one-2'])).toBe(false);
  expect(isBlockedEbaySeller({}, ['shop.one-2'])).toBe(false);
});

test('el modal persiste bloqueos, los recupera al entrar y permite desbloquear', async () => {
  let sellers = [];
  getAnalyticsSummary.mockResolvedValue({ productGroups: [] });
  api.get.mockImplementation(async (path) => {
    if (path === '/utils/ebay/blocked-stores') return { sellers };
    if (path.startsWith('/utils/ebay/search?')) return {
      items: [
        { itemId: '1', seller: 'shop.one-2', title: 'Apple MacBook Air M4 13-inch blocked result' },
        { itemId: '2', seller: 'shop.one-20', title: 'Apple MacBook Air M4 13-inch similar result' },
      ], total: 2, hasMore: false,
    };
    return {};
  });
  api.post.mockImplementation(async (path, body) => {
    sellers = body.blocked ? [body.seller.trim().toLowerCase()] : [];
    return { sellers };
  });
  const view = render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar producto' }));
  await screen.findByText('Apple MacBook Air M4 13-inch blocked result');
  await screen.findByText('Apple MacBook Air M4 13-inch similar result');
  fireEvent.click(screen.getByRole('button', { name: 'Bloquear tiendas' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Nombre exacto de la tienda'), { target: { value: 'Shop.One-2' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Bloquear', exact: true }));
  await within(dialog).findByRole('button', { name: 'Desbloquear shop.one-2' });
  expect(screen.queryByText('Apple MacBook Air M4 13-inch blocked result')).not.toBeInTheDocument();
  expect(screen.getByText('Apple MacBook Air M4 13-inch similar result')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith('/utils/ebay/blocked-stores', { seller: 'Shop.One-2', blocked: true });
  view.unmount();
  render(<Ebay />);
  await screen.findByRole('button', { name: 'Bloquear tiendas (1)' });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar producto' }));
  await screen.findByText('Apple MacBook Air M4 13-inch similar result');
  expect(screen.queryByText('Apple MacBook Air M4 13-inch blocked result')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Bloquear tiendas (1)' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Desbloquear shop.one-2' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Desbloquear shop.one-2' })).not.toBeInTheDocument());
});
