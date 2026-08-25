import React from 'react';

const CONFIG = {
  macbook: { options: ['Caja', 'Cubo original', 'Cubo fake', 'Cable original', 'Cable fake', 'Case', 'Mica'], groups: [['Cubo original', 'Cubo fake'], ['Cable original', 'Cable fake']] },
  ipad: { options: ['Caja', 'Cubo original', 'Cubo fake', 'Cable original', 'Cable fake', 'Case', 'Mica', 'Magic Keyboard', 'Keyboard Logitech', 'Keyboard otros'], groups: [['Cubo original', 'Cubo fake'], ['Cable original', 'Cable fake'], ['Magic Keyboard', 'Keyboard Logitech', 'Keyboard otros']] },
  iphone: { options: ['Caja', 'Cubo original', 'Cubo fake', 'Cable original', 'Cable fake', 'Funda', 'Mica'], groups: [['Cubo original', 'Cubo fake'], ['Cable original', 'Cable fake']] },
  watch: { options: ['Caja', 'Cable', 'Cable fake', 'Case', 'Correa', 'Correa fake'], groups: [['Cable', 'Cable fake'], ['Correa', 'Correa fake']] },
  macmini: { options: ['Caja', 'Cable de poder original', 'Cable de poder generico'], groups: [['Cable de poder original', 'Cable de poder generico']] },
  imac: { options: ['Caja', 'Cargador', 'Cargador fake', 'Cable', 'Cable fake', 'Teclado', 'Mouse'], groups: [['Cargador', 'Cargador fake'], ['Cable', 'Cable fake']] },
  airpods: { options: ['Caja'], groups: [] },
  otro: { options: ['Caja'], groups: [] },
};

const airpodsConfig = (model = '') => {
  const value = String(model).toLowerCase();
  if (value.includes('max')) return { options: ['Caja', 'Cable'], groups: [] };
  if (value.includes('pro')) return { options: ['Caja', 'Eartips'], groups: [] };
  return CONFIG.airpods;
};

export const getIncludedAccessoryConfig = (type, model) =>
  type === 'airpods' ? airpodsConfig(model) : (CONFIG[type] || CONFIG.otro);

export const defaultSealedAccessories = (type, model) => {
  const value = String(model || '').toLowerCase();
  const defaults = {
    macbook: ['Caja', 'Cubo original', 'Cable original'],
    ipad: ['Caja', 'Cubo original', 'Cable original'],
    iphone: ['Caja', 'Cable original'],
    watch: ['Caja', 'Correa', 'Cable'],
    macmini: ['Caja', 'Cable de poder original'],
    imac: ['Caja', 'Cargador', 'Cable', 'Teclado', 'Mouse'],
    otro: ['Caja'],
  };
  if (type === 'airpods') {
    if (value.includes('max')) return ['Caja', 'Cable'];
    if (value.includes('pro')) return ['Caja', 'Eartips'];
    return ['Caja'];
  }
  return defaults[type] || [];
};

export const normalizeIncludedAccessories = (type, selected, model, state) => {
  if (type === 'accesorios') return [];
  if (String(state || '').toLowerCase() === 'nuevo') return defaultSealedAccessories(type, model);
  const config = getIncludedAccessoryConfig(type, model);
  const normalizedInput = Array.isArray(selected) ? selected : [];
  const next = normalizedInput.filter((item) => config.options.includes(item));
  const unique = [...new Set(next)];
  config.groups.forEach((group) => {
    const matches = unique.filter((item) => group.includes(item));
    matches.slice(0, -1).forEach((item) => unique.splice(unique.indexOf(item), 1));
  });
  return unique;
};

export default function IncludedAccessories({ type, model, state, value, onChange }) {
  if (!type || type === 'accesorios') return null;
  const sealed = String(state || '').toLowerCase() === 'nuevo';
  const config = getIncludedAccessoryConfig(type, model);
  const selected = normalizeIncludedAccessories(type, value, model, state);
  if (sealed) {
    return (
      <div>
        <label className="block font-medium mb-1">Accesorios incluidos</label>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Producto nuevo/sellado: se incluyen automáticamente <strong>{selected.join(', ') || 'los accesorios de fábrica'}</strong>.
        </div>
      </div>
    );
  }
  const toggle = (option, checked) => {
    let next = checked ? [...selected, option] : selected.filter((item) => item !== option);
    if (checked) {
      const group = config.groups.find((items) => items.includes(option));
      if (group) next = next.filter((item) => item === option || !group.includes(item));
    }
    onChange(normalizeIncludedAccessories(type, next, model));
  };
  return (
    <div>
      <label className="block font-medium mb-1">Accesorios incluidos</label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {config.options.map((option) => {
          const active = selected.includes(option);
          return <button key={option} type="button" aria-pressed={active} onClick={() => toggle(option, !active)} className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded border px-3 py-2 text-left ${active ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-gray-200 bg-white'}`}><span>{option}</span><span aria-hidden="true">{active ? '✓' : ''}</span></button>;
        })}
      </div>
      <p className="mt-1 text-xs text-gray-500">Selecciona únicamente lo que incluye el producto. Las alternativas original/fake o de teclado son excluyentes.</p>
    </div>
  );
}
