// Alta de productos Apple desde enlaces de EveryMac (importación autorizada): se pegan los enlaces de las
// fichas, se revisa lo que se leyó y se guarda en la BD. Los formularios leen el catálogo guardado,
// nunca EveryMac, así que no hay cargas repetidas al registrar productos.
import { useCallback, useEffect, useState } from 'react';
import api from '../api';

const join = (values) => (Array.isArray(values) && values.length ? values.join(' / ') : '—');
const parseUrls = (text) => Array.from(new Set(String(text || '').split(/\s+/).map((u) => u.trim()).filter(Boolean)));

export default function EveryMacImportAdmin() {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [imported, setImported] = useState(null);
  const [pending, setPending] = useState([]);

  const load = useCallback(async () => {
    try {
      const [list, pend] = await Promise.all([api.get('/apple-catalog/everymac'), api.get('/apple-catalog/pending')]);
      setImported(list);
      setPending(Array.isArray(pend) ? pend : []);
    } catch (error) {
      setMessage(error?.message || 'No se pudo cargar el estado de importaciones.');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async (save) => {
    const urls = parseUrls(text);
    if (!urls.length) {
      setMessage('Pega uno o más enlaces de fichas de EveryMac (uno por línea).');
      return;
    }
    setBusy(true);
    setMessage(save ? 'Importando…' : 'Leyendo fichas (una por enlace, con pausa entre cada una)…');
    try {
      const result = await api.post(save ? '/apple-catalog/everymac/import' : '/apple-catalog/everymac/preview', { urls });
      setPreview(result);
      if (save) {
        setMessage(`Guardadas ${result?.saved || 0} ficha(s). Los formularios ya muestran los cambios.`);
        setText('');
        await load();
      } else setMessage('');
    } catch (error) {
      setMessage(error?.message || 'No se pudo procesar los enlaces.');
    } finally {
      setBusy(false);
    }
  };

  const disable = async (id) => {
    if (!window.confirm('¿Quitar esta ficha importada del catálogo?')) return;
    await api.del(`/apple-catalog/everymac/${id}`);
    await load();
  };

  const results = preview?.results || [];
  const canImport = preview?.mode === 'preview' && results.some((r) => r.ok);
  return (
    <div className="bg-white border rounded-xl shadow p-4 space-y-3 md:col-span-2">
      <div>
        <h2 className="text-lg font-semibold">Agregar productos desde EveryMac</h2>
        <p className="text-xs text-gray-500">Pega los enlaces de las fichas (p. ej. una por cada pantalla/configuración de un MacBook nuevo). Se leen una sola vez y quedan guardados en la base de datos.</p>
      </div>
      <textarea
        aria-label="Enlaces de EveryMac"
        value={text}
        onChange={(e) => { setText(e.target.value); setPreview(null); }}
        rows={4}
        className="w-full border rounded p-2 font-mono text-xs"
        placeholder="https://everymac.com/systems/apple/macbook-air/specs/...-specs.html"
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => run(false)} disabled={busy || !text.trim()} className="px-3 py-2 rounded border text-sm disabled:opacity-50">Previsualizar</button>
        <button type="button" onClick={() => run(true)} disabled={busy || !canImport} className="px-3 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-50">Importar a la base de datos</button>
      </div>
      {message && <div className="text-sm rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">{message}</div>}

      {results.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pr-3">Modelo</th><th className="pr-3">Chip</th><th className="pr-3">Pantalla / caja</th><th className="pr-3">Conectividad</th><th className="pr-3">RAM</th><th className="pr-3">Almacenamiento</th><th>Avisos</th>
              </tr>
            </thead>
            <tbody>
              {results.map((row) => (
                <tr key={row.url} className="border-t align-top">
                  <td className="pr-3">
                    {row.ok ? <strong>{row.title}</strong> : <span className="text-red-700">{row.error || 'No reconocido'}</span>}
                    {row.ok && row.nuevo && <span className="ml-1 rounded bg-emerald-100 px-1 text-emerald-800">nuevo</span>}
                    <div className="text-gray-400 break-all">{row.url}</div>
                  </td>
                  <td className="pr-3">{row.config?.chip || '—'}{row.config?.nucleos ? <div className="text-gray-400">{row.config.nucleos}</div> : null}</td>
                  <td className="pr-3">{row.config?.pantalla ? `${row.config.pantalla}″` : row.config?.caja || '—'}</td>
                  <td className="pr-3">{row.config?.conectividad || '—'}</td>
                  <td className="pr-3">{join(row.config?.ram)}</td>
                  <td className="pr-3">{join(row.config?.almacenamiento)}</td>
                  <td className="text-amber-700">{(row.warnings || []).join(' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview?.diff && <p className="mt-1 text-xs text-gray-500">Modelos nuevos: {preview.diff.added?.length || 0} · actualizados: {preview.diff.changed?.length || 0}</p>}
        </div>
      )}

      {pending.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Lanzamientos detectados por AppleDB sin ficha cargada ({pending.length})</summary>
          <ul className="mt-2 text-xs text-gray-700 list-disc list-inside">
            {pending.map((m) => <li key={m.id}>{m.title} · {m.released || 'sin fecha'}</li>)}
          </ul>
        </details>
      )}

      {imported && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Fichas importadas ({imported.imported?.length || 0}) · semilla incluida: {imported.seed}</summary>
          <ul className="mt-2 space-y-1 text-xs">
            {(imported.imported || []).map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2">
                <span className={row.active ? '' : 'line-through text-gray-400'}>{row.title}</span>
                {row.active && <button type="button" onClick={() => disable(row.id)} className="text-red-700 hover:underline">Quitar</button>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
