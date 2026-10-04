import { formatPending500, getPending500 } from './pending500';

test('calcula transferencias pendientes y la última parcial', () => {
  expect(getPending500(5000, 8)).toEqual({ amount: 1000, fullTransfers: 2, transfers: 2, lastAmount: 500 });
  expect(getPending500(5200, 8)).toEqual({ amount: 1200, fullTransfers: 2, transfers: 3, lastAmount: 200 });
  expect(getPending500(5000, 10)).toEqual({ amount: 0, fullTransfers: 0, transfers: 0, lastAmount: 0 });
  expect(getPending500(5200, 2, 200)).toEqual({ amount: 4000, fullTransfers: 8, transfers: 8, lastAmount: 500 });
  expect(formatPending500(getPending500(5200, 8))).toBe('Faltan 2 transferencias de S/ 500 + 1 última transferencia de S/ 200.00');
  expect(formatPending500(getPending500(4700, 9))).toBe('Falta 1 última transferencia de S/ 200.00');
});
