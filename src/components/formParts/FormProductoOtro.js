export default function FormProductoOtro({ value = '', onChange }) {
  return (
    <div>
      <label className="block font-medium">Descripción (Otro)</label>
      <input
        type="text"
        className="w-full border p-2 rounded"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe el producto"
      />
    </div>
  );
}
