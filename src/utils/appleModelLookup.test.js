import { calculateShippingWeight, describeAppleModelMatch } from './appleModelLookup';

test('redondea el peso hacia arriba y agrega un kilogramo para el envío', () => {
  expect(calculateShippingWeight(2.1)).toBe(4);
  expect(calculateShippingWeight(2)).toBe(3);
  expect(calculateShippingWeight(0.04)).toBe(2);
  expect(calculateShippingWeight(null)).toBeNull();
});

test('describe una identificación del catálogo sin inventar configuración', () => {
  expect(describeAppleModelMatch({ tipo: 'macbook', title: 'MacBook Neo (A18 Pro)', tamano: '13', ram: '8', almacenamiento: '512' }))
    .toBe('MacBook Neo (A18 Pro) · 13″ · 8 GB / 512');
  expect(describeAppleModelMatch({ tipo: 'macbook', title: 'MacBook Air (M5)' })).toBe('MacBook Air (M5)');
  expect(describeAppleModelMatch({ tipo: 'watch', title: 'Apple Watch Series 10', tamano: '46 mm', conexion: 'GPS' }))
    .toBe('Apple Watch Series 10 · 46 mm · GPS');
});
