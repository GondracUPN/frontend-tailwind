import { normalizeIncludedAccessories } from './IncludedAccessories';

test('caja es opcional y los cubos son excluyentes', () => {
  expect(normalizeIncludedAccessories('macbook', ['Cubo original', 'Cubo fake']))
    .toEqual(['Cubo fake']);
  expect(normalizeIncludedAccessories('macbook', [])).toEqual([]);
  expect(normalizeIncludedAccessories('macbook', ['Caja'])).toEqual(['Caja']);
});

test('AirPods 4 solo admite eartips además de caja', () => {
  expect(normalizeIncludedAccessories('airpods', ['Cable', 'Case', 'Eartips'], 'AirPods 4 ANC'))
    .toEqual(['Eartips']);
});

test('stock general no recibe accesorios incluidos', () => {
  expect(normalizeIncludedAccessories('accesorios', ['Caja'])).toEqual([]);
});

test('Apple Watch permite cable y correa fake como alternativas excluyentes', () => {
  expect(normalizeIncludedAccessories('watch', ['Cable', 'Cable fake', 'Correa', 'Correa fake']))
    .toEqual(['Cable fake', 'Correa fake']);
});

test('iMac usa caja, cargador y cable fake, teclado y mouse', () => {
  expect(normalizeIncludedAccessories('imac', ['Caja', 'Cargador', 'Cable', 'Teclado', 'Mouse']))
    .toEqual(['Caja', 'Cargador fake', 'Cable fake', 'Teclado', 'Mouse']);
});
