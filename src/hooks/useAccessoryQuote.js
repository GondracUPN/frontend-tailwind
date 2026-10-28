import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';

export default function useAccessoryQuote({ enabled, productoId, cantidad, comprador, loteInicialId, precioUnitario }) {
  const [revision, setRevision] = useState(0);
  const requestedRevision = useRef(0);
  const [state, setState] = useState({});
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const valid = enabled && productoId && Number.isInteger(Number(cantidad)) && Number(cantidad) > 0;
  const body = { productoId: Number(productoId), cantidad: Number(cantidad),
    ...(comprador ? { comprador } : {}), ...(loteInicialId ? { loteInicialId: Number(loteInicialId) } : {}),
    ...(precioUnitario !== '' && precioUnitario != null && Number.isFinite(Number(precioUnitario)) && Number(precioUnitario) >= 0
      ? { precioUnitario: Number(precioUnitario) } : {}) };
  const key = JSON.stringify(body) + ':' + revision;
  useEffect(() => {
    if (!valid) return undefined;
    let active = true;
    setState({ key, pending: true });
    const payload = JSON.parse(key.slice(0, key.lastIndexOf(':')));
    const immediate = requestedRevision.current !== revision;
    requestedRevision.current = revision;
    const timer = setTimeout(() => {
    Promise.resolve().then(() => api.post('/ventas/accesorios/cotizar', payload)).then((quote) => {
      if (active) setState({ key, quote, error: quote?.cotizacionToken ? '' : 'No se pudo obtener la cotización.' });
    }).catch((error) => { if (active) setState({ key, error: error.message || 'No se pudo cotizar.' }); });
    }, immediate ? 0 : 300);
    return () => { active = false; clearTimeout(timer); };
  }, [key, valid, revision]);
  return { quote: valid && state.key === key && !state.pending ? state.quote : null,
    error: valid && state.key === key ? state.error : '', loading: valid && (state.key !== key || Boolean(state.pending)), refresh };
}
