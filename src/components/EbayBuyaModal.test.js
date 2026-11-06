import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import EbayBuyaModal from './EbayBuyaModal';
import Ebay from '../pages/Ebay';
import api from '../api';
import { getAnalyticsSummary } from '../services/analytics';

jest.mock('../api', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../services/analytics', () => ({ getAnalyticsSummary: jest.fn() }));

const source = { url: 'https://www.buya.com/Item/Details/Apple/123abc', title: 'Apple MacBook de Buya', inventoryCode: 'MAM026588' };
const store = (seller, title = 'Apple MacBook reciente') => ({ seller, storeName: seller, ebayUrl: `https://www.ebay.com/sch/i.html?_ssn=${seller}`, buyaUrl: 'https://www.buya.com/Shop/test', evidence: 'Enlace a Buya en la publicación de eBay', latestItem: { title, itemWebUrl: 'https://www.ebay.com/itm/123' } });

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue({});
  getAnalyticsSummary.mockResolvedValue({ productGroups: [] });
});

test('el botón Buya abre una función independiente sin iniciar la búsqueda de producto', async () => {
  render(<Ebay />);
  fireEvent.click(screen.getByRole('button', { name: 'Buya', exact: true }));
  expect(screen.getByRole('dialog', { name: 'Buya' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tiendas Buya con Apple' })).toHaveAttribute('aria-pressed', 'true');
  expect(api.get.mock.calls.some(([path]) => path.startsWith('/utils/ebay/search?'))).toBe(false);
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar', exact: true }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});

test('explora tiendas recientes, conserva resultados y avanza sin duplicar vendedores', async () => {
  api.get.mockResolvedValueOnce({ stores: [store('pawn1')], nextOffset: 20, hasMore: true, scanned: 20 })
    .mockResolvedValueOnce({ stores: [store('pawn1', 'Publicación anterior'), store('pawn2')], nextOffset: 40, hasMore: false, scanned: 20 });
  render(<EbayBuyaModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tiendas', exact: true }));
  await screen.findByText('pawn1');
  expect(screen.getByRole('link', { name: 'Ver tienda en eBay' })).toHaveAttribute('href', 'https://www.ebay.com/sch/i.html?_ssn=pawn1');
  fireEvent.click(screen.getByRole('button', { name: 'Seguir buscando tiendas' }));
  await screen.findByText('pawn2');
  expect(api.get).toHaveBeenLastCalledWith('/utils/ebay/buya/stores?offset=20', expect.any(Object));
  expect(screen.getByText('2 tiendas encontradas · 40 publicaciones exploradas')).toBeInTheDocument();
  expect(screen.queryByText('Publicación anterior')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Seguir buscando tiendas' })).not.toBeInTheDocument();
});

test('el enlace busca su código y mantiene el origen al continuar aunque cambie el campo', async () => {
  api.post.mockResolvedValueOnce({ source, items: [{ itemId: '1', title: 'Apple MAM026588', seller: 'pawn1', itemWebUrl: 'https://www.ebay.com/itm/1', matchedIn: 'title' }], scanned: 20, nextOffset: 20, hasMore: true })
    .mockResolvedValueOnce({ source, items: [], scanned: 1, nextOffset: 40, hasMore: false });
  render(<EbayBuyaModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar un producto' }));
  fireEvent.change(screen.getByLabelText('Enlace del producto de Buya'), { target: { value: source.url } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar en eBay', exact: true }));
  await screen.findByText('MAM026588');
  expect(api.post).toHaveBeenCalledWith('/utils/ebay/buya/product', { url: source.url, offset: 0 }, expect.any(Object));
  expect(screen.getByRole('link', { name: 'Ver producto en eBay' })).toHaveAttribute('href', 'https://www.ebay.com/itm/1');
  fireEvent.change(screen.getByLabelText('Enlace del producto de Buya'), { target: { value: 'https://www.buya.com/Item/Details/Other/999' } });
  fireEvent.click(screen.getByRole('button', { name: 'Seguir buscando el código' }));
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/utils/ebay/buya/product', { url: source.url, offset: 20 }, expect.any(Object)));
  expect(screen.getByText('Apple MAM026588')).toBeInTheDocument();
});

test('continúa en la búsqueda ampliada y muestra avances aunque no aparezcan tiendas nuevas', async () => {
  api.get.mockResolvedValueOnce({ stores: [store('pawn1')], nextOffset: 20, phase: 'buya', nextPhase: 'buya', hasMore: true, scanned: 20 })
    .mockResolvedValueOnce({ stores: [], nextOffset: 0, phase: 'buya', nextPhase: 'recent', hasMore: true, scanned: 1 })
    .mockResolvedValueOnce({ stores: [store('pawn2')], nextOffset: 20, phase: 'recent', nextPhase: 'recent', hasMore: true, scanned: 20 });
  render(<EbayBuyaModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tiendas', exact: true }));
  await screen.findByText('pawn1');
  fireEvent.click(screen.getByRole('button', { name: 'Seguir buscando tiendas' }));
  await screen.findByText(/Este bloque no añadió tiendas nuevas/);
  expect(screen.getByText('1 tiendas encontradas · 21 publicaciones exploradas')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Seguir buscando tiendas' }));
  await screen.findByText('pawn2');
  expect(api.get).toHaveBeenLastCalledWith('/utils/ebay/buya/stores?offset=0&phase=recent', expect.any(Object));
  expect(screen.getByText('2 tiendas encontradas · 41 publicaciones exploradas')).toBeInTheDocument();
  expect(screen.getByText(/Búsqueda ampliada/)).toBeInTheDocument();
});

test('permite reintentar comprobaciones parciales sin duplicar el bloque explorado', async () => {
  api.get.mockResolvedValueOnce({ stores: [], scanned: 20, offset: 0, nextOffset: 20, hasMore: true, failedChecks: 2 })
    .mockResolvedValueOnce({ stores: [store('recovered')], scanned: 20, offset: 0, nextOffset: 20, hasMore: true, failedChecks: 0 });
  render(<EbayBuyaModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tiendas', exact: true }));
  fireEvent.click(await screen.findByRole('button', { name: 'Reintentar bloque' }));
  await screen.findByText('recovered');
  expect(screen.getByText('1 tiendas encontradas · 20 publicaciones exploradas')).toBeInTheDocument();
  expect(api.get).toHaveBeenLastCalledWith('/utils/ebay/buya/stores?offset=0', expect.any(Object));
});

test('muestra errores de conexión sin afirmar que no hay coincidencias', async () => {
  api.get.mockRejectedValueOnce(new Error('eBay no disponible'));
  render(<EbayBuyaModal onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tiendas', exact: true }));
  expect(await screen.findByRole('alert')).toHaveTextContent('eBay no disponible');
  expect(screen.queryByText(/No se encontraron referencias/)).not.toBeInTheDocument();
});

test('cerrar cancela la petición, restaura el scroll y permite Escape', async () => {
  const onClose = jest.fn();
  api.get.mockReturnValue(new Promise(() => {}));
  const { unmount } = render(<EbayBuyaModal onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar tiendas', exact: true }));
  const signal = api.get.mock.calls[0][1].signal;
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(onClose).toHaveBeenCalledTimes(1);
  unmount();
  expect(signal.aborted).toBe(true);
  expect(document.body.style.overflow).toBe('');
});
