import { useMemo } from 'react';
import {
  ACCESSORY_MODEL_GROUPS,
  accessoryCategoryForModel,
  accessoryCompatibility,
  accessoryModelName,
} from '../../utils/accessoryModels';

export default function FormProductoAccessory({ detalle = {}, cantidad = 1, onDetalleChange, onCantidadChange, currentStock }) {
  const model = String(detalle.modelo || '').trim();
  const inferredCategory = accessoryCategoryForModel(model);
  const legacyCategory = ACCESSORY_MODEL_GROUPS.some((item) => item.category === model) ? model : '';
  const category = inferredCategory || String(detalle.gama || '').trim() || legacyCategory;
  const group = useMemo(() => ACCESSORY_MODEL_GROUPS.find((item) => item.category === category), [category]);
  const compatibility = accessoryCompatibility(model);
  const isLegacyModel = model && !inferredCategory;

  const changeCategory = (value) => {
    onDetalleChange('gama', value);
    onDetalleChange('modelo', '');
    onDetalleChange('descripcionOtro', '');
  };

  const changeModel = (value) => {
    onDetalleChange('modelo', value);
    onDetalleChange('descripcionOtro', '');
  };

  return (
    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
      <div>
        <label className="block font-medium">Tipo de accesorio</label>
        <select className="w-full border p-2 rounded bg-white" value={category} onChange={(event) => changeCategory(event.target.value)}>
          <option value="">Selecciona</option>
          {ACCESSORY_MODEL_GROUPS.map((item) => <option key={item.category} value={item.category}>{item.category}</option>)}
          {category && !ACCESSORY_MODEL_GROUPS.some((item) => item.category === category) && <option value={category}>{category} (anterior)</option>}
        </select>
      </div>

      {category && (
        <div>
          <label className="block font-medium">Modelo</label>
          <select className="w-full border p-2 rounded bg-white" value={model} onChange={(event) => changeModel(event.target.value)}>
            <option value="">Selecciona</option>
            {(group?.models || []).map((item) => {
              const name = accessoryModelName(item);
              return <option key={name} value={name}>{name}</option>;
            })}
            {isLegacyModel && <option value={model}>{model} (anterior)</option>}
          </select>
          {compatibility && <p className="mt-1.5 text-xs leading-relaxed text-gray-600"><span className="font-medium">Compatible con:</span> {compatibility}</p>}
        </div>
      )}

      <div>
        <label className="block font-medium">Cantidad comprada</label>
        <input type="number" min="1" step="1" inputMode="numeric" className="w-full border p-2 rounded bg-white" value={cantidad} onChange={(event) => onCantidadChange(event.target.value)} />
        {currentStock == null
          ? <p className="mt-1 text-xs text-gray-600">Puedes ingresar una o varias unidades.</p>
          : <p className="mt-1 text-xs text-gray-600">Disponibles ahora: {Math.max(0, Number(cantidad || 0) - Math.max(0, Number(currentStock.initial || 0) - Number(currentStock.current || 0)))}</p>}
      </div>
      <p className="text-xs text-gray-600">Maneja stock por unidades y puede llevar casillero y tracking.</p>
    </div>
  );
}
