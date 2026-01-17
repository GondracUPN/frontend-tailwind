// src/components/formParts/FormProductoWatch.js
export default function FormProductoWatch({ detalle, onChange }) {
  const { generacion, conexion, tamano } = detalle;
  const generaciones = ['6', '7', '8', '9', '10', '11', 'SE 2', 'SE 3', 'Ultra 1', 'Ultra 2', 'Ultra 3'];
  const conexiones = ['GPS', 'GPS + Cel'];
  const tamanosPorModelo = {
    '6': ['40 mm', '44 mm'],
    '7': ['41 mm', '45 mm'],
    '8': ['41 mm', '45 mm'],
    '9': ['41 mm', '45 mm'],
    '10': ['42 mm', '46 mm'],
    '11': ['42 mm', '46 mm'],
    'SE 2': ['40 mm', '44 mm'],
    'SE 3': ['40 mm', '44 mm'],
    'Ultra 1': ['49 mm'],
    'Ultra 2': ['49 mm'],
    'Ultra 3': ['49 mm'],
  };
  const tamanosDisponibles = tamanosPorModelo[generacion] || [];

  return (
    <>
      {/* Generación */}
      <div>
        <label className="block font-medium">Generación</label>
        <select
          className="w-full border p-2 rounded"
          value={generacion}
          onChange={e => {
            onChange('generacion', e.target.value);
            onChange('tamano', '');
            onChange('conexion', '');
          }}
        >
          <option value="">Seleccione</option>
          {generaciones.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Tamaño */}
      {generacion && tamanosDisponibles.length > 0 && (
        <div>
          <label className="block font-medium">Tamaño</label>
          <select
            className="w-full border p-2 rounded"
            value={tamano || ''}
            onChange={e => onChange('tamano', e.target.value)}
          >
            <option value="">Seleccione</option>
            {tamanosDisponibles.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}

      {/* Conexión */}
      {generacion && (
        <div>
          <label className="block font-medium">Conexión</label>
          <select
            className="w-full border p-2 rounded"
            value={conexion}
            onChange={e => onChange('conexion', e.target.value)}
          >
            <option value="">Seleccione</option>
            {conexiones.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </>
  );
}
