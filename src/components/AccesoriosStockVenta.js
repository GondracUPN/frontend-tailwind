export const seleccionAccesoriosStock = (stock, excluidos) => stock === undefined ? {} : ({
  accesoriosStockIds: (stock?.accesorios || []).filter((item) => !excluidos.includes(item.productoId)).map((item) => item.productoId),
  accesoriosStockRevision: stock?.revision ?? 0,
});

export default function AccesoriosStockVenta({ stock, excluidos, setExcluidos, disabled }) {
  if (!stock?.accesorios?.length) return null;
  return (
    <fieldset disabled={disabled} className="space-y-2 rounded-lg border border-slate-200 px-3 pb-3">
      <legend className="px-1 text-sm font-medium">Accesorios que se entregan</legend>
      {stock.accesorios.map((item) => (
        <label key={item.productoId} className="flex min-h-8 items-center gap-2 text-sm">
          <input type="checkbox" checked={!excluidos.includes(item.productoId)}
            onChange={(event) => {
              const marcado = event.target.checked;
              setExcluidos((ids) => marcado ? ids.filter((id) => id !== item.productoId) : [...ids, item.productoId]);
            }} />
          {item.nombre}
        </label>
      ))}
    </fieldset>
  );
}
