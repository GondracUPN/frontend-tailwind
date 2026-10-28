// Selección en cascada desde el catálogo Apple propio: familia → modelo comercial → configuraciones válidas.
// Las opciones, los campos aplicables y las validaciones vienen del backend (/apple-catalog/forms).
import { useEffect, useMemo, useState } from 'react';
import { findCatalogModel, normalizeLegacyDetalle, selectorOptions, useAppleCatalog } from '../../services/appleCatalog';

const IDENTITY_FIELDS = ['gama', 'procesador', 'generacion', 'numero', 'modelo'];
const FIRST_ORDER = {
  macbook: ['Air', 'Pro', 'Neo'],
  ipad: ['Normal', 'Mini', 'Air', 'Pro'],
  watch: ['Series', 'SE', 'Ultra'],
};
const firstOrder = (tipo, value) => {
  const list = FIRST_ORDER[tipo] || [];
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
};
const FIRST_LABELS = {
  macbook: { Air: 'MacBook Air', Pro: 'MacBook Pro', Neo: 'MacBook Neo' },
  ipad: { Normal: 'iPad', Mini: 'iPad mini', Air: 'iPad Air', Pro: 'iPad Pro' },
  watch: { Series: 'Apple Watch Series', SE: 'Apple Watch SE', Ultra: 'Apple Watch Ultra' },
};
const firstLabel = (tipo, value) => (tipo === 'iphone' ? `iPhone ${value || '(otros)'}` : FIRST_LABELS[tipo]?.[value] || value);
const levelLabel = (tipo, field, first) => {
  if (first) return { iphone: 'Número', imac: 'Procesador', macmini: 'Procesador' }[tipo] || 'Modelo';
  if (field === 'procesador') return 'Procesador';
  if (field === 'generacion') return tipo === 'watch' ? 'Serie' : 'Generación';
  return 'Modelo';
};
const secondLabel = (tipo, model, field) => {
  const value = model.detalle?.[field] || '';
  if (tipo === 'ipad') return model.title;
  if (tipo === 'watch') return model.title.replace(/^Apple Watch\s+/, '');
  if (tipo === 'iphone') return model.title;
  return `${value}${model.retired ? ' (retirado de la fuente)' : ''}`;
};
const byRelease = (a, b) => String(b.released || '').localeCompare(String(a.released || '')) || a.title.localeCompare(b.title);
const selectClass = 'w-full border p-2 rounded';

function AirpodsFields({ models, detalle, onChange }) {
  const current = findCatalogModel(models, 'airpods', detalle);
  const generations = useMemo(() => {
    const map = new Map();
    for (const model of [...models].sort(byRelease)) {
      const key = model.airpods?.generation || model.title;
      map.set(key, [...(map.get(key) || []), model]);
    }
    return map;
  }, [models]);
  const [generation, setGeneration] = useState(current?.airpods?.generation || '');
  useEffect(() => { if (current?.airpods?.generation) setGeneration(current.airpods.generation); }, [current?.airpods?.generation]);
  const editions = generations.get(generation) || [];
  const ancSelectable = editions.some((model) => model.airpods?.ancSelectable);
  const choose = (model) => onChange('modelo', model ? model.detalle.modelo || model.title : '');

  useEffect(() => {
    // Una sola edición comprobada: se autocompleta (las características fijas no generan campos).
    if (generation && editions.length === 1 && current?.id !== editions[0].id) choose(editions[0]);
  }, [generation, editions.length]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div>
        <label htmlFor="airpods-generacion" className="block font-medium">Modelo de AirPods</label>
        <select id="airpods-generacion" className={selectClass} value={generation} onChange={(e) => { setGeneration(e.target.value); onChange('modelo', ''); }}>
          <option value="">Selecciona</option>
          {[...generations.keys()].map((key) => <option key={key} value={key}>{key}</option>)}
        </select>
      </div>
      {generation && ancSelectable && (
        <div>
          <label htmlFor="airpods-anc" className="block font-medium">Cancelación activa de ruido</label>
          <select id="airpods-anc" className={selectClass} value={current ? (current.airpods?.anc ? 'con' : 'sin') : ''} onChange={(e) => choose(editions.find((m) => (m.airpods?.anc ? 'con' : 'sin') === e.target.value))}>
            <option value="">Selecciona</option>
            {editions.some((m) => m.airpods?.anc === true) && <option value="con">Con ANC</option>}
            {editions.some((m) => m.airpods?.anc === false) && <option value="sin">Sin ANC</option>}
          </select>
        </div>
      )}
      {generation && !ancSelectable && editions.length > 1 && (
        <div>
          <label htmlFor="airpods-edicion" className="block font-medium">Edición</label>
          <select id="airpods-edicion" className={selectClass} value={current?.id || ''} onChange={(e) => choose(editions.find((m) => m.id === e.target.value))}>
            <option value="">Selecciona</option>
            {editions.map((model) => <option key={model.id} value={model.id}>{model.title}</option>)}
          </select>
        </div>
      )}
      {current && (
        <p className="text-xs text-gray-500">
          {current.title}{current.airpods?.caseLabel ? ` · Estuche ${current.airpods.caseLabel}` : ''}
          {current.airpods?.anc === null ? ' · ANC no confirmado' : ''}
        </p>
      )}
    </>
  );
}

export default function CatalogModelFields({ tipo, detalle = {}, onChange, idPrefix }) {
  const catalog = useAppleCatalog();
  const prefix = idPrefix || `catalogo-${tipo}`;
  const allModels = useMemo(() => catalog.models.filter((model) => model.tipo === tipo).sort(byRelease), [catalog.models, tipo]);
  // El producto guardado se resuelve contra todo el catálogo; los selectores solo ofrecen el alcance comercial.
  const model = useMemo(() => findCatalogModel(allModels, tipo, detalle), [allModels, tipo, detalle]);
  const models = useMemo(() => allModels.filter((item) => item.listed !== false || item.id === model?.id), [allModels, model]);

  // Configuraciones con una sola opción comprobada: se muestran completadas y se guardan.
  useEffect(() => {
    if (!model) return;
    for (const selector of model.selectors || []) {
      const options = selectorOptions(model, selector.field, detalle);
      if (selector.status === 'confirmed' && options.length === 1 && !String(detalle?.[selector.field] || '').trim()) {
        onChange(selector.field, options[0].value);
      }
    }
  }, [model, detalle, onChange]);

  const selectModel = (id) => {
    const next = models.find((item) => item.id === id) || null;
    const keys = new Set([...IDENTITY_FIELDS.filter((key) => detalle?.[key] !== undefined), ...Object.keys(next?.detalle || {}), ...Object.keys(model?.detalle || {})]);
    keys.forEach((key) => onChange(key, next?.detalle?.[key] ?? ''));
    // Una línea sin procesador elegido todavía no tiene reglas contra las que invalidar la configuración.
    if (!next) {
      return;
    }
    const configuration = { ...detalle };
    keys.forEach((key) => { configuration[key] = next.detalle?.[key] ?? ''; });
    // Conserva también los campos pendientes de una selección intermedia, cuando `model` es null.
    const previousSelectors = new Map(models.flatMap((item) => item.selectors || []).map((selector) => [selector.field, selector]));
    for (const field of previousSelectors.keys()) {
      const value = String(configuration[field] || '').trim();
      if (value && !next.selectors?.some((item) => item.field === field)) {
        configuration[field] = '';
        onChange(field, '');
      }
    }
    // Valida dependencias en orden usando los valores ya corregidos, nunca la pantalla/RAM antigua.
    const order = ['tamano', 'ram', 'almacenamiento'];
    const selectors = [...(next.selectors || [])].sort((a, b) => {
      const rank = (field) => order.includes(field) ? order.indexOf(field) : order.length;
      return rank(a.field) - rank(b.field);
    });
    for (const selector of selectors) {
      if (selector.status !== 'confirmed') continue; // Sin datos no significa que el valor sea inválido.
      const options = selectorOptions(next, selector.field, configuration);
      const value = String(configuration[selector.field] || '').trim();
      if (value && !options.some((option) => option.value === value)) {
        configuration[selector.field] = '';
      }
      if (!configuration[selector.field] && options.length === 1) configuration[selector.field] = options[0].value;
      if (configuration[selector.field] !== detalle[selector.field]) onChange(selector.field, configuration[selector.field] ?? '');
    }
  };

  // Cascada: primer campo de identidad (gama / número / chip) y, debajo, el que distingue el modelo.
  const firstField = Object.keys(models[0]?.detalle || {})[0] || 'gama';
  const current = normalizeLegacyDetalle(tipo, detalle);
  const firstValue = String(model?.detalle?.[firstField] ?? current[firstField] ?? '');
  const firstOptions = Array.from(new Set(models.map((item) => item.detalle?.[firstField]).filter(Boolean)))
    .sort((a, b) => firstOrder(tipo, a) - firstOrder(tipo, b) || String(a).localeCompare(String(b), undefined, { numeric: true }));
  const singleLevel = models.every((item) => Object.keys(item.detalle || {}).length <= 1);
  const secondModels = singleLevel ? [] : models
    .filter((item) => String(item.detalle?.[firstField] ?? '') === firstValue)
    .sort((a, b) => String(a.released || '').localeCompare(String(b.released || '')) || a.title.localeCompare(b.title, undefined, { numeric: true }));
  const secondField = Object.keys(secondModels[0]?.detalle || {}).find((key) => key !== firstField) || '';

  const selectFirst = (value) => {
    if (singleLevel) {
      selectModel(models.find((item) => String(item.detalle?.[firstField]) === value)?.id || '');
      return;
    }
    const candidates = models.filter((item) => String(item.detalle?.[firstField]) === value);
    if (candidates.length === 1) {
      selectModel(candidates[0].id);
      return;
    }
    // Cambiar de línea reinicia la identidad; conserva la configuración hasta elegir el modelo concreto.
    if (model) selectModel('');
    onChange(firstField, value);
    IDENTITY_FIELDS.filter((key) => key !== firstField && String(detalle?.[key] || '').trim()).forEach((key) => onChange(key, ''));
  };

  useEffect(() => {
    // Una sola opción en el segundo nivel (p. ej. MacBook Neo → A18 Pro): se completa sola.
    if (!model && secondModels.length === 1 && firstValue) selectModel(secondModels[0].id);
  }, [model, secondModels.length, firstValue]); // eslint-disable-line react-hooks/exhaustive-deps

  if (catalog.loading) return <p className="text-sm text-gray-500">Cargando catálogo Apple…</p>;
  if (catalog.error) return <p className="text-sm text-red-600">No se pudo cargar el catálogo Apple: {catalog.error}</p>;
  if (tipo === 'airpods') return <AirpodsFields models={models} detalle={detalle} onChange={onChange} />;

  return (
    <>
      <div>
        <label htmlFor={`${prefix}-${firstField}`} className="block font-medium">{levelLabel(tipo, firstField, true)}</label>
        <select id={`${prefix}-${firstField}`} className={selectClass} value={firstOptions.includes(firstValue) ? firstValue : ''} onChange={(e) => selectFirst(e.target.value)}>
          <option value="">Selecciona</option>
          {firstOptions.map((value) => <option key={value} value={value}>{firstLabel(tipo, value)}</option>)}
        </select>
      </div>
      {!singleLevel && firstValue && secondModels.length > 0 && (
        <div>
          <label htmlFor={`${prefix}-${secondField}`} className="block font-medium">{levelLabel(tipo, secondField, false)}</label>
          <select id={`${prefix}-${secondField}`} className={selectClass} value={model?.id || ''} disabled={secondModels.length === 1 && Boolean(model)} onChange={(e) => selectModel(e.target.value)}>
            <option value="">Selecciona</option>
            {secondModels.map((item) => <option key={item.id} value={item.id}>{secondLabel(tipo, item, secondField)}</option>)}
          </select>
        </div>
      )}
      {model && (model.selectors || []).map((selector) => {
        const value = String(detalle?.[selector.field] || '');
        const options = selectorOptions(model, selector.field, detalle);
        const id = `${prefix}-${selector.field}`;
        if (selector.status !== 'confirmed' || !model.selectors.find((s) => s.field === selector.field).options.length) {
          return (
            <div key={selector.field}>
              <label htmlFor={id} className="block font-medium">{selector.label}</label>
              <input id={id} className={selectClass} value={value} onChange={(e) => onChange(selector.field, e.target.value)} placeholder="Ingresa el valor" />
            </div>
          );
        }
        const legacy = value && !options.some((option) => option.value === value);
        return (
          <div key={selector.field}>
            <label htmlFor={id} className="block font-medium">{selector.label}</label>
            <select id={id} className={selectClass} value={value} disabled={options.length === 1 && !legacy} onChange={(e) => onChange(selector.field, e.target.value)}>
              <option value="">Selecciona</option>
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              {legacy && <option value={value}>{value}</option>}
            </select>
          </div>
        );
      })}
    </>
  );
}
