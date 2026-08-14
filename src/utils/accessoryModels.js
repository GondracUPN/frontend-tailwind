export const ACCESSORY_MODEL_GROUPS = [
  {
    category: 'Cargador',
    models: [
      'Cargador 20W',
      'Cargador 30W',
      'Cargador 35W – 2 puertos USB-C',
      'Cargador 40W Dynamic – hasta 60W',
      'Cargador 67W',
      'Cargador 70W',
      'Cargador 96W',
      'Cargador 140W',
    ],
  },
  {
    category: 'Cable',
    models: [
      'Cable USB-C a USB-C 60W – 1 m',
      'Cable USB-C a USB-C 240W – 2 m',
      'Cable USB-C a MagSafe 3 – 2 m',
    ],
  },
  {
    category: 'Apple Pencil',
    models: [
      { name: 'Apple Pencil Pro', compatibility: 'iPad Pro 11” M4/M5 · iPad Pro 13” M4/M5 · iPad Air 11” M2/M3/M4 · iPad Air 13” M2/M3/M4 · iPad mini A17 Pro' },
      { name: 'Apple Pencil USB-C', compatibility: 'iPad Pro 11” 1.ª–4.ª gen., M4/M5 · iPad Pro 12.9” 3.ª–6.ª gen. · iPad Pro 13” M4/M5 · iPad Air 4.ª/5.ª gen. · iPad Air 11”/13” M2/M3/M4 · iPad 10.ª gen./A16 · iPad mini 6.ª gen./A17 Pro' },
      { name: 'Apple Pencil 2.ª generación', compatibility: 'iPad Pro 11” 1.ª–4.ª gen. · iPad Pro 12.9” 3.ª–6.ª gen. · iPad Air 4.ª/5.ª gen. · iPad mini 6.ª gen.' },
      { name: 'Apple Pencil 1.ª generación', compatibility: 'iPad 6.ª–10.ª gen. · iPad Air 3.ª gen. · iPad mini 5.ª gen. · iPad Pro 9.7”/10.5” · iPad Pro 12.9” 1.ª/2.ª gen.' },
    ],
  },
  {
    category: 'Magic Keyboard',
    models: [
      { name: 'Magic Keyboard 11" – A2261', compatibility: 'iPad Pro 11" 1.ª/2.ª/3.ª/4.ª gen. (A12X/A12Z/M1/M2) · iPad Air 4.ª/5.ª gen. (A14/M1)' },
      { name: 'Magic Keyboard 12.9" – A1998', compatibility: 'iPad Pro 12.9" 3.ª/4.ª gen. · iPad Pro 12.9" 5.ª gen. M1 con ajuste limitado' },
      { name: 'Magic Keyboard 12.9" – A2480', compatibility: 'iPad Pro 12.9" 3.ª/4.ª/5.ª/6.ª gen. (A12X/A12Z/M1/M2)' },
      { name: 'Magic Keyboard para iPad Pro 11" – A2975', compatibility: 'iPad Pro 11" M4/M5' },
      { name: 'Magic Keyboard para iPad Pro 13" – A2974', compatibility: 'iPad Pro 13" M4/M5' },
      { name: 'Magic Keyboard para iPad Air 11" – A3339', compatibility: 'iPad Air 4.ª/5.ª gen. · iPad Air 11" M2/M3/M4' },
      { name: 'Magic Keyboard para iPad Air 13" – A3340', compatibility: 'iPad Air 13" M2/M3/M4' },
      { name: 'Magic Keyboard Folio – A2695', compatibility: 'iPad 10.ª generación · iPad A16' },
    ],
  },
  {
    category: 'AirTag',
    models: ['AirTag – 1.ª generación', 'AirTag – 2.ª generación'],
  },
];

const modelName = (model) => typeof model === 'string' ? model : model.name;

export const accessoryCategoryForModel = (model) => {
  const value = String(model || '').trim();
  return ACCESSORY_MODEL_GROUPS.find((group) => group.models.some((item) => modelName(item) === value))?.category || '';
};

export const accessoryCompatibility = (model) => {
  const value = String(model || '').trim();
  for (const group of ACCESSORY_MODEL_GROUPS) {
    const item = group.models.find((candidate) => modelName(candidate) === value);
    if (item && typeof item !== 'string') return item.compatibility || '';
  }
  return '';
};

export const accessoryModelName = modelName;
