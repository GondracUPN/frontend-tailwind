import {
  ACCESSORY_MODEL_GROUPS,
  accessoryCategoryForModel,
  accessoryCompatibility,
} from './accessoryModels';

test('incluye todas las familias y los 25 modelos de accesorios configurados', () => {
  expect(ACCESSORY_MODEL_GROUPS.map((group) => group.category)).toEqual([
    'Cargador', 'Cable', 'Apple Pencil', 'Magic Keyboard', 'AirTag',
  ]);
  expect(ACCESSORY_MODEL_GROUPS.reduce((total, group) => total + group.models.length, 0)).toBe(25);
});

test('obtiene la familia y compatibilidad desde el modelo exacto', () => {
  expect(accessoryCategoryForModel('Cable USB-C a MagSafe 3 – 2 m')).toBe('Cable');
  expect(accessoryCategoryForModel('Magic Keyboard para iPad Pro 13" – A2974')).toBe('Magic Keyboard');
  expect(accessoryCompatibility('Apple Pencil Pro')).toContain('iPad mini A17 Pro');
});
