// src/components/formParts/FormProductoIpad.js
export default function FormProductoIpad({ detalle, onChange }) {
  const { gama, procesador, generacion, tamanio, almacenamiento } = detalle;

  const generacionesNormales = ['8', '9', '10', '11'];
  const procesadoresAir = ['M1', 'M2', 'M3'];
  const procesadoresPro = ['M1', 'M2', 'M4'];

  const getProcesadores = () => {
    if (gama === 'Air') return procesadoresAir;
    if (gama === 'Pro') return procesadoresPro;
    return [];
  };

  const getTamanos = () => {
    if (gama === 'Air' && ['M2', 'M3'].includes(procesador)) return ['11', '13'];
    if (gama === 'Pro') {
      if (['M1', 'M2'].includes(procesador)) return ['11', '12.9'];
      if (procesador === 'M4') return ['11', '13'];
    }
    return [];
  };

  const getAlmacenamiento = () => {
    if (gama === 'Normal') return [];
    if (gama === 'Air') {
      if (procesador === 'M1') return ['64', '128', '256'];
      if (['M2', 'M3'].includes(procesador)) return ['128', '256', '512'];
    }
    if (gama === 'Pro') {
      if (['M1', 'M2'].includes(procesador)) return ['128', '256', '512', '1TB', '2TB'];
      if (procesador === 'M4') return ['256', '512', '1TB', '2TB'];
    }
    return [];
  };

  return (
    <>
      {/* Gama */}
      <div>
        <label className="block font-medium">Gama</label>
        <select
          className="w-full border p-2 rounded"
          value={gama}
          onChange={e => {
            onChange('gama', e.target.value);
            // reset dependientes
            onChange('procesador', '');
            onChange('generacion', '');
            onChange('tamanio', '');
            onChange('almacenamiento', '');
          }}
        >
          <option value="">Seleccione</option>
          <option value="Normal">Normal</option>
          <option value="Air">Air</option>
          <option value="Pro">Pro</option>
        </select>
      </div>

      {/* Generación para Normal */}
      {gama === 'Normal' && (
        <div>
          <label className="block font-medium">Generación</label>
          <select
            className="w-full border p-2 rounded"
            value={generacion}
            onChange={e => onChange('generacion', e.target.value)}
          >
            <option value="">Seleccione</option>
            {generacionesNormales.map(g => (
              <option key={g} value={g}>{g}</option>
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
              value={procesador}
              onChange={e => {
                onChange('procesador', e.target.value);
                // reset dependientes
                onChange('tamanio', '');
                onChange('almacenamiento', '');
              }}
            >
              <option value="">Seleccione</option>
              {getProcesadores().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Tamaño dinámico */}
          {getTamanos().length > 0 && (
            <div>
              <label className="block font-medium">Tamaño</label>
              <select
                className="w-full border p-2 rounded"
                value={tamanio}
                onChange={e => onChange('tamanio', e.target.value)}
              >
                <option value="">Seleccione</option>
                {getTamanos().map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Almacenamiento dinámico */}
          {getAlmacenamiento().length > 0 && (
            <div>
              <label className="block font-medium">Almacenamiento</label>
              <select
                className="w-full border p-2 rounded"
                value={almacenamiento}
                onChange={e => onChange('almacenamiento', e.target.value)}
              >
                <option value="">Seleccione</option>
                {getAlmacenamiento().map(a => (
                  <option key={a} value={a}>{a} GB</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}
    </>
  );
}
