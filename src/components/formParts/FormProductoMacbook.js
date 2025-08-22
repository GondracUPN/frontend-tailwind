// src/components/formParts/FormProductoMacbook.js
export default function FormProductoMacbook({ detalle, onChange }) {
  const { gama, procesador } = detalle;

  const procesadoresAir = ['M1', 'M2', 'M3', 'M4'];
  const procesadoresPro = [
    'M1', 'M2', 'M3', 'M4',
    'M1 Pro', 'M2 Pro', 'M3 Pro', 'M4 Pro',
  ];

  const getTamanos = () => {
    if (gama === 'Air') return ['13', '15'];
    if (gama === 'Pro') {
      if (['M1','M2'].includes(procesador)) return ['13'];
      if (procesador === 'M4')             return ['14'];
      return ['14','16'];
    }
    return [];
  };

  const getAlmacenamiento = () => {
    if (gama === 'Air')                       return ['256', '512', '1TB'];
    if (['M1','M2'].includes(procesador)) return ['256','512','1TB'];
    return ['512','1TB','2TB'];
  };

  const rams = ['8','16','24','32','48'];

  return (
    <>
      {/* Gama */}
      <div>
        <label className="block font-medium">Gama</label>
        <select
          value={gama}
          className="w-full border p-2 rounded"
          onChange={e => onChange('gama', e.target.value)}
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
          onChange={e => onChange('procesador', e.target.value)}
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
          value={detalle.tamanio}
          className="w-full border p-2 rounded"
          onChange={e => onChange('tamanio', e.target.value)}
        >
          <option value="">Seleccione</option>
          {getTamanos().map(t => (
            <option key={t} value={t}>{t}″</option>
          ))}
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
          {rams.map(r => (
            <option key={r} value={r}>{r} GB</option>
          ))}
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
          {getAlmacenamiento().map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
    </>
  );
}
