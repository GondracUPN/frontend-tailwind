import { formatAppleWatchName, formatAppleWatchModel } from './productName';

test.each([
  [{ gama: 'SE', generacion: '3', tamano: '44 mm' }, 'Apple Watch SE 3 44 mm'],
  [{ gama: 'Ultra', generacion: '2', tamano: '49' }, 'Apple Watch Ultra 2 49 mm'],
  [{ gama: 'Series', generacion: '11', tamano: '46 mm' }, 'Apple Watch Series 11 46 mm'],
  [{ gama: 'Series', generacion: 'Series 10', tamano: '46 mm' }, 'Apple Watch Series 10 46 mm'],
  [{ generacion: '10', tamano: '46', conexion: 'GPS' }, 'Apple Watch Series 10 46 mm GPS'],
  [{ gama: 'Ultra 2', generacion: '2', tamano: '49 mm' }, 'Apple Watch Ultra 2 49 mm'],
])('formatea el nombre completo de Apple Watch', (detalle, expected) => {
  expect(formatAppleWatchName(detalle)).toBe(expected);
});

test('devuelve el modelo completo para agrupar el analisis', () => {
  expect(formatAppleWatchModel({ gama: 'SE', generacion: '2' })).toBe('SE 2');
});
