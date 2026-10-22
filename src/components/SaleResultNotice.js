import React, { useEffect, useState } from 'react';

export default function SaleResultNotice() {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let timer;
    const changed = (event) => {
      const ingreso = event.detail?.venta?.ingreso;
      if (!ingreso) return;
      setResult(ingreso);
      clearTimeout(timer); timer = setTimeout(() => setResult(null), 12000);
    };
    window.addEventListener('ventas-updated', changed);
    return () => { clearTimeout(timer); window.removeEventListener('ventas-updated', changed); };
  }, []);
  if (!result) return null;
  return <div role="status" className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-xl border bg-white p-4 shadow-lg">
    {result.estado === 'registrado'
      ? `Venta guardada. Ingreso registrado: S/ ${Number(result.monto).toFixed(2)} · ${result.cuentas.join(', ')}.`
      : 'Venta guardada sin ingreso asignado a un vendedor. Revisa sus cobros en Finanzas.'}
    <button type="button" className="ml-3 underline" onClick={() => setResult(null)}>Cerrar</button>
  </div>;
}
