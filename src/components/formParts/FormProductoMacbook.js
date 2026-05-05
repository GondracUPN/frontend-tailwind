// src/components/formParts/FormProductoMacbook.js
import { useEffect, useMemo, useState } from 'react';
import api from '../../api';

const uniq = (items) => Array.from(new Set((items || []).map((x) => String(x || '').trim()).filter(Boolean)));
const metaList = (item, key) => Array.isArray(item?.metadata?.[key]) ? item.metadata[key] : [];

export default function FormProductoMacbook({ detalle, onChange }) {
  const { gama, procesador } = detalle;
  const [customOptions, setCustomOptions] = useState([]);

  useEffect(() => {
    let alive = true;
    api.get('/catalog/product-options')
      .then((rows) => {
        if (alive) setCustomOptions((Array.isArray(rows) ? rows : []).filter((item) => item.productType === 'macbook'));
      })
      .catch(() => { if (alive) setCustomOptions([]); });
    return () => { alive = false; };
  }, []);

  // Opciones clásicas; se agrega M5 solo en variante base (sin Pro/Max)
  const procesadoresAir = ['M1', 'M2', 'M3', 'M4', 'M5'];
  const procesadoresNeo = ['A18 Pro'];
  const procesadoresPro = [
    'M1', 'M2', 'M3', 'M4', 'M5',
    'M1 Pro', 'M2 Pro', 'M3 Pro', 'M4 Pro',
    'M1 Max', 'M2 Max', 'M3 Max', 'M4 Max',
  ];
  const customFamilies = useMemo(() => uniq(customOptions.map((item) => item.family)), [customOptions]);
  const customForSelection = customOptions.find((item) => item.family === gama && item.value === procesador);

  const getConfig = () => {
    const p = String(procesador || '').trim();
    let sizes = [];
    let rams = [];
    let ssds = [];
    if (gama === 'Air') {
      if (p === 'M1') { sizes=['13']; rams=['8','16']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M2') { sizes=['13','15']; rams=['8','16','24']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M3') { sizes=['13','15']; rams=['8','16','24']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M4') { sizes=['13','15']; rams=['16','24','32']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M5') { sizes=['13','15']; rams=['16','24','32']; ssds=['256','512','1TB','2TB']; }
    } else if (gama === 'Neo') {
      if (p === 'A18 Pro') { sizes=['13']; rams=['8']; ssds=['256','512']; }
    } else if (gama === 'Pro') {
      if (p === 'M1') { sizes=['13']; rams=['8','16']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M1 Pro') { sizes=['14','16']; rams=['16','32']; ssds=['512','1TB','2TB']; }
      else if (p === 'M1 Max') { sizes=['14','16']; rams=['32','64']; ssds=['512','1TB','2TB','4TB','8TB']; }
      else if (p === 'M2') { sizes=['13']; rams=['8','16','24']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M2 Pro') { sizes=['14','16']; rams=['16','32','36']; ssds=['512','1TB','2TB']; }
      else if (p === 'M2 Max') { sizes=['14','16']; rams=['32','64','96']; ssds=['512','1TB','2TB','4TB','8TB']; }
      else if (p === 'M3') { sizes=['14']; rams=['8','16','24']; ssds=['512','1TB','2TB']; }
      else if (p === 'M3 Pro') { sizes=['14','16']; rams=['18','36']; ssds=['512','1TB','2TB','4TB']; }
      else if (p === 'M3 Max') { sizes=['14','16']; rams=['36','48','64']; ssds=['1TB','2TB','4TB','8TB']; }
      else if (p === 'M4') { sizes=['14']; rams=['8','16','24']; ssds=['512','1TB','2TB']; }
      else if (p === 'M4 Pro') { sizes=['14','16']; rams=['24','48']; ssds=['512','1TB','2TB','4TB']; }
      else if (p === 'M4 Max') { sizes=['14','16']; rams=['48','64','128']; ssds=['1TB','2TB','4TB','8TB']; }
      else if (p === 'M5') { sizes=['14']; rams=['16','24']; ssds=['512','1TB','2TB']; }
    }
    if (customForSelection) {
      sizes = uniq([...sizes, ...metaList(customForSelection, 'sizes')]);
      rams = uniq([...rams, ...metaList(customForSelection, 'rams')]);
      ssds = uniq([...ssds, ...metaList(customForSelection, 'storages')]);
    }
    return { sizes, rams, ssds };
  };

  const { sizes, rams, ssds } = getConfig();
  const procesadoresCustom = uniq(customOptions.filter((item) => item.family === gama).map((item) => item.value));
  const procesadores = uniq([
    ...(gama === 'Air' ? procesadoresAir : gama === 'Neo' ? procesadoresNeo : procesadoresPro),
    ...procesadoresCustom,
  ]);

  return (
    <>
      {/* Gama */}
      <div>
        <label className="block font-medium">Gama</label>
        <select
          value={gama}
          className="w-full border p-2 rounded"
          onChange={e => { onChange('gama', e.target.value); onChange('procesador',''); onChange('tamano',''); onChange('ram',''); onChange('almacenamiento',''); }}
        >
          <option value="">Seleccione</option>
          {uniq(['Air', 'Neo', 'Pro', ...customFamilies]).map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {/* Procesador */}
      <div>
        <label className="block font-medium">Procesador</label>
        <select
          value={procesador}
          className="w-full border p-2 rounded"
          onChange={e => { onChange('procesador', e.target.value); onChange('tamano',''); onChange('ram',''); onChange('almacenamiento',''); }}
        >
          <option value="">Seleccione</option>
          {procesadores.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Tamaño (mostrar ñ, guardar en 'tamano') */}
      <div>
        <label className="block font-medium">Tamaño</label>
        <select
          value={detalle?.tamano || ''}
          className="w-full border p-2 rounded"
          onChange={e => onChange('tamano', e.target.value)}
        >
          <option value="">Seleccione</option>
          {sizes.map(t => (<option key={t} value={t}>{t}″</option>))}
        </select>
      </div>

      {/* RAM */}
      <div>
        <label className="block font-medium">RAM</label>
        <select
          value={detalle.ram}
          className="w-full border p-2 rounded"
          onChange={e => onChange('ram', e.target.value)}
        >
          <option value="">Seleccione</option>
          {rams.map(r => (<option key={r} value={r}>{r} GB</option>))}
        </select>
      </div>

      {/* Almacenamiento */}
      <div>
        <label className="block font-medium">Almacenamiento</label>
        <select
          value={detalle.almacenamiento}
          className="w-full border p-2 rounded"
          onChange={e => onChange('almacenamiento', e.target.value)}
        >
          <option value="">Seleccione</option>
          {ssds.map(a => (<option key={a} value={a}>{a}</option>))}
        </select>
      </div>
    </>
  );
}
