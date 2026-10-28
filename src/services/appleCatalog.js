// Catálogo Apple servido por nuestra API (/apple-catalog). Productos e Inventario consumen el
// mismo contrato; las reglas (selectores, campos no aplicables, IMEI, batería) vienen del backend.
import { useEffect, useState } from 'react';
import api from '../api';

const FORMS_PATH = '/apple-catalog/forms';
const MAX_AGE_MS = 10 * 60_000;
const EMPTY = { version: null, models: [], families: {} };

/** Una sola petición compartida (api.get deduplica en vuelo y cachea por maxAgeMs). */
export function fetchAppleCatalog() {
  return api.get(FORMS_PATH, { maxAgeMs: MAX_AGE_MS }).then((data) => ({
    version: data?.version || null,
    models: Array.isArray(data?.models) ? data.models : [],
    families: data?.families || {},
    dataset: data?.dataset || null,
  }));
}

export function useAppleCatalog() {
  const [state, setState] = useState({ ...EMPTY, loading: true, error: '' });
  useEffect(() => {
    let alive = true;
    fetchAppleCatalog()
      .then((catalog) => { if (alive) setState({ ...catalog, loading: false, error: '' }); })
      .catch((error) => { if (alive) setState({ ...EMPTY, loading: false, error: error?.message || 'No se pudo cargar el catálogo Apple.' }); });
    return () => { alive = false; };
  }, []);
  return state;
}

const norm = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

/** Formatos legados equivalentes del Watch (mismo criterio que el backend). */
export function normalizeLegacyDetalle(tipo, detalle = {}) {
  const out = { ...(detalle || {}) };
  if (norm(tipo) === 'watch') {
    const gen = String(out.generacion ?? '').trim();
    const split = gen.match(/^(Series|SE|Ultra)\s*(\d*)$/i);
    if (split) {
      out.gama = { series: 'Series', se: 'SE', ultra: 'Ultra' }[split[1].toLowerCase()];
      out.generacion = split[2] || '1';
    } else if (/^normal$/i.test(out.gama || '') || (!out.gama && /^\d+$/.test(gen))) out.gama = 'Series';
  }
  return out;
}

const airpodsKey = (value) => norm(value).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Selección actual del formulario a partir del `detalle` guardado. Solo es estado de UI:
 * el backend vuelve a resolver y validar al guardar.
 */
export function findCatalogModel(models, tipo, detalle) {
  const pool = (models || []).filter((model) => model.tipo === tipo);
  if (tipo === 'airpods') {
    const value = airpodsKey(detalle?.modelo || detalle?.descripcionOtro);
    if (!value) return null;
    return pool.find((model) => [model.title, model.detalle?.modelo, ...(model.aliases || [])].some((alias) => airpodsKey(alias) === value)) || null;
  }
  const current = normalizeLegacyDetalle(tipo, detalle);
  const fits = (template) => {
    const keys = Object.keys(template || {});
    return keys.length > 0 && keys.every((key) => norm(template[key]) === norm(current[key]));
  };
  // Mismo criterio que resolveProductModel en el backend: ante varias coincidencias, la plantilla más específica.
  const score = (model) => Math.max(0, ...[model.detalle, ...(model.detalleAliases || [])].filter(fits).map((t) => Object.keys(t).length));
  const matches = pool.filter((model) => score(model) > 0);
  if (matches.length <= 1) return matches[0] || null;
  const best = Math.max(...matches.map(score));
  const top = matches.filter((model) => score(model) === best);
  return top.length === 1 ? top[0] : null;
}

export const selectorOptions = (model, field, detalle = {}) => {
  const selector = (model?.selectors || []).find((item) => item.field === field);
  if (!selector) return [];
  if (!model.macCombos?.length || !['ram', 'almacenamiento'].includes(field)) return selector.options;
  // Mac: solo combinaciones vendidas para el chip (y tamaño cuando el bloque lo restringe).
  const size = String(detalle.tamano || '');
  const ram = String(detalle.ram || '');
  const allowed = new Set();
  for (const combo of model.macCombos) {
    if (combo.tamano?.length && size && !combo.tamano.includes(size)) continue;
    if (field === 'almacenamiento' && ram && !combo.ram.includes(ram)) continue;
    (field === 'ram' ? combo.ram : combo.almacenamiento).forEach((value) => allowed.add(value));
  }
  return selector.options.filter((option) => allowed.has(option.value));
};

export const modelDisplayName = (model) => (model ? `${model.title}${model.retired ? ' (retirado de la fuente)' : ''}` : '');
