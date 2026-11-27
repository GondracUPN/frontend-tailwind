import { groupFusedLots } from './AccesoriosStockInventario';

const option = (id, fusionId, stock, date) => ({
  id, fusionId, label: 'Cable USB-C', code: id, seller: 'Gonzalo', stock, empaque: 'Con caja',
  fecha: { date, label: 'Llegó' }, lots: [{ id, codigoInventario: id, stockActual: stock }],
});

test('muestra los lotes fusionados como una sola opción con stock sumado y elige el lote más antiguo con stock', () => {
  const result = groupFusedLots([option(435, 433, 30, '2026-09-02'), option(433, 433, 0, '2026-09-01'), option(434, 433, 17, '2026-09-02'), option(422, null, 4, '2026-09-02')]);
  expect(result).toHaveLength(2);
  const fused = result.find((item) => item.fusionId === 433);
  expect(fused).toMatchObject({ id: 434, code: 433, stock: 47 });
  expect(result.find((item) => !item.fusionId)).toMatchObject({ id: 422, stock: 4 });
});
