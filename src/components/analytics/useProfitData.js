import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getProfitSeries } from '../../services/analytics';

export default function useProfitData(params) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const paramsKey = useMemo(() => JSON.stringify(params || {}), [params]);

  const load = useCallback(async (nextParams) => {
    setLoading(true);
    setError('');
    try {
      const res = await getProfitSeries(nextParams);
      setData(res);
    } catch (e) {
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(paramsRef.current);
  }, [load, paramsKey]);

  const retry = useCallback(() => load(paramsRef.current), [load]);

  return { data, loading, error, retry };
}
