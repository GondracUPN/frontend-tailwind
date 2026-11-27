import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Ebay, { buildPriceChange } from './Ebay';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';
import { __resetSharedState } from '../hooks/useSharedState';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/analytics', () => ({ getAnalyticsSummary: jest.fn() }));

const PAWN_ITEM = {
  itemId: 'v1|123456789012|0',
  itemWebUrl: 'https://www.ebay.com/itm/123456789012',
  seller: 'lambertpawnshop',
  storeName: 'Lambert Pawn',
  title: 'Apple MacBook Air M2 13-inch 8GB 256GB',
  priceUSD: 80,
  currency: 'USD',
};

const storeFeedCalls = () => api.get.mock.calls.map(([path]) => path).filter((path) => path.startsWith('/utils/ebay/store-feed?'));

const mockApi = ({ viewedItems = [] } = {}) => {
  getAnalyticsSummary.mockResolvedValue({ productGroups: [] });
  api.get.mockImplementation(async (path) => {
    if (path === '/utils/ebay/viewed') return { items: viewedItems };
    if (path === '/utils/ebay/pawns') return { stores: [] };
    if (path === '/utils/ebay/blocked-stores') return { sellers: [] };
    if (path.startsWith('/utils/ebay/store-feed?')) return { items: [PAWN_ITEM], total: 1, hasMore: false };
    return {};
  });
  api.post.mockResolvedValue({ ok: true });
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetSharedState();
  localStorage.clear();
});

test('la busqueda por pawns arranca en Mejor oferta y se puede cambiar a Todos', async () => {
  mockApi();
  render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar Por Pawns' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Buscar pawns' }));
  await screen.findByText(PAWN_ITEM.title);
  expect(storeFeedCalls()[0]).toContain('buyingOptions=BEST_OFFER');

  fireEvent.change(screen.getByDisplayValue('Mejor oferta'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar pawns' }));
  await waitFor(() => expect(storeFeedCalls().length).toBeGreaterThan(1));
  expect(storeFeedCalls().at(-1)).toMatch(/buyingOptions=(&|$)/);
});

test('muestra cuanto bajo respecto al primer precio visto y lo conserva al volver a abrirlo', async () => {
  mockApi({
    viewedItems: [{ itemKey: '123456789012', itemUrl: PAWN_ITEM.itemWebUrl, viewedAt: '2026-11-01T10:00:00.000Z', viewedPrice: 100, viewedCurrency: 'USD' }],
  });
  render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar Por Pawns' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Buscar pawns' }));
  const badge = await screen.findByTestId('ebay-price-change');
  expect(badge).toHaveTextContent('Bajó $20.00 · antes $100.00');

  fireEvent.click(screen.getByText(PAWN_ITEM.title));
  expect(api.post).toHaveBeenCalledWith('/utils/ebay/viewed', expect.objectContaining({ price: 80, currency: 'USD' }));
  expect(screen.getByTestId('ebay-price-change')).toHaveTextContent('Bajó $20.00 · antes $100.00');
});

test('al abrir un producto por primera vez guarda su precio como referencia', async () => {
  mockApi();
  render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar Por Pawns' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Buscar pawns' }));
  await screen.findByText(PAWN_ITEM.title);
  expect(screen.queryByTestId('ebay-price-change')).not.toBeInTheDocument();

  fireEvent.click(screen.getByText(PAWN_ITEM.title));
  expect(await screen.findByTestId('ebay-price-change')).toHaveTextContent('Mismo precio que cuando lo viste');
  const saved = JSON.parse(localStorage.getItem('ebay:viewed-prices:v1'));
  expect(saved['123456789012']).toEqual({ price: 80, currency: 'USD' });
});

test('calcula subida, bajada y precio igual', () => {
  expect(buildPriceChange({ price: 100 }, 80)).toEqual({ direction: 'down', before: 100, diff: 20 });
  expect(buildPriceChange({ price: 100 }, 125.5)).toEqual({ direction: 'up', before: 100, diff: 25.5 });
  expect(buildPriceChange({ price: 100 }, 100.004)).toEqual({ direction: 'same', before: 100, diff: 0 });
  expect(buildPriceChange(null, 80)).toBeNull();
  expect(buildPriceChange({ price: 100 }, 0)).toBeNull();
});
