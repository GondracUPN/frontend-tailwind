// src/components/ModalFotos2.js
import React from 'react';

function toMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr);
  // d/m/yyyy ó dd/mm/yyyy
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length >= 3) {
      const [d, m, y] = parts;
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      return `${mm}${dd}${y}`;
    }
  }
  // yyyy-mm-dd (con o sin tiempo al final, ej: 2025-10-06T05:00:00.000Z)
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${m}${d}${y}`;
  }
  // Fallback: Date.parse
  try {
    const dt = new Date(s);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yyyy = dt.getFullYear();
    if (!isNaN(dt.getTime())) return `${mm}${dd}${yyyy}`;
  } catch {}
  return '';
}

export default function ModalFotos2({ producto, onClose }) {
  const [ready, setReady] = React.useState(false);
  const [urls, setUrls] = React.useState([]);
  const [current, setCurrent] = React.useState(1);
  const [attempts, setAttempts] = React.useState([]);

  React.useEffect(() => {
    if (!producto) return;
    // Usar la fecha de recepción del tracking (no la de compra)
    const recepDate = (() => {
      const arr = Array.isArray(producto?.tracking) ? producto.tracking : [];
      // Preferimos el primer tracking que tenga fechaRecepcion
      for (const t of arr) {
        if (t?.fechaRecepcion) return t.fechaRecepcion;
      }
      return '';
    })();
    const folder = toMMDDYYYY(recepDate || '');
    const tracking = (producto?.tracking || [])
      .map(t => t?.trackingEshop)
      .find(v => v && String(v).trim()) || '';
    if (!folder || !tracking) { setUrls([]); setReady(true); return; }
    const makeUrl = (i) => `https://correoscostarica.eshopex.com/appdocs/ImageProducts/PCT_ESHOPEX/${folder}/${tracking}_${i}.jpg`;
    const candidates = [1,2,3,4];
    const trying = candidates.map((i) => makeUrl(i));
    // eslint-disable-next-line no-console
    console.log('[ModalFotos] abrir:', { folder, tracking });
    // eslint-disable-next-line no-console
    console.log('[ModalFotos] intentos:', trying);
    setAttempts(trying);
    const loaded = [];
    let remaining = candidates.length;
    candidates.forEach(i => {
      const img = new Image();
      img.onload = () => { loaded.push({ i, url: makeUrl(i) }); if (--remaining === 0) done(); };
      img.onerror = () => { if (--remaining === 0) done(); };
      img.src = makeUrl(i);
    });
    function done() {
      loaded.sort((a,b) => a.i - b.i);
      setUrls(loaded);
      setCurrent(loaded.length ? loaded[0].i : 1);
      setReady(true);
    }
  }, [producto]);
  const currentUrl = urls.find(u => u.i === current)?.url || '';
  const hasCurrent = Boolean(currentUrl);
  // índices de imágenes realmente disponibles (1..4), incluyendo la 1 si existe
  const indices = urls.map(u => u.i);

  React.useEffect(() => {
    if (hasCurrent) {
      // eslint-disable-next-line no-console
      console.log('[ModalFotos] mostrando:', currentUrl);
    }
  }, [hasCurrent, currentUrl]);

  if (!producto) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-3xl rounded-xl shadow-lg p-4 relative mx-4" onClick={(e) => e.stopPropagation()}>
        <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-800" onClick={onClose}>x</button>
        <h3 className="text-lg font-semibold mb-3">Fotos Es - {producto?.tipo || ''}</h3>

        {!ready ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : hasCurrent ? (
          <>
            <div className="mb-2 text-xs text-gray-600">
              <span className="font-semibold">Mostrando:</span>{' '}
              <a href={currentUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{currentUrl}</a>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {indices.map(i => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`px-3 py-1 rounded border ${current===i? 'bg-indigo-600 text-white border-indigo-600':'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="w-full max-h-[70vh] overflow-auto flex items-center justify-center border rounded">
              <img src={currentUrl} alt={`Foto ${current}`} className="max-w-full max-h-[70vh] object-contain" />
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 text-xs text-gray-600">
              <div className="font-semibold">Mostrando:</div>
              <div className="truncate">
                <a href={currentUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">{currentUrl}</a>
              </div>
              {attempts?.length ? (
                <div className="mt-2">
                  <div className="font-semibold">Intentos:</div>
                  <ul className="list-disc list-inside space-y-1">
                    {attempts.map((u, idx) => (
                      <li key={idx} className="truncate"><a href={u} target="_blank" rel="noreferrer" className="text-blue-600 underline">{u}</a></li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
            <div className="text-center py-16 text-gray-500">No hay imagenes disponibles para este producto.</div>
          </>
        )}
      </div>
    </div>
  );
}
