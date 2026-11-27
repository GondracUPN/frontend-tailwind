import React, { useEffect, useState } from 'react';
import api from '../api';

const families = { iphone: 'iPhone', ipad: 'iPad', macbook: 'MacBook' };
const rangeOrder = ['Normal', 'Air', 'Pro', 'Pro Max', 'Mini', 'Plus', 'E', 'Duo', 'Neo'];
const screenSize = (model) => model.screen || 'Sin tamaño registrado';
const iphoneSeries = (model) => model.series || model.label.match(/^iPhone\s+(\d+)/i)?.[1] || model.range;
const normalize = (value) => String(value).trim().toLowerCase().replace(/[″"]/g, '').replace(/(\d),(\d)/g, '$1.$2');
const modelFamily = (value) => normalize(value).match(/^(iphone|ipad|macbook)\b/)?.[1];
const input = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2';

export default function AccessoryCompatibility({ value, onChange, disabled = false }) {
  const [family, setFamily] = useState(() => {
    const first = modelFamily(value[0]);
    return !value.length ? '' : first && value.every((item) => modelFamily(item) === first) ? first : 'otro';
  });
  const [series, setSeries] = useState('');
  const [range, setRange] = useState('');
  const [size, setSize] = useState('');
  const [manual, setManual] = useState(() => value.join(', '));
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const usesCatalog = Boolean(families[family]);

  useEffect(() => {
    if (!usesCatalog || catalog) return;
    let active = true;
    api.get('/apple-catalog/accessory-compatibility', { maxAgeMs: 600000 }).then((rows) => {
      if (active) setCatalog(Array.isArray(rows) ? rows : []);
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [usesCatalog, catalog, attempt]);

  const changeFamily = (next) => {
    if (value.length && next !== 'otro' && !value.every((item) => modelFamily(item) === next)) {
      if (!window.confirm('¿Cambiar de familia y quitar los modelos seleccionados?')) return;
      onChange([]);
    }
    setManual(next === 'otro' ? value.join(', ') : '');
    setFamily(next);
    setSeries('');
    setRange('');
    setSize('');
  };
  const selected = new Set(value.map(normalize));
  const familyModels = (catalog || []).filter((row) => row.family === family);
  const isIphone = family === 'iphone';
  const seriesOptions = isIphone ? [...new Set(familyModels.map(iphoneSeries))].sort((a, b) =>
    (Number(b) || 0) - (Number(a) || 0) || a.localeCompare(b, 'es')) : [];
  const seriesModels = isIphone ? familyModels.filter((row) => iphoneSeries(row) === series) : familyModels;
  const availableRanges = new Set(seriesModels.map((row) => row.range));
  const ranges = [...rangeOrder.filter((item) => availableRanges.has(item)),
    ...[...availableRanges].filter((item) => !rangeOrder.includes(item)).sort()];
  const namedIphone = isIphone && Boolean(series) && !/^\d+$/.test(series) && ranges.length === 1;
  const rangeModels = namedIphone ? seriesModels : seriesModels.filter((row) => row.range === range);
  const sizes = [...new Set(rangeModels.map(screenSize))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  // En iPhone cada gama ya define su tamaño: basta serie + gama.
  const iphoneReady = isIphone && (Boolean(range) || namedIphone);
  const models = isIphone ? (iphoneReady ? rangeModels : []) : rangeModels.filter((row) => screenSize(row) === size);
  const addModels = (rows) => {
    const labels = rows.map((row) => row.label).filter((label) => !selected.has(normalize(label)));
    if (labels.length) onChange([...value, ...labels]);
  };
  const iphoneRangeModels = (nextSeries, nextRange) => {
    const rows = familyModels.filter((row) => iphoneSeries(row) === nextSeries);
    const single = !/^\d+$/.test(nextSeries) && new Set(rows.map((row) => row.range)).size === 1;
    return single ? rows : nextRange ? rows.filter((row) => row.range === nextRange) : [];
  };

  return <fieldset disabled={disabled} className="min-w-0 space-y-2 text-sm font-medium text-slate-700 sm:col-span-2">
    <legend>Modelos compatibles (opcional)</legend>
    <div className={`grid gap-2 ${isIphone ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
      <label className="block">Familia compatible
        <select className={input} value={family} onChange={(event) => changeFamily(event.target.value)}>
          <option value="">Sin indicar</option>
          {Object.entries(families).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          <option value="otro">Personalizado</option>
        </select>
      </label>
      {isIphone && catalog && <label className="block">Serie de iPhone
        <select className={input} value={series} onChange={(event) => {
          setSeries(event.target.value);
          setRange('');
          setSize('');
          if (event.target.value) addModels(iphoneRangeModels(event.target.value, ''));
        }}>
          <option value="">Elige la serie</option>
          {seriesOptions.map((item) => <option key={item} value={item}>iPhone {item}</option>)}
        </select>
      </label>}
      {usesCatalog && catalog && !namedIphone && (!isIphone || series) && <label className="block">Gama
        <select className={input} value={range} onChange={(event) => {
          setRange(event.target.value);
          setSize('');
          if (isIphone && event.target.value) addModels(iphoneRangeModels(series, event.target.value));
        }} disabled={!ranges.length}>
          <option value="">{ranges.length ? 'Elige la gama' : 'Sin gamas disponibles'}</option>
          {ranges.map((item) => <option key={item} value={item}>{isIphone && item === 'E' ? 'e' : item}</option>)}
        </select>
      </label>}
      {!isIphone && range && <label className="block">Tamaño de pantalla
        <select className={input} value={size} onChange={(event) => setSize(event.target.value)}>
          <option value="">Elige el tamaño</option>
          {sizes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>}
    </div>
    {family === 'otro' && <label className="block">Modelos personalizados
      <textarea className={input} rows={2} value={manual} placeholder="Separados por comas" onChange={(event) => {
        setManual(event.target.value);
        const models = [...new Set(event.target.value.split(/,(?!\d)|\n/).map((item) => item.trim()).filter(Boolean))];
        const appleFamilies = new Set(models.map(modelFamily).filter(Boolean));
        event.target.setCustomValidity(appleFamilies.size > 1 ? 'Elige modelos de una sola familia Apple.' : '');
        onChange(models);
      }} />
    </label>}
    {usesCatalog && <>
      <div className="flex flex-wrap gap-1.5">
        {value.map((label) => <button key={label} type="button" aria-label={`Quitar ${label}`}
          onClick={() => onChange(value.filter((item) => item !== label))}
          className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-800">{label} ×</button>)}
      </div>
      {(isIphone ? iphoneReady : size) && <fieldset>
        <legend className="mb-1">Modelos</legend>
        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {models.map((row) => <label key={row.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input type="checkbox" checked={selected.has(normalize(row.label))} onChange={(event) => onChange(event.target.checked
              ? [...value, row.label] : value.filter((item) => normalize(item) !== normalize(row.label)))} />
            <span>{row.label} <span className="font-normal text-slate-500">{[row.screen && !row.label.includes(row.screen) && row.screen, row.chip && !row.label.includes(row.chip) && row.chip, row.year].filter(Boolean).join(' · ')}</span></span>
          </label>)}
        </div>
      </fieldset>}
      {!catalog && (error ? <p role="status">No se pudo cargar el listado. <button type="button" className="text-indigo-700 underline" onClick={() => {
        setError(false); setAttempt((current) => current + 1);
      }}>Reintentar</button></p> : <p role="status" className="font-normal">Cargando modelos…</p>)}
    </>}
  </fieldset>;
}
