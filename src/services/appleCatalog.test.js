import { catalogImportDetalle, findCatalogModel } from './appleCatalog';
import identity from '../__fixtures__/appleCatalogIdentity.json';

// Identidades de los 112 modelos del catálogo completo (generado desde el backend, que comprueba lo mismo).
test('cada plantilla canónica, alias de detalle y alias de título resuelve a su propio modelo', () => {
  const failures = [];
  for (const model of identity) {
    for (const template of [model.detalle, ...(model.detalleAliases || [])]) {
      const found = findCatalogModel(identity, model.tipo, template);
      if (found?.id !== model.id) failures.push(`${model.id} ← ${JSON.stringify(template)} → ${found?.id || 'null'}`);
    }
    for (const alias of model.aliases || []) {
      const found = findCatalogModel(identity, model.tipo, { modelo: alias });
      if (found?.id !== model.id) failures.push(`${model.id} ← alias ${alias}`);
    }
  }
  expect(identity.length).toBeGreaterThan(100);
  expect(failures).toEqual([]);
});

test('AirPods resuelve también desde descripcionOtro y no adivina sin datos', () => {
  expect(findCatalogModel(identity, 'airpods', { descripcionOtro: 'AirPods Pro 3' }).id).toBe('airpods-airpods-pro-3');
  expect(findCatalogModel(identity, 'iphone', {})).toBeNull();
});

test('la base respeta las combinaciones de pantalla, RAM y almacenamiento', () => {
  const model = {
    tipo: 'macbook', detalle: { gama: 'Pro', procesador: 'M4 Max' },
    selectors: [
      { field: 'tamano', status: 'confirmed', options: [{ value: '16' }, { value: '14' }] },
      { field: 'ram', status: 'confirmed', options: [{ value: '64' }, { value: '36' }] },
      { field: 'almacenamiento', status: 'confirmed', options: [{ value: '2TB' }, { value: '1TB' }, { value: '512' }] },
    ],
    macCombos: [
      { tamano: ['14'], ram: ['36'], almacenamiento: ['1TB', '2TB'] },
      { tamano: ['16'], ram: ['64'], almacenamiento: ['2TB'] },
    ],
  };
  const catalog = { models: [model] };
  expect(catalogImportDetalle(catalog, 'macbook', { ...model.detalle, tamano: '16', ram: '8', almacenamiento: '512' }))
    .toMatchObject({ tamano: '16', ram: '64', almacenamiento: '2TB' });
  expect(catalogImportDetalle(catalog, 'macbook', model.detalle))
    .toMatchObject({ tamano: '14', ram: '36', almacenamiento: '1TB' });
  expect(catalogImportDetalle(catalog, 'macbook', { procesador: 'desconocido', ram: '256', almacenamiento: '8TB' }))
    .toMatchObject({ ram: '', almacenamiento: '' });
});
