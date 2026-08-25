import { defaultSealedAccessories, normalizeIncludedAccessories } from './IncludedAccessories';

test('caja es opcional y los cubos son excluyentes', () => {
  expect(normalizeIncludedAccessories('macbook', ['Cubo original', 'Cubo fake']))
    .toEqual(['Cubo fake']);
  expect(normalizeIncludedAccessories('macbook', [])).toEqual([]);
  expect(normalizeIncludedAccessories('macbook', ['Caja'])).toEqual(['Caja']);
});

test('AirPods normales solo incluyen caja y los Pro admiten eartips', () => {
  expect(normalizeIncludedAccessories('airpods', ['Cable', 'Case', 'Eartips'], 'AirPods 4 ANC'))
    .toEqual([]);
  expect(normalizeIncludedAccessories('airpods', ['Caja', 'Cable', 'Case', 'Eartips'], 'AirPods Pro 2'))
    .toEqual(['Caja', 'Eartips']);
});

test('stock general no recibe accesorios incluidos', () => {
  expect(normalizeIncludedAccessories('accesorios', ['Caja'])).toEqual([]);
});

test('Apple Watch permite cable y correa fake como alternativas excluyentes', () => {
  expect(normalizeIncludedAccessories('watch', ['Cable', 'Cable fake', 'Correa', 'Correa fake']))
    .toEqual(['Cable fake', 'Correa fake']);
});

test('iMac permite variantes normales y fake de cargador y cable', () => {
  expect(normalizeIncludedAccessories('imac', ['Caja', 'Cargador', 'Cargador fake', 'Cable', 'Cable fake', 'Teclado', 'Mouse']))
    .toEqual(['Caja', 'Cargador fake', 'Cable fake', 'Teclado', 'Mouse']);
  expect(normalizeIncludedAccessories('imac', ['Caja', 'Cargador', 'Cable', 'Teclado', 'Mouse']))
    .toEqual(['Caja', 'Cargador', 'Cable', 'Teclado', 'Mouse']);
});

test('productos nuevos sellados reciben automáticamente sus accesorios normales', () => {
  expect(normalizeIncludedAccessories('macbook', [], '', 'nuevo')).toEqual(['Caja', 'Cubo original', 'Cable original']);
  expect(normalizeIncludedAccessories('ipad', [], '', 'nuevo')).toEqual(['Caja', 'Cubo original', 'Cable original']);
  expect(normalizeIncludedAccessories('watch', [], '', 'nuevo')).toEqual(['Caja', 'Correa', 'Cable']);
  expect(normalizeIncludedAccessories('macmini', [], '', 'nuevo')).toEqual(['Caja', 'Cable de poder original']);
  expect(defaultSealedAccessories('imac')).toEqual(['Caja', 'Cargador', 'Cable', 'Teclado', 'Mouse']);
});

test('AirPods sellados dependen de la familia', () => {
  expect(defaultSealedAccessories('airpods', 'AirPods 4 ANC')).toEqual(['Caja']);
  expect(defaultSealedAccessories('airpods', 'AirPods Pro 2')).toEqual(['Caja', 'Eartips']);
  expect(defaultSealedAccessories('airpods', 'AirPods Max 1')).toEqual(['Caja', 'Cable']);
  expect(defaultSealedAccessories('airpods', 'AirPods Max 2')).toEqual(['Caja', 'Cable']);
});
