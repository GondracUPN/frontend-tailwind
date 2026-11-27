import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalProducto from './ModalProducto';
import { fetchAppleCatalog } from '../services/appleCatalog';
import BackgroundOpsTray from './BackgroundOpsTray';
import DetachedModalsHost from './DetachedModalsHost';
import { __resetBackgroundOps } from '../services/backgroundOps';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() } }));
jest.mock('../services/appleCatalog', () => ({
  ...jest.requireActual('../services/appleCatalog'),
  fetchAppleCatalog: jest.fn(),
}));
const catalog = { families: {}, models: [{
    tipo: 'macbook', detalle: { gama: 'Air', procesador: 'M3' },
    selectors: [
      { field: 'tamano', status: 'confirmed', options: [{ value: '13' }, { value: '15' }] },
      { field: 'ram', status: 'confirmed', options: [{ value: '24' }, { value: '8' }, { value: '16' }] },
      { field: 'almacenamiento', status: 'confirmed', options: [{ value: '1TB' }, { value: '256' }, { value: '512' }] },
    ],
    macCombos: [{ ram: ['8', '16', '24'], almacenamiento: ['256', '512', '1TB'] }],
  }] };
jest.mock('./formParts/FormProductoMacbook', () => ({ detalle }) => (
  <div><output data-testid="ram">{detalle.ram}</output><output data-testid="ssd">{detalle.almacenamiento}</output></div>
));

beforeEach(() => {
  __resetBackgroundOps();
  jest.clearAllMocks();
  localStorage.clear();
  fetchAppleCatalog.mockResolvedValue(catalog);
  api.post.mockResolvedValue({ id: 500, tipo: 'macbook' });
});

async function importTitle(title, titleParsed = {}) {
  api.get.mockImplementation(async (path) => {
    if (path.startsWith('/utils/ebay?')) return { title, titleParsed, priceUSD: 649.99, condition: 'used' };
    if (path.startsWith('/apple-catalog/identify?')) return {
      status: 'exact', candidates: [{ tipo: 'macbook', detalle: { gama: 'Air', procesador: 'M3', tamano: '13' }, token: 'A3113' }],
    };
    return [];
  });
  render(<ModalProducto onSaved={jest.fn()} onClose={jest.fn()} />);
  fireEvent.change(screen.getByPlaceholderText('https://www.ebay.com/itm/...'), { target: { value: 'https://www.ebay.com/itm/147655691856' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
  await waitFor(() => expect(screen.getByTestId('ssd')).not.toBeEmptyDOMElement());
}

test('el título de la captura importa 256GB SSD y usa la RAM base del catálogo', async () => {
  await importTitle('APPLE MACBOOK AIR - A3113 M3 AND 256GB SSD. (B08021746)', { ssd: '256 GB' });
  expect(screen.getByTestId('ram')).toHaveTextContent('8');
  expect(screen.getByTestId('ssd')).toHaveTextContent('256');
  fireEvent.submit(screen.getByRole('button', { name: 'Guardar', exact: true }).closest('form'));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/productos', expect.objectContaining({ detalle: expect.objectContaining({ ram: '8', almacenamiento: '256' }) })));
});

test('valores importados inexistentes se reemplazan por la configuración base', async () => {
  await importTitle('MacBook Air M3 256GB RAM 8TB SSD', { ram: '256 GB', ssd: '8 TB' });
  expect(screen.getByTestId('ram')).toHaveTextContent('8');
  expect(screen.getByTestId('ssd')).toHaveTextContent('256');
});

test.each([
  ['MacBook Air M3 16GB RAM 256GB SSD', '16', '256'],
  ['MacBook Air M3 RAM 24GB 512GB SSD', '24', '512'],
  ['MacBook Air M3 16GB/1TB', '16', '1TB'],
  ['MacBook Air M3 16GB RAM 512GB', '16', '512'],
])('distingue RAM y SSD en %s', async (title, ram, ssd) => {
  await importTitle(title);
  expect(screen.getByTestId('ram')).toHaveTextContent(ram);
  expect(screen.getByTestId('ssd')).toHaveTextContent(ssd);
});

test('cierra al enviar; si el servidor rechaza, la bandeja muestra el motivo y Editar reabre el formulario con los datos', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const onClose = jest.fn();
    api.get.mockImplementation(async (path) => {
      if (path.startsWith('/utils/ebay?')) return { title: 'MacBook Air M3 256GB SSD', titleParsed: {}, priceUSD: 649.99, condition: 'used' };
      if (path.startsWith('/apple-catalog/identify?')) return {
        status: 'exact', candidates: [{ tipo: 'macbook', detalle: { gama: 'Air', procesador: 'M3', tamano: '13' }, token: 'A3113' }],
      };
      return [];
    });
    render(<><ModalProducto onSaved={jest.fn()} onClose={onClose} /><DetachedModalsHost /><BackgroundOpsTray /></>);
    fireEvent.change(screen.getByPlaceholderText('https://www.ebay.com/itm/...'), { target: { value: 'https://www.ebay.com/itm/147655691856' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
    await waitFor(() => expect(screen.getByTestId('ssd')).not.toBeEmptyDOMElement());
    api.post.mockRejectedValue(Object.assign(new Error('HTTP 400 - MacBook Air (M3): ram "256" — valor no permitido'), { status: 400 }));
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar', exact: true }).closest('form'));
    // El modal no espera al servidor.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    await screen.findByText('MacBook Air (M3): ram "256" — valor no permitido');
    // Sin respuesta dudosa: no se avisa de posible duplicado.
    expect(screen.queryByText(/puede que sí se haya guardado/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    // El formulario reabierto conserva lo importado.
    const ssd = await screen.findAllByTestId('ssd');
    expect(ssd[ssd.length - 1]).toHaveTextContent('256');
    expect(screen.getAllByRole('button', { name: 'Guardar', exact: true }).pop()).toBeEnabled();
    expect(screen.queryByText('MacBook Air (M3): ram "256" — valor no permitido')).not.toBeInTheDocument();
  } finally {
    log.mockRestore();
  }
});
