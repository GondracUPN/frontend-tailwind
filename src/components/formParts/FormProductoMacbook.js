// src/components/formParts/FormProductoMacbook.js
export default function FormProductoMacbook({ detalle, onChange }) {
  const { gama, procesador } = detalle;

  const procesadoresAir = ['M1', 'M2', 'M3', 'M4'];
  const procesadoresPro = [
    'M1', 'M2', 'M3', 'M4',
    'M1 Pro', 'M2 Pro', 'M3 Pro', 'M4 Pro',
    'M1 Max', 'M2 Max', 'M3 Max', 'M4 Max',
  ];

  const getConfig = () => {
    const p = String(procesador || '').trim();
    let sizes = [];
    let rams = [];
    let ssds = [];
    if (gama === 'Air') {
      if (p === 'M1') { sizes=['13']; rams=['8','16']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M2') { sizes=['13.6','15.3']; rams=['8','16','24']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M3') { sizes=['13.6','15.3']; rams=['8','16','24']; ssds=['256','512','1TB','2TB']; }
      else if (p === 'M4') { sizes=['13.6','15.3']; rams=['16','24','32']; ssds=['256','512','1TB','2TB']; }
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
    }
    return { sizes, rams, ssds };
  };

  const { sizes, rams, ssds } = getConfig();

  return (
    <>
      {/* Gama */}
      <div>
        <label className="block font-medium">Gama</label>
        <select
          value={gama}
          className="w-full border p-2 rounded"
          onChange={e => { onChange('gama', e.target.value); onChange('procesador',''); onChange('tamaño',''); onChange('ram',''); onChange('almacenamiento',''); }}
        >
          <option value="">Seleccione</option>
          <option value="Air">Air</option>
          <option value="Pro">Pro</option>
        </select>
      </div>

      {/* Procesador */}
      <div>
        <label className="block font-medium">Procesador</label>
        <select
          value={procesador}
          className="w-full border p-2 rounded"
          onChange={e => { onChange('procesador', e.target.value); onChange('tamaño',''); onChange('ram',''); onChange('almacenamiento',''); }}
        >
          <option value="">Seleccione</option>
          {(gama === 'Air' ? procesadoresAir : procesadoresPro).map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Tamaño */}
      <div>
        <label className="block font-medium">Tamaño</label>
        <select
          value={detalle['tamaño']}
          className="w-full border p-2 rounded"
          onChange={e => onChange('tamaño', e.target.value)}
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

