const CONFIG = {
  macmini: {
    label: 'Mac mini',
    chips: ['M1', 'M2', 'M2 Pro', 'M4', 'M4 Pro'],
    ram: {
      M1: ['8', '16'],
      M2: ['8', '16', '24'],
      'M2 Pro': ['16', '32'],
      M4: ['16', '24', '32'],
      'M4 Pro': ['24', '48', '64'],
    },
    storage: ['256', '512', '1TB', '2TB'],
  },
  imac: {
    label: 'iMac',
    chips: ['M1', 'M3', 'M4'],
    ram: {
      M1: ['8', '16'],
      M3: ['8', '16', '24'],
      M4: ['16', '24', '32'],
    },
    storage: ['256', '512', '1TB', '2TB'],
  },
};

const withCurrent = (options, current) => {
  const values = [...(options || [])];
  if (current && !values.includes(current)) values.push(current);
  return values;
};

export default function FormProductoMacDesktop({ tipo, detalle = {}, onChange }) {
  const config = CONFIG[tipo] || CONFIG.macmini;
  const fieldPrefix = `producto-${tipo || 'macdesktop'}`;
  const chip = detalle.procesador || '';
  const ramOptions = withCurrent(config.ram[chip] || [], detalle.ram);
  const storageOptions = withCurrent(config.storage, detalle.almacenamiento);

  return (
    <>
      <div>
        <label htmlFor={`${fieldPrefix}-chip`} className="block font-medium">Versión / chip Apple</label>
        <select
          id={`${fieldPrefix}-chip`}
          className="w-full border p-2 rounded"
          value={chip}
          onChange={(event) => {
            onChange('procesador', event.target.value);
            onChange('ram', '');
            onChange('almacenamiento', '');
            if (tipo === 'imac') onChange('tamano', '24');
          }}
        >
          <option value="">Selecciona</option>
          {withCurrent(config.chips, chip).map((value) => <option key={value} value={value}>{config.label} {value}</option>)}
        </select>
      </div>

      {tipo === 'imac' && (
        <div>
          <label htmlFor={`${fieldPrefix}-tamano`} className="block font-medium">Tamaño de pantalla</label>
          <select id={`${fieldPrefix}-tamano`} className="w-full border p-2 rounded" value={detalle.tamano || '24'} onChange={(event) => onChange('tamano', event.target.value)}>
            <option value="24">24 pulgadas</option>
          </select>
        </div>
      )}

      <div>
        <label htmlFor={`${fieldPrefix}-ram`} className="block font-medium">Memoria unificada</label>
        <select id={`${fieldPrefix}-ram`} className="w-full border p-2 rounded" value={detalle.ram || ''} onChange={(event) => onChange('ram', event.target.value)} disabled={!chip}>
          <option value="">Selecciona</option>
          {ramOptions.map((value) => <option key={value} value={value}>{value} GB</option>)}
        </select>
      </div>

      <div>
        <label htmlFor={`${fieldPrefix}-almacenamiento`} className="block font-medium">Almacenamiento</label>
        <select id={`${fieldPrefix}-almacenamiento`} className="w-full border p-2 rounded" value={detalle.almacenamiento || ''} onChange={(event) => onChange('almacenamiento', event.target.value)} disabled={!chip}>
          <option value="">Selecciona</option>
          {storageOptions.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
    </>
  );
}
