import {
  canPayEshopexPickup,
  filterProductsByCodeOrTracking,
  getRecojoPackageShippingCost,
  isEshopexAtBranch,
  isLegacySimpleAccessory,
  onlyProducts,
} from './Productos';

const products = [
  { id: 293, tipo: 'macbook', tracking: [{ trackingUsa: '1Z999999' }] },
  { id: 365, tipo: 'macbook', tracking: [{ trackingUsa: '1Z293456' }] },
  { id: 328, tipo: 'watch', tracking: [{ trackingEshop: 'ESH-293-77' }] },
  { id: 500, tipo: 'accesorios', codigoInventario: 77, tracking: [] },
];

test('oculta los accesorios simples en Productos aunque vengan del cache o de la API', () => {
  expect(onlyProducts([
    { id: 1, tipo: 'accesorios', soloInventario: true },
    { id: 2, tipo: 'accesorios', soloInventario: false },
    { id: 3, tipo: 'iphone' },
  ]).map((product) => product.id)).toEqual([2, 3]);
});

test('reconoce compras simples antiguas sin marcar y conserva accesorios normales', () => {
  const legacy = {
    id: 464, tipo: 'accesorios', vendedor: null,
    valor: { valorDec: '0.00', peso: '0.00' },
    tracking: [{ estado: 'comprado_sin_tracking', trackingUsa: null, trackingEshop: null, casillero: null }],
  };
  const regular = { ...legacy, id: 465, vendedor: 'Gonzalo' };
  expect(isLegacySimpleAccessory(legacy)).toBe(true);
  expect(onlyProducts([legacy, regular]).map((product) => product.id)).toEqual([465]);
});

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

test.each(['EN SUCURSAL', 'En   Sucursal - listo para recoger'])(
  'reconoce %s como disponible en sucursal',
  (status) => expect(isEshopexAtBranch(status)).toBe(true),
);

test('permite pagar con el estado guardado aunque la carga temporal no tenga el paquete', () => {
  expect(canPayEshopexPickup({
    status: 'EN SUCURSAL',
    account: 'casillero@example.com',
  })).toBe(true);
});

test('no permite pagar sin una cuenta asociada al casillero', () => {
  expect(canPayEshopexPickup({ status: 'EN SUCURSAL', account: '' })).toBe(false);
});
