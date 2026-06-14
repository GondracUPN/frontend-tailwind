// src/components/formParts/FormProductoIpad.js
import { useEffect, useMemo, useState } from 'react';
import api from '../../api';

const uniq = (items) => Array.from(new Set((items || []).map((x) => String(x || '').trim()).filter(Boolean)));
const metaList = (item, key) => Array.isArray(item?.metadata?.[key]) ? item.metadata[key] : [];

export default function FormProductoIpad({ detalle, onChange }) {
  const { gama, procesador, generacion, almacenamiento, conexion } = detalle;
  const tamano = detalle.tamano || '';
  const [customOptions, setCustomOptions] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/catalog/product-options')
      .then((rows) => {
        if (alive) setCustomOptions((Array.isArray(rows) ? rows : []).filter((item) => item.productType === 'ipad'));
      })
      .catch(() => { if (alive) setCustomOptions([]); });
    return () => { alive = false; };
  }, []);

  const generacionesNormales = ['8', '9', '10', '11'];
  const generacionesMini = ['6', '7'];
  const procesadoresAir = ['M1', 'M2', 'M3'];
  const procesadoresPro = ['M1', 'M2', 'M4', 'M5'];
  const customFamilies = useMemo(() => uniq(customOptions.map((item) => item.family)), [customOptions]);
  const customForSelection = customOptions.find((item) => item.family === gama && item.value === (gama === 'Normal' || gama === 'Mini' ? generacion : procesador));

  const getProcesadores = () => {
    const custom = customOptions.filter((item) => item.family === gama).map((item) => item.value);
    if (gama === 'Air') return uniq([...procesadoresAir, ...custom]);
    if (gama === 'Pro') return uniq([...procesadoresPro, ...custom]);
    return [];
  };

  const getTamanos = () => {
    if (customForSelection && metaList(customForSelection, 'sizes').length) return metaList(customForSelection, 'sizes');
    if (gama === 'Normal') {
      if (['8', '9'].includes(generacion)) return ['10.2'];
      if (generacion === '10') return ['10.9'];
      if (generacion === '11') return ['11'];
    }
    if (gama === 'Air' && ['M2', 'M3'].includes(procesador)) return ['11', '13'];
    if (gama === 'Pro') {
      if (['M1', 'M2'].includes(procesador)) return ['11', '12.9'];
      if (['M4', 'M5'].includes(procesador)) return ['11', '13'];
    }
    return [];
  };

  const getAlmacenamiento = () => {
    if (customForSelection && metaList(customForSelection, 'storages').length) return metaList(customForSelection, 'storages');
    if (gama === 'Normal') {
      if (generacion === '8') return ['32', '128'];
      if (['9', '10'].includes(generacion)) return ['64', '256'];
      if (generacion === '11') return ['128', '256', '512'];
      return [];
    }
    if (gama === 'Mini') {
      if (generacion === '6') return ['64', '256'];
      if (generacion === '7') return ['128', '256', '512'];
      return [];
    }
    if (gama === 'Air') {
      if (procesador === 'M1') return ['64', '128', '256'];
      if (['M2', 'M3'].includes(procesador)) return ['128', '256', '512'];
    }
    if (gama === 'Pro') {
      if (['M1', 'M2'].includes(procesador)) return ['128', '256', '512', '1TB', '2TB'];
      if (['M4', 'M5'].includes(procesador)) return ['256', '512', '1TB', '2TB'];
    }
    return [];
  };
  const almacenamientoOptions = uniq([...getAlmacenamiento(), almacenamiento]);

  return (
    <>
      {/* Gama */}
      <div>
        <label className="block font-medium">Gama</label>
        <select
          className="w-full border p-2 rounded"
          value={gama || ''}
          onChange={e => {
            onChange('gama', e.target.value);
            // reset dependientes
            onChange('procesador', '');
            onChange('generacion', '');
            onChange('tamano', '');        // reset tamano en ASCII
            onChange('almacenamiento', '');
            // Si quieres resetear conexion, descomenta:
            // onChange('conexion', '');
          }}
        >
          <option value="">Seleccione</option>
          {uniq(['Normal', 'Mini', 'Air', 'Pro', ...customFamilies]).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* Generacion para Normal/Mini */}
      {(gama === 'Normal' || gama === 'Mini') && (
        <div>
          <label className="block font-medium">Generacion</label>
          <select
            className="w-full border p-2 rounded"
            value={generacion || ''}
            onChange={e => {
              onChange('generacion', e.target.value);
              onChange('tamano', '');
              onChange('almacenamiento', '');
            }}
          >
            <option value="">Seleccione</option>
            {uniq([...(gama === 'Normal' ? generacionesNormales : generacionesMini), ...customOptions.filter((item) => item.family === gama).map((item) => item.value)]).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      )}

      {gama === 'Normal' && getTamanos().length > 0 && (
        <div>
          <label className="block font-medium">Tamaño de pantalla</label>
          <select
            className="w-full border p-2 rounded"
            value={tamano}
            onChange={e => onChange('tamano', e.target.value)}
          >
            <option value="">Seleccione</option>
            {getTamanos().map(t => (
              <option key={t} value={t}>{t} pulgadas</option>
            ))}
          </select>
        </div>
      )}

      {/* Procesador para Air/Pro */}
      {(gama === 'Air' || gama === 'Pro') && (
        <>
          <div>
            <label className="block font-medium">Procesador</label>
            <select
              className="w-full border p-2 rounded"
              value={procesador || ''}
              onChange={e => {
                onChange('procesador', e.target.value);
                // reset dependientes
                onChange('tamano', '');       // reset tamano ASCII
                onChange('almacenamiento', '');
              }}
            >
              <option value="">Seleccione</option>
              {getProcesadores().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* tamano dinamico (campo 'tamano') */}
          {getTamanos().length > 0 && (
            <div>
              <label className="block font-medium">Tamaño de pantalla</label>
              <select
                className="w-full border p-2 rounded"
                value={tamano}
                onChange={e => onChange('tamano', e.target.value)}
              >
                <option value="">Seleccione</option>
                {getTamanos().map(t => (
                  <option key={t} value={t}>{t} pulgadas</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {/* Almacenamiento dinamico (Air/Pro/Mini) */}
      {almacenamientoOptions.length > 0 && (
        <div>
          <label className="block font-medium">Almacenamiento</label>
          <select
            className="w-full border p-2 rounded"
            value={almacenamiento || ''}
            onChange={e => onChange('almacenamiento', e.target.value)}
          >
            <option value="">Seleccione</option>
            {almacenamientoOptions.map(a => (
              <option key={a} value={a}>{String(a).includes('TB') ? a : `${a} GB`}</option>
            ))}
          </select>
        </div>
      )}

      {/* Conexion */}
      {gama && (
        <div>
          <label className="block font-medium">Conexion</label>
          <select
            className="w-full border p-2 rounded"
            value={conexion || ''}
            onChange={e => onChange('conexion', e.target.value)}
          >
            <option value="">Seleccione</option>
            <option value="Wifi">Wifi</option>
            <option value="Wifi + Cel">Wifi + Cel</option>
          </select>
        </div>
      )}
    </>
  );
}
