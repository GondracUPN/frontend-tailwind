import { isLikelyAppleCatalogTitle, isTargetAppleWatchTitle } from './Ebay';

test.each([
  'APPLE A3001 (P18029800)',
  'APPLE WATCH SE 2ND GEN - A2727 (P18029792)',
  'Apple Watch Series 10 GPS Cellular 42mm',
  'Apple Watch Ultra 2 A2986',
])('reconoce Watch recientes aunque el titulo venga abreviado: %s', (title) => {
  expect(isTargetAppleWatchTitle(title.toLowerCase())).toBe(true);
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});

test.each([
  'Apple A3001 empty box only',
  'Apple Watch Series 10 charging stand dock',
  'Apple Watch Ultra 2 replacement display assembly',
])('sigue excluyendo cajas, accesorios y repuestos: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
});

test.each([
  'Apple MacBook Neo A18 Pro 13-inch',
  'Apple A3404 8GB 256GB',
  'MHFF4LL/A Apple laptop Indigo',
])('mantiene el reconocimiento de MacBook Neo en el navegador: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});
