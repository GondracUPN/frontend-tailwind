import { formatProfitProductName } from './productName';

test('resume títulos largos de AirPods en Ganancias', () => {
  expect(formatProfitProductName({
    tipo: 'AirPods',
    detalle: { modelo: 'Apple AirPods Pro 3 auriculares inalámbricos, cancelación activa de ruido, Traducción en vivo' },
  })).toBe('Apple AirPods Pro 3');
});

test('abrevia Apple Watch conservando modelo, tamaño y conexión', () => {
  expect(formatProfitProductName({
    tipo: 'Watch',
    detalle: { gama: 'SE', generacion: '3', tamano: '44 mm', conexion: 'GPS + Cel' },
  })).toBe('A Watch SE 3 44mm GPS+Cel');
});

test('limita descripciones generales al primer nombre corto', () => {
  expect(formatProfitProductName({
    tipo: 'Otros',
    detalle: { descripcionOtro: 'Equipo especial de escritorio con accesorios, caja y manual incluidos' },
  })).toBe('Equipo especial de escritorio con accesorios');
});

test('conserva la edición de AirPods del catálogo', () => {
  expect(formatProfitProductName({ tipo: 'airpods', detalle: { modelo: 'AirPods 4 con ANC' } })).toBe('Apple AirPods 4 con ANC');
  expect(formatProfitProductName({ tipo: 'airpods', detalle: { modelo: 'AirPods 4 sin ANC' } })).toBe('Apple AirPods 4 sin ANC');
  expect(formatProfitProductName({ tipo: 'airpods', detalle: { modelo: 'AirPods 5 con estuche inalámbrico' } })).toBe('Apple AirPods 5 con estuche inalámbrico');
});
