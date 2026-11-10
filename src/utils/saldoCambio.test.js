import { cambioSaldoAplicado, cambioVentaConSaldo } from './saldoCambio';
const saldos = [
  {
    id: 1,
    sku: 476,
    fecha: '2026-11-01',
    disponible: '1000.00',
    tipo_cambio: '3.4000',
  },
  {
    id: 2,
    sku: 490,
    fecha: '2026-11-02',
    disponible: '1000.00',
    tipo_cambio: '3.6000',
  },
];
test('toma el cambio del origen consumido sin promediar el saldo sin usar', () =>
  expect(cambioSaldoAplicado(saldos, 500, '2026-11-12').tipoCambio).toBe(3.4));
test('combina mil del primer origen y quinientos del segundo', () => {
  const r = cambioSaldoAplicado(saldos, 1500, '2026-11-12');
  expect(r.tipoCambio).toBe(3.4642);
  expect(r.partes.map((p) => p.monto)).toEqual([1000, 500]);
  expect(r.equivalenteUsd).toBe(433.006536);
});
test('no usa fuentes futuras ni saldo inexistente', () => {
  expect(cambioSaldoAplicado(saldos, 1500, '2026-11-01')).toBeNull();
  expect(cambioSaldoAplicado(saldos, 2100, '2026-11-12')).toBeNull();
});
test('consume primero el menor saldo disponible aunque tenga una fecha posterior', () => {
  const r = cambioSaldoAplicado([
    { ...saldos[0], disponible: '2000.00' },
    { ...saldos[1], disponible: '500.00' },
  ], 800, '2026-11-12');
  expect(r.partes.map(p => [p.saldoId, p.monto])).toEqual([[2, 500], [1, 300]]);
});
test.each([[950, 350, 3.4], [650, 650, 3.4971], [350, 950, 3.5439]])('cambio de venta con saldo %s y adicional %s', (saldo, extra, esperado) => {
  const historico = cambioSaldoAplicado(saldos, saldo, '2026-11-12');
  const r = cambioVentaConSaldo(historico, extra, 3.6);
  expect(r.tipoCambio).toBe(esperado);
});
