import { filterProductsByCodeOrTracking, getRecojoPackageShippingCost } from './Productos';

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

test('suma el envío prorrateado una sola vez por producto del paquete', () => {
  const product = { id: 1, valor: { costoEnvio: 100, costoEnvioProrrateado: 35.25 } };
  const pkg = {
    productos: [
      product,
      product,
      { id: 2, valor: { costoEnvio: 80, costoEnvioProrrateado: 24.75 } },
    ],
  };

  expect(getRecojoPackageShippingCost(pkg)).toBe(60);
});
