import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import AccessoryOperations from './AccessoryOperations';
jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), patch: jest.fn() } }));

const reference = { id: 5, modelo: 'Cable 60W', variante: '1m', estado: 'nuevo', originalidad: 'original', activo: true };
const lot = { id: 7, stockInicial: 5, stockActual: 3, valor: { fechaCompra: '2026-10-20' } };
const row = { key: 'ref:5:gonzalo', referenciaId: 5, referencia: reference, codigo: 7, nombre: 'Cable 60W 1m', comprador: 'Gonzalo',
  compatibilidad: 'iPhone 16', estado: 'nuevo', originalidad: 'original', variante: '1m', disponible: 3, enTransito: 2,
  costoProximaUnidad: 10, precioPublicado: 25, precioMinimo: 20, producto: lot, lotes: [lot], ultimaVenta: { fechaVenta: '2026-10-21', precioUnitario: 24 } };
beforeEach(() => { jest.resetAllMocks(); api.get.mockResolvedValue([row]); });

test('busca por compatibilidad y código, filtra y ofrece vender, reponer y lotes', async () => {
  const sell = jest.fn(), replenish = jest.fn(), edit = jest.fn();
  render(<AccessoryOperations onSell={sell} onReplenish={replenish} onEditLot={edit} />);
  expect(await screen.findByText('Cable 60W 1m')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Buscar accesorios'), { target: { value: 'iphone 16' } });
  expect(screen.getByText('Cable 60W 1m')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Buscar accesorios'), { target: { value: 'ACC-7' } });
  fireEvent.change(screen.getByLabelText('Filtrar originalidad'), { target: { value: 'original' } });
  fireEvent.click(screen.getByRole('button', { name: 'Vender' })); expect(sell).toHaveBeenCalledWith(row);
  fireEvent.click(screen.getByRole('button', { name: 'Reponer' })); expect(replenish).toHaveBeenCalledWith(reference);
  fireEvent.click(screen.getByRole('button', { name: 'Ver lotes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar lote' })); expect(edit).toHaveBeenCalledWith(lot, [lot]);
  expect(screen.getByText('S/ 24.00')).toBeVisible();
  expect(screen.queryByText('Reservado')).not.toBeInTheDocument();
});

test('abre historial con los dos grupos y permite editar los precios de la referencia', async () => {
  api.get.mockImplementation(async (path) => path.includes('/similares') ? { coincidenciaExacta: [], mismaFamilia: [] } : [row]);
  api.patch.mockResolvedValue(reference);
  render(<AccessoryOperations onSell={jest.fn()} onReplenish={jest.fn()} onEditLot={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Ver historial' }));
  expect(await screen.findByRole('dialog', { name: 'Historial de referencia' })).toHaveTextContent('Coincidencia exacta');
  fireEvent.click(screen.getByRole('button', { name: 'Cerrar historial' }));
  fireEvent.click(screen.getByRole('button', { name: 'Editar precios / foto' }));
  fireEvent.change(screen.getByLabelText('Precio mayorista'), { target: { value: '18' } });
  fireEvent.change(screen.getByLabelText('Cantidad mínima mayorista'), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar referencia' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/accesorios/referencias/5', expect.objectContaining({ precioMayoristaSoles: 18, cantidadMinimaMayorista: 5 })));
});


test('conserva visibles y buscables los códigos antiguos al compartir referencia',async()=>{api.get.mockResolvedValue([{...row,codigos:[7,99]}]);render(<AccessoryOperations />);expect(await screen.findByText('ACC-7 · ACC-99')).toBeVisible();fireEvent.change(screen.getByLabelText('Buscar accesorios'),{target:{value:'ACC-99'}});expect(screen.getByText('Cable 60W 1m')).toBeVisible();});
