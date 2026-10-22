import { accessoryProfitRows } from './accessoryProfitRows';

test('solo suma el costo de las unidades vendidas de cada accesorio, con su participación', () => {
  const producto = { tipo: 'accesorios', detalle: { modelo: 'AirTag' }, stockInicial: 10, valor: { costoTotal: 1000 } };
  const result = accessoryProfitRows([
    { producto, cantidad: 1, precioVenta: 150, costoVendido: 100 },
    { producto, cantidad: 4, precioVenta: 600, costoVendido: 400, __share: 0.5 },
    { producto: { detalle: { modelo: 'Cable' } }, cantidad: 2, precioVenta: 100, ganancia: 40 },
  ], (product) => product.detalle.modelo);
  expect(result[0]).toMatchObject({ name: 'AirTag', units: 5, cost: 300, revenue: 450, profit: 150, percentage: 50 });
  expect(result[1]).toMatchObject({ name: 'Cable', units: 2, cost: 60, revenue: 100, profit: 40 });
});
