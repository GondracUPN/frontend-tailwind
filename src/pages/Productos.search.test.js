import { filterProductsByCodeOrTracking } from './Productos';

const products = [
  { id: 293, tipo: 'macbook', tracking: [{ trackingUsa: '1Z999999' }] },
  { id: 365, tipo: 'macbook', tracking: [{ trackingUsa: '1Z293456' }] },
  { id: 328, tipo: 'watch', tracking: [{ trackingEshop: 'ESH-293-77' }] },
  { id: 500, tipo: 'accesorios', codigoInventario: 77, tracking: [] },
];

test.each(['293', 'MS 293', 'MS-293', 'MS293', 'code 293'])(
  'prioriza la coincidencia exacta del código para %s',
  (query) => {
    expect(filterProductsByCodeOrTracking(products, query).map((product) => product.id)).toEqual([293]);
  },
);

test('usa el código visible de los accesorios', () => {
  expect(filterProductsByCodeOrTracking(products, 'MS 77').map((product) => product.id)).toEqual([500]);
});

test('mantiene la búsqueda parcial por tracking cuando no existe ese código', () => {
  expect(filterProductsByCodeOrTracking(products, '999999').map((product) => product.id)).toEqual([293]);
});
