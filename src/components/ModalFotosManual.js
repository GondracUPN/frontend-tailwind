// src/components/ModalFotosManual.js
// Permite consultar fotos de Eshopex ingresando tracking y fecha sin guardar nada.
import React from 'react';

function toMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr);
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length >= 3) {
      const [d, m, y] = parts;
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      return `${mm}${dd}${y}`;
    }
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${m}${d}${y}`;
  }
  try {
    const dt = new Date(s);
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    const yyyy = dt.getFullYear();
    if (!isNaN(dt.getTime())) return `${mm}${dd}${yyyy}`;
  } catch {}
  return '';
}

export default function ModalFotosManual({ onClose }) {
  const [trackingEshop, setTrackingEshop] = React.useState('');
  const [fechaRecepcion, setFechaRecepcion] = React.useState('');
  const [urls, setUrls] = React.useState([]);
  const [current, setCurrent] = React.useState(1);
  const [attempts, setAttempts] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [ready, setReady] = React.useState(true);
  const [searched, setSearched] = React.useState(false);

  const handleBuscar = React.useCallback(() => {
    setSearched(true);
    const track = trackingEshop.trim();
    const folder = toMMDDYYYY(fechaRecepcion);
    if (!track || !folder) {
      setUrls([]);
      setAttempts([]);
      setCurrent(1);
      setReady(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setReady(false);
    const makeUrl = (i) =>
      `https://correoscostarica.eshopex.com/appdocs/ImageProducts/PCT_ESHOPEX/${folder}/${track}_${i}.jpg`;
    const candidates = [1, 2, 3, 4];
    setAttempts(candidates.map((i) => makeUrl(i)));
    setUrls([]);
    setCurrent(1);

    let remaining = candidates.length;
    const loaded = [];
    const finish = () => {
      loaded.sort((a, b) => a.i - b.i);
      setUrls(loaded);
      setCurrent(loaded.length ? loaded[0].i : 1);
      setReady(true);
      setLoading(false);
    };

    candidates.forEach((i) => {
      const img = new Image();
      img.onload = () => {
        loaded.push({ i, url: makeUrl(i) });
        if (--remaining === 0) finish();
      };
      img.onerror = () => {
        if (--remaining === 0) finish();
      };
      img.src = makeUrl(i);
    });
  }, [trackingEshop, fechaRecepcion]);

  const currentUrl = urls.find((u) => u.i === current)?.url || '';
  const hasCurrent = Boolean(currentUrl);
  const missingData = searched && (!trackingEshop.trim() || !toMMDDYYYY(fechaRecepcion));

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-3xl rounded-xl shadow-lg p-4 relative mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          x
        </button>

        <h3 className="text-lg font-semibold mb-2">Fotos Eshopex</h3>
        <p className="text-xs text-gray-600 mb-4">
          Ingresa el tracking Eshopex y la fecha de recepcion. No se guardan en el producto, solo
          sirven para consultar las imagenes disponibles.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Tracking Eshopex
            <input
              type="text"
              className="mt-1 w-full border rounded px-3 py-2"
              placeholder="Ej. 123456789"
              value={trackingEshop}
              onChange={(e) => setTrackingEshop(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Fecha de recepcion
            <input
              type="date"
              className="mt-1 w-full border rounded px-3 py-2"
              value={fechaRecepcion}
              onChange={(e) => setFechaRecepcion(e.target.value)}
            />
          </label>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleBuscar}
            className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Buscar fotos'}
          </button>
          <span className="text-xs text-gray-500">Solo lectura, no se almacena la informacion.</span>
        </div>

        {!searched ? (
          <div className="text-center py-12 text-gray-500">
            Ingresa los datos y presiona &quot;Buscar fotos&quot; para ver las imagenes.
          </div>
        ) : !ready && loading ? (
          <div className="text-center py-12 text-gray-500">Buscando fotos...</div>
        ) : hasCurrent ? (
          <>
            <div className="mb-2 text-xs text-gray-600">
              <span className="font-semibold">Mostrando:</span>{' '}
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline"
              >
                {currentUrl}
              </a>
            </div>

            <div className="flex items-center gap-2 mb-3">
              {urls.map((u) => (
                <button
                  key={u.i}
                  onClick={() => setCurrent(u.i)}
                  className={`px-3 py-1 rounded border ${
                    current === u.i
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {u.i}
                </button>
              ))}
            </div>

            <div className="w-full max-h-[70vh] overflow-auto flex items-center justify-center border rounded">
              <img
                src={currentUrl}
                alt={`Foto ${current}`}
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 text-xs text-gray-600">
              <div className="font-semibold">Intentos:</div>
              {attempts.length ? (
                <ul className="list-disc list-inside space-y-1">
                  {attempts.map((u, idx) => (
                    <li key={idx} className="truncate">
                      <a
                        href={u}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 underline"
                      >
                        {u}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-gray-500">Ingresa tracking y fecha para generar los enlaces.</div>
              )}
            </div>
            <div className="text-center py-12 text-gray-500">
              {missingData
                ? 'Ingresa tracking y fecha validos para buscar fotos.'
                : 'No hay imagenes disponibles con los datos ingresados.'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
