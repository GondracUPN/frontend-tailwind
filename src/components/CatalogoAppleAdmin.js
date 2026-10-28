// Administración del catálogo Apple: estado de la sincronización con AppleDB (fuente comunitaria gratuita),
// "Actualizar ahora", cobertura real por familia y publicación del dataset complementario propio.
import { useCallback, useEffect, useState } from 'react';
import api from '../api';

const formatDate = (value) => (value ? new Date(value).toLocaleString('es-PE') : '—');

export default function CatalogoAppleAdmin() {
  const [status, setStatus] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [datasetText, setDatasetText] = useState('');
  const [preview, setPreview] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([api.get('/apple-catalog/sync/status'), api.get('/apple-catalog/coverage')]);
      setStatus(s);
      setCoverage(c);
    } catch (error) {
      setMessage(error?.message || 'No se pudo cargar el estado del catálogo Apple.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncNow = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await api.post('/apple-catalog/sync', {});
      const diff = result?.diff ? ` Nuevos: ${result.diff.added?.length || 0}, cambiados: ${result.diff.changed?.length || 0}, retenidos: ${result.diff.retained || 0}.` : '';
      setMessage(`Resultado: ${result?.status}${result?.detail ? ` — ${result.detail}` : ''}.${diff}`);
      await load();
    } catch (error) {
      setMessage(error?.message || 'No se pudo sincronizar.');
    } finally {
      setBusy(false);
    }
  };

  const parseDataset = () => {
    try {
      return JSON.parse(datasetText);
    } catch {
      setMessage('El dataset no es un JSON válido.');
      return null;
    }
  };

  const previewDataset = async () => {
    const dataset = parseDataset();
    if (!dataset) return;
    setBusy(true);
    try {
      setPreview(await api.post('/apple-catalog/dataset/preview', { dataset }));
    } catch (error) {
      setMessage(error?.message || 'No se pudo previsualizar.');
    } finally {
      setBusy(false);
    }
  };

  const publishDataset = async () => {
    const dataset = parseDataset();
    if (!dataset || !window.confirm(`¿Publicar el dataset ${dataset.version}?`)) return;
    setBusy(true);
    try {
      const result = await api.post('/apple-catalog/dataset/publish', { dataset });
      setMessage(`Dataset ${result?.version}: ${result?.status}.`);
      setPreview(null);
      await load();
    } catch (error) {
      setMessage(error?.message || 'No se pudo publicar.');
    } finally {
      setBusy(false);
    }
  };

  const state = status?.state || {};
  return (
    <div className="bg-white border rounded-xl shadow p-4 space-y-3 md:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Catálogo Apple (AppleDB + dataset propio)</h2>
        <button type="button" onClick={syncNow} disabled={busy} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">
          {busy ? 'Procesando…' : 'Actualizar ahora'}
        </button>
      </div>
      {message && <div className="text-sm rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{message}</div>}
      {status && (
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>Fuente: <strong>{status.source?.name}</strong> · {status.source?.license} · sin clave</div>
          <div>Periodicidad: cada {status.intervalHours} h{status.intervalHours <= 0 ? ' (desactivada)' : ''}</div>
          <div>Versión publicada: <code>{status.catalogVersion}</code>{status.usingBaseline ? ' (línea base empaquetada)' : ''}</div>
          <div>Dataset complementario: {status.dataset?.version}</div>
          <div>Última ejecución: {formatDate(state.lastRunAt)} · {state.lastResult || '—'}</div>
          <div>Último éxito: {formatDate(state.lastSuccessAt)}</div>
          {state.lastError && <div className="sm:col-span-2 text-red-700">Último error: {state.lastError}</div>}
          {(state.pendingReview || []).length > 0 && <div className="sm:col-span-2 text-amber-700">Pendiente de clasificar: {state.pendingReview.join('; ')}</div>}
          <div className="sm:col-span-2 text-xs text-gray-500">{status.expectedLatency}</div>
        </div>
      )}
      {coverage && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead><tr className="text-left text-gray-500"><th className="pr-3">Familia</th><th className="pr-3">Modelos</th><th className="pr-3">Campo</th><th className="pr-3">Confirmados</th><th className="pr-3">Oficial</th><th className="pr-3">Curado</th><th className="pr-3">AppleDB</th><th>Huecos</th></tr></thead>
            <tbody>
              {(coverage.families || []).flatMap((row) => Object.entries(row.fields).map(([field, stats]) => (
                <tr key={`${row.tipo}-${field}`} className="border-t">
                  <td className="pr-3">{row.tipo}</td><td className="pr-3">{row.models}</td><td className="pr-3">{field}</td>
                  <td className="pr-3">{stats.confirmed}</td><td className="pr-3">{stats.official}</td><td className="pr-3">{stats.curated}</td><td className="pr-3">{stats.appledb}</td>
                  <td className={stats.unknown ? 'text-amber-700 font-semibold' : ''}>{stats.unknown}</td>
                </tr>
              )))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-gray-500">Conflictos abiertos: {(coverage.conflicts || []).filter((c) => !c.resolved).length}. «Curado» = pendiente de contraste con ficha oficial.</p>
        </div>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Publicar versión del dataset complementario (JSON)</summary>
        <textarea value={datasetText} onChange={(e) => setDatasetText(e.target.value)} rows={6} className="mt-2 w-full border rounded p-2 font-mono text-xs" placeholder='{"version":"2026.11.01-1","models":[...]}' />
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={previewDataset} disabled={busy || !datasetText.trim()} className="px-3 py-1.5 rounded border text-sm">Previsualizar</button>
          <button type="button" onClick={publishDataset} disabled={busy || !preview?.valid} className="px-3 py-1.5 rounded bg-gray-800 text-white text-sm disabled:opacity-50">Publicar</button>
        </div>
        {preview && (
          <div className="mt-2 text-xs">
            {preview.valid
              ? <>Versión {preview.version} (actual {preview.currentVersion}) · nuevos {preview.diff?.added?.length || 0} · cambiados {preview.diff?.changed?.length || 0}{!preview.newerThanCurrent && ' · la versión debe ser posterior'}</>
              : <span className="text-red-700">{(preview.errors || []).join(' ')}</span>}
          </div>
        )}
      </details>
    </div>
  );
}
