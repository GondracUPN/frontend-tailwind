// src/components/formParts/FormProductoIphone.js
export default function FormProductoIphone({ detalle, onChange }) {
  const { numero, modelo, almacenamiento } = detalle;
  const numeros = ['11','12','13','14','15','16','17'];

  const modelosDisponibles = (num) => {
    const n = parseInt(num, 10);
    const ops = [];
    if (n >= 11 && n <= 16) ops.push('Normal', 'Pro', 'Pro Max');
    if (n === 17) ops.push('Normal', 'Air', 'Pro', 'Pro Max');
    if (n >= 12 && n <= 13) ops.push('Mini');
    if (n >= 14 && n <= 16) ops.push('Plus');
    return Array.from(new Set(ops));
  };

  const getAlmacenamiento = () => {
    const n = parseInt(numero, 10);
    if (n >= 11 && n <= 12) return ['64', '128', '256'];
    if (n >= 13 && n <= 16) {
      if (['Pro', 'Pro Max'].includes(modelo)) {
        if (n <= 14) return ['128', '256', '512'];
        return ['256', '512', '1TB'];
      }
      return ['128', '256', '512'];
    }
    if (n === 17) {
      // Serie 17 parte en 256 GB para todas las variantes
      return ['256', '512', '1TB'];
    }
    return [];
  };

  return (
    <>
      {/* Número */}
      <div>
        <label className="block font-medium">Número</label>
        <select
          className="w-full border p-2 rounded"
          value={numero}
          onChange={e => {
            onChange('numero', e.target.value);
            onChange('modelo', '');
            onChange('almacenamiento', '');
          }}
        >
          <option value="">Seleccione</option>
          {numeros.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      {/* Modelo */}
      {numero && (
        <div>
          <label className="block font-medium">Modelo</label>
          <select
            className="w-full border p-2 rounded"
            value={modelo}
            onChange={e => {
              onChange('modelo', e.target.value);
              onChange('almacenamiento', '');
            }}
          >
            <option value="">Seleccione</option>
            {modelosDisponibles(numero).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Almacenamiento */}
      {modelo && (
        <div>
          <label className="block font-medium">Almacenamiento</label>
          <select
            className="w-full border p-2 rounded"
            value={almacenamiento}
            onChange={e => onChange('almacenamiento', e.target.value)}
          >
            <option value="">Seleccione</option>
            {getAlmacenamiento().map(a => <option key={a} value={a}>{a} GB</option>)}
          </select>
        </div>
      )}
    </>
  );
}
