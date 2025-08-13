// src/components/formParts/FormProductoWatch.js
export default function FormProductoWatch({ detalle, onChange }) {
  const { generacion, conexion } = detalle;
  const generaciones = ['6','7','8','9','10','Ultra 1','Ultra 2'];
  const conexiones = ['GPS','GPS + Cel'];

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
            onChange('conexion', '');
          }}
        >
          <option value="">Seleccione</option>
          {generaciones.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

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
