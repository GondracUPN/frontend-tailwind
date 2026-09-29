import { calculateShippingWeight, describeAppleModelMatch, lookupAppleModel } from './appleModelLookup';

test('reconoce un MacBook por código de pedido completo con sufijo regional', () => {
  const match = lookupAppleModel('Apple Laptop MHFC4LL/A');
  expect(match).toMatchObject({
    tipo: 'macbook',
    gama: 'Neo',
    procesador: 'A18 Pro',
    tamano: '13',
    ram: '8',
    almacenamiento: '512',
    identifier: 'MHFC4',
    pesoProductoKg: 1.23,
    pesoEnvioKg: 3,
  });
  expect(describeAppleModelMatch(match)).toBe('MacBook Neo A18 Pro 13″');
});

test('reconoce modelos por número A aunque el título no diga el producto', () => {
  expect(lookupAppleModel('Equipo Apple A3404')).toMatchObject({
    tipo: 'macbook', gama: 'Neo', procesador: 'A18 Pro', tamano: '13', ram: '8', almacenamiento: '256',
  });
  expect(lookupAppleModel('Apple A3328')).toMatchObject({
    tipo: 'watch', gama: 'SE', generacion: '3', tamano: '44 mm',
  });
});

test('completa la RAM y el almacenamiento mínimos cuando el código no indica configuración', () => {
  expect(lookupAppleModel('MacBook A2337')).toMatchObject({
    tipo: 'macbook', gama: 'Air', procesador: 'M1', ram: '8', almacenamiento: '256',
  });
  expect(lookupAppleModel('Mac mini A3239')).toMatchObject({
    tipo: 'macmini', procesador: 'M4 Pro', ram: '24', almacenamiento: '512',
  });
});

test('redondea el peso hacia arriba y agrega un kilogramo para el envío', () => {
  expect(calculateShippingWeight(2.1)).toBe(4);
  expect(calculateShippingWeight(2)).toBe(3);
  expect(calculateShippingWeight(0.04)).toBe(2);
  expect(lookupAppleModel('MacBook Pro A2780')).toMatchObject({
    pesoProductoKg: 2.15,
    pesoEnvioKg: 4,
  });
});

test('no inventa un modelo para un identificador desconocido', () => {
  expect(lookupAppleModel('Apple A0000')).toBeNull();
});
