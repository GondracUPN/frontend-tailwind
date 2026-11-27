import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Ebay from './Ebay';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';
import { getBackgroundOps } from '../services/backgroundOps';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/analytics', () => ({ getAnalyticsSummary: jest.fn() }));

test('la búsqueda por producto sigue al salir de la página y el resultado está al volver', async () => {
  getAnalyticsSummary.mockResolvedValue({ productGroups: [] });
  let releaseSearch;
  const searchStarted = new Promise((resolve) => {
    api.get.mockImplementation((path, opts) => {
      if (path === '/utils/ebay/blocked-stores') return Promise.resolve({ sellers: [] });
      if (path.startsWith('/utils/ebay/search?')) {
        resolve();
        return new Promise((done, fail) => {
          opts?.signal?.addEventListener('abort', () => fail(new Error('aborted')));
          releaseSearch = () => done({
            items: [{ itemId: '1', seller: 'shop', title: 'Apple MacBook Air M4 13-inch background result' }],
            total: 1, hasMore: false,
          });
        });
      }
      return Promise.resolve({});
    });
  });
  const view = render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar producto' }));
  await searchStarted;
  expect(getBackgroundOps().find((op) => op.id === 'task-ebay-product')).toEqual(expect.objectContaining({ status: 'running' }));

  // Navegar a otra página desmonta Ebay (móvil o vista liberada): la búsqueda no se aborta.
  view.unmount();
  await act(async () => { releaseSearch(); await new Promise((resolve) => setTimeout(resolve, 0)); });
  expect(getBackgroundOps().find((op) => op.id === 'task-ebay-product')).toEqual(expect.objectContaining({ status: 'success' }));

  const searchCalls = api.get.mock.calls.filter(([path]) => path.startsWith('/utils/ebay/search?')).length;
  render(<Ebay />);
  expect(await screen.findByText('Apple MacBook Air M4 13-inch background result')).toBeInTheDocument();
  expect(api.get.mock.calls.filter(([path]) => path.startsWith('/utils/ebay/search?'))).toHaveLength(searchCalls);
});
