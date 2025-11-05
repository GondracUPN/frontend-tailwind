// src/components/formParts/FormProductoIpad.js
export default function FormProductoIpad({ detalle, onChange }) {
  // OJO: 'tamaño' viene con Ã± desde backend. Lo extraemos con bracket notation.
  const { gama, procesador, generacion, almacenamiento, conexion } = detalle;
  const tamaño = detalle['tamaño'] || '';

  const generacionesNormales = ['8', '9', '10', '11'];
  const procesadoresAir = ['M1', 'M2', 'M3'];
  const procesadoresPro = ['M1', 'M2', 'M4'];

  const getProcesadores = () => {
    if (gama === 'Air') return procesadoresAir;
    if (gama === 'Pro') return procesadoresPro;
    return [];
  };

  // Evitamos Ã± en el nombre de la funciÃ³n para no tener problemas, pero el campo sigue siendo 'tamaño'
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
          value={gama || ''}
          onChange={e => {
            onChange('gama', e.target.value);
            // reset dependientes
            onChange('procesador', '');
            onChange('generacion', '');
            onChange('tamaño', '');        // <-- con Ã±
            onChange('almacenamiento', '');
            // Si quieres resetear conexiÃ³n, descomenta:
            // onChange('conexion', '');
          }}
        >
          <option value="">Seleccione</option>
          <option value="Normal">Normal</option>
          <option value="Air">Air</option>
          <option value="Pro">Pro</option>
        </select>
      </div>

      {/* GeneraciÃ³n para Normal */}
      {gama === 'Normal' && (
        <div>
          <label className="block font-medium">GeneraciÃ³n</label>
          <select
            className="w-full border p-2 rounded"
            value={generacion || ''}
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
              value={procesador || ''}
              onChange={e => {
                onChange('procesador', e.target.value);
                // reset dependientes
                onChange('tamaño', '');       // <-- con Ã±
                onChange('almacenamiento', '');
              }}
            >
              <option value="">Seleccione</option>
              {getProcesadores().map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* tamaño dinÃ¡mico */}
          {getTamanos().length > 0 && (
            <div>
              <label className="block font-medium">tamaño</label>
              <select
                className="w-full border p-2 rounded"
                value={tamaño}
                onChange={e => onChange('tamaño', e.target.value)}  // <-- con Ã±
              >
                <option value="">Seleccione</option>
                {getTamanos().map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          )}

          {/* Almacenamiento dinÃ¡mico */}
          {getAlmacenamiento().length > 0 && (
            <div>
              <label className="block font-medium">Almacenamiento</label>
              <select
                className="w-full border p-2 rounded"
                value={almacenamiento || ''}
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

      {/* ConexiÃ³n */}
      {gama && (
        <div>
          <label className="block font-medium">ConexiÃ³n</label>
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
