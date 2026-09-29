import {
  buildProductSearchQueries,
  isLikelyAppleCatalogTitle,
  isTargetAirPodsTitle,
  isTargetAppleWatchTitle,
  isUnwantedCaseOrCarStereoTitle,
  keepItemsOlderThanVisibleTail,
  isApplePartTitle,
  splitProductSearchBatch,
  matchMacbookItem,
} from './Ebay';

test.each([
  '7" Car Stereo For BMW 3-series E46 M3 Apple CarPlay Radio GPS NAVI',
  'New - OtterBox Defender Pro XT MagSafe Apple iPhone 16 Pro Max',
  'New - OtterBox Defender Pro XT MagSafe Apple iPhone 16 Plus Black/Clear',
  'Apple iPhone 16 Pro Max Silicone Case with MagSafe',
])('excluye fundas y equipos de sonido para automovil: %s', (title) => {
  expect(isUnwantedCaseOrCarStereoTitle(title)).toBe(true);
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
});

test('no confunde unos AirPods completos con una funda por incluir Charging Case', () => {
  const title = 'Apple AirPods 4th Generation with Charging Case';
  expect(isUnwantedCaseOrCarStereoTitle(title)).toBe(false);
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});

test.each([
  'APPLE WATCH SE 2ND GEN - A2727 (P18029792)',
  'Apple Watch Series 11 GPS Cellular 42mm A3331',
  'Apple Watch Ultra 2 A2986',
])('reconoce Watch recientes aunque el titulo venga abreviado: %s', (title) => {
  expect(isTargetAppleWatchTitle(title.toLowerCase())).toBe(true);
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});

test.each([
  'Apple Watch Series 10 GPS Cellular 42mm A2997',
  'APPLE A3001 (P18029800)',
])('excluye los Apple Watch normales anteriores a Series 11: %s', (title) => {
  expect(isTargetAppleWatchTitle(title.toLowerCase())).toBe(false);
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
});

test.each([
  'Apple AirPods Pro 3 Wireless Earbuds',
  'Apple AirPods 4th Generation with Charging Case',
  'Apple AirPods 5',
])('incluye AirPods Pro 3 y generaciones 4 o superiores: %s', (title) => {
  expect(isTargetAirPodsTitle(title)).toBe(true);
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});

test.each([
  'Apple AirPods Pro 2',
  'Apple AirPods 3rd Generation',
  'Apple AirTag 4 Pack',
  'Apple USB-C Cable 2m',
  'Apple 20W USB-C Power Adapter Charger',
])('excluye generaciones antiguas y accesorios del catálogo general: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
});

test.each([
  'Apple A3001 empty box only',
  'Apple Watch Series 10 charging stand dock',
  'Apple Watch Ultra 2 replacement display assembly',
  'Harper Veyland MacBook Pro 16-inch M4 Pro & M4 Max User Guide for Adults',
  '2X LCD Double Side Adhesive Strip Sticker Tape Set MacBook Pro A3185 A3112',
  'OEM replacement LCD screen assembly for MacBook Pro A3186',
  'MacBook Air 13.6 Inch Case with Touch ID, M4 A3240 M3 A3113 M2 A2681, Smooth',
  'MacBook Air 13 M4 2025 A3240 A3113 Left & Right Speakers Wi-Fi Antennas OEM',
  'NEW mCover CASE for 13.6 Apple MacBook Air A2681 A3113 A3240 M3 M4',
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

test.each([
  'Apple Macboob Air laptop MGE94LL/A',
  'Apple laptop M6 16GB 512GB',
  'Apple iPhone 13 Mini A2481 128GB Unlocked',
  'Apple iPad Air M6 11-inch',
  'Apple Mac mini M6 Pro',
  'Apple iMac M6 24-inch',
])('acepta equipos elegibles por código o generación futura: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(true);
});

test('reconoce un MacBook Air M4 de 15 pulgadas solo por Model No.', () => {
  expect(matchMacbookItem(
    { title: 'Apple laptop A3241 16GB 512GB excellent condition' },
    { line: 'Air', screen: '15', processor: 'M4', ram: '', storage: '', modelNumber: '', orderNumber: '' },
  )).toBe(true);
  expect(matchMacbookItem(
    { title: 'Apple laptop MW1L3LL/A 16GB 256GB Midnight' },
    { line: 'Air', screen: '15', processor: 'M4', ram: '', storage: '', modelNumber: '', orderNumber: '' },
  )).toBe(true);
});

test('distingue M4 Max de M4 Pro usando los identificadores de EveryMac', () => {
  const form = { line: 'Pro', screen: '16', processor: 'M4 Max', ram: '', storage: '', modelNumber: '', orderNumber: '' };
  expect(matchMacbookItem({ title: 'Apple MacBook A3186 48GB 1TB' }, form)).toBe(true);
  expect(matchMacbookItem({ title: 'Apple MacBook A3403 24GB 512GB' }, form)).toBe(false);
});

test('crea consultas por nombre, Model No. y Apple Order No. para Air M4', () => {
  const queries = buildProductSearchQueries({
    productType: 'macbook',
    macbookForm: { line: 'Air', screen: '', processor: 'M4', ram: '', storage: '', modelNumber: '', orderNumber: '' },
    ipadForm: {},
    iphoneForm: {},
    keyword: '',
  });
  expect(queries).toEqual(expect.arrayContaining([
    'apple macbook Air M4',
    'apple macbook a3240',
    'apple macbook a3241',
    'apple macbook mc6t4',
    'apple macbook mc7a4',
  ]));
});

test.each([
  'Apple MacBook Air 2020 A2179',
  'Apple MacBook Pro 2020 A2251',
  'Apple MacBook Pro A2289',
])('excluye MacBook Intel 2020 aun si el titulo omite la palabra Intel: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
});

test.each([
  'Harper Veyland MacBook Pro 16-inch M4 Pro & M4 Max User Guide for Adults',
  'MacBook Pro M4 Max instruction manual paperback',
  'MacBook Air M3 handbook for beginners',
  '2X LCD Double Side Adhesive Strip Sticker Tape Set MacBook Pro A3185 A3403',
  'OEM replacement LCD display assembly for Apple MacBook Pro M4',
  'MacBook Pro A3186 keyboard repair part only',
])('excluye libros y guias que mencionan equipos Apple: %s', (title) => {
  expect(isLikelyAppleCatalogTitle(title)).toBe(false);
  expect(matchMacbookItem(
    { title },
    { line: '', screen: '', processor: '', ram: '', storage: '', modelNumber: '', orderNumber: '' },
  )).toBe(false);
});

test.each([
  'Macbook Air 13 Trackpad Grey A3113',
  'Macbook Air 13 Type C Port 821-04807 A3113 A3240',
  'For MacBook Air M3 13 Inch A3113 Earphone Jack Audio',
  'For MacBook Air Retina 13.6 M3 A3113 Microphone Flex',
  'Macbook Air M3 13 / 15 A3113 A3114 US English Version Keycaps',
  'Macbook Air 13 A3113 HeadPhone Audio Jack Board',
  'Macbook Air 13 A3113 DC Jack MagSafe Board',
])('clasifica como pieza los componentes publicados como New o Used: %s', (title) => {
  const form = { line: 'Air', screen: '13', processor: 'M3', ram: '', storage: '', modelNumber: '', orderNumber: '' };
  expect(isApplePartTitle(title)).toBe(true);
  expect(matchMacbookItem({ title }, form)).toBe(false);
  expect(matchMacbookItem({ title }, form, { allowParts: true })).toBe(true);
});

test('un MacBook completo no se clasifica como pieza por mencionar el teclado', () => {
  expect(isApplePartTitle('Apple MacBook Air M3 13-inch 16GB 512GB SSD with keyboard')).toBe(false);
});

test('cargar mas solo agrega publicaciones iguales o anteriores a la ultima visible', () => {
  const visible = [
    { itemId: 'a', itemOriginDate: '2026-05-29T12:00:00Z' },
    { itemId: 'b', itemOriginDate: '2026-05-19T12:00:00Z' },
  ];
  const next = [
    { itemId: 'newer', itemOriginDate: '2026-07-10T12:00:00Z' },
    { itemId: 'same', itemOriginDate: '2026-05-19T12:00:00Z' },
    { itemId: 'older', itemOriginDate: '2026-03-13T12:00:00Z' },
  ];
  expect(keepItemsOlderThanVisibleTail(visible, next).map((item) => item.itemId)).toEqual(['same', 'older']);
});

test('cada busqueda muestra 14 productos y reserva el resto para cargar mas', () => {
  const items = Array.from({ length: 20 }, (_, index) => ({ itemId: String(index + 1) }));
  const { batchItems, pendingItems } = splitProductSearchBatch(items);
  expect(batchItems).toHaveLength(14);
  expect(pendingItems).toHaveLength(6);
  expect(pendingItems[0].itemId).toBe('15');
});
