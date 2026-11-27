import { discountAccessoryStock } from './Inventario';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), put: jest.fn(), del: jest.fn() } }));

const lot = (id, stockActual, fusionAccesorioId = null) => ({ producto: { id, tipo: 'accesorios', stockActual, fusionAccesorioId } });
const stocks = (entries) => Object.fromEntries(entries.map((entry) => [entry.producto.id, entry.producto.stockActual]));

test('descuenta al instante del lote inicial y completa con los lotes fusionados', () => {
  const entries = [lot(433, 2, 433), lot(435, 30, 433), lot(422, 4)];
  expect(stocks(discountAccessoryStock(entries, entries[0].producto, 433, 5))).toEqual({ 433: 0, 435: 27, 422: 4 });
});

test('un lote sin fusión solo descuenta de sí mismo', () => {
  const entries = [lot(422, 4), lot(423, 9)];
  expect(stocks(discountAccessoryStock(entries, entries[0].producto, 422, 1))).toEqual({ 422: 3, 423: 9 });
});
