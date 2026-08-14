import { normalizeIncludedAccessories } from './IncludedAccessories';

test('caja es obligatoria y cubos son excluyentes', () => {
  expect(normalizeIncludedAccessories('macbook', ['Cubo original', 'Cubo fake']))
    .toEqual(['Caja', 'Cubo fake']);
});

test('AirPods 4 solo admite eartips además de caja', () => {
  expect(normalizeIncludedAccessories('airpods', ['Cable', 'Case', 'Eartips'], 'AirPods 4 ANC'))
    .toEqual(['Caja', 'Eartips']);
});

test('stock general no recibe accesorios incluidos', () => {
  expect(normalizeIncludedAccessories('accesorios', ['Caja'])).toEqual([]);
});
