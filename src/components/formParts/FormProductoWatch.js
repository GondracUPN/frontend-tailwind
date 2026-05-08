// src/components/formParts/FormProductoWatch.js
import { useEffect, useMemo } from 'react';

const LINEAS = ['Series', 'SE', 'Ultra'];
const SERIES_BY_LINEA = {
  Series: ['6', '7', '8', '9', '10', '11'],
  SE: ['2', '3'],
  Ultra: ['1', '2', '3'],
};
const CONEXIONES = ['GPS', 'GPS + Cel'];
const TAMANOS_BY_KEY = {
  'Series 6': ['40 mm', '44 mm'],
  'Series 7': ['41 mm', '45 mm'],
  'Series 8': ['41 mm', '45 mm'],
  'Series 9': ['41 mm', '45 mm'],
  'Series 10': ['42 mm', '46 mm'],
  'Series 11': ['42 mm', '46 mm'],
  'SE 2': ['40 mm', '44 mm'],
  'SE 3': ['40 mm', '44 mm'],
  'Ultra 1': ['49 mm'],
  'Ultra 2': ['49 mm'],
  'Ultra 3': ['49 mm'],
};

const normalizeWatchDetalle = (detalle = {}) => {
  const rawLinea = String(detalle.gama || '').trim();
  const rawGeneracion = String(detalle.generacion || '').trim();
  if (rawLinea) {
    return {
      linea: rawLinea === 'Normal' ? 'Series' : rawLinea,
      serie: rawGeneracion.replace(/^(Series|Ultra|SE)\s+/i, '').trim(),
    };
  }
  const ultra = rawGeneracion.match(/^Ultra\s+(.+)$/i);
  if (ultra) return { linea: 'Ultra', serie: ultra[1].trim() };
  const se = rawGeneracion.match(/^SE\s*(.*)$/i);
  if (se) return { linea: 'SE', serie: (se[1] || '').trim() };
  if (rawGeneracion) return { linea: 'Series', serie: rawGeneracion };
  return { linea: '', serie: '' };
};

export default function FormProductoWatch({ detalle, onChange }) {
  const { conexion, tamano } = detalle || {};
  const { linea, serie } = useMemo(() => normalizeWatchDetalle(detalle), [detalle]);
  const seriesDisponibles = SERIES_BY_LINEA[linea] || [];
  const tamanosDisponibles = TAMANOS_BY_KEY[`${linea} ${serie}`] || [];

  useEffect(() => {
    const rawGeneracion = String(detalle?.generacion || '').trim();
    const rawGama = String(detalle?.gama || '').trim();
    if (!rawGama && linea) onChange('gama', linea);
    if (rawGeneracion && rawGeneracion !== serie) onChange('generacion', serie);
  }, [detalle?.gama, detalle?.generacion, linea, serie, onChange]);

  return (
    <>
      <div>
        <label className="block font-medium">Tipo de Watch</label>
        <select
          className="w-full border p-2 rounded"
          value={linea}
          onChange={e => {
            onChange('gama', e.target.value);
            onChange('generacion', '');
            onChange('tamano', '');
            onChange('conexion', '');
          }}
        >
          <option value="">Seleccione</option>
          {LINEAS.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {linea && (
        <div>
          <label className="block font-medium">Serie</label>
          <select
            className="w-full border p-2 rounded"
            value={serie}
            onChange={e => {
              onChange('generacion', e.target.value);
              onChange('tamano', '');
              onChange('conexion', '');
            }}
          >
            <option value="">Seleccione</option>
            {seriesDisponibles.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      )}

      {linea && serie && tamanosDisponibles.length > 0 && (
        <div>
          <label className="block font-medium">Tamano</label>
          <select
            className="w-full border p-2 rounded"
            value={tamano || ''}
            onChange={e => onChange('tamano', e.target.value)}
          >
            <option value="">Seleccione</option>
            {tamanosDisponibles.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      )}

      {linea && serie && (
        <div>
          <label className="block font-medium">Conexion</label>
          <select
            className="w-full border p-2 rounded"
            value={conexion || ''}
            onChange={e => onChange('conexion', e.target.value)}
          >
            <option value="">Seleccione</option>
            {CONEXIONES.map(item => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
