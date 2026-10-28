import { findCatalogModel } from './appleCatalog';
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
