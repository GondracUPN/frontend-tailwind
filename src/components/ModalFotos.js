// src/components/ModalFotos.js
// Muestra fotos alojadas en Eshopex usando tracking y fecha de recepción
import React from 'react';

function toMMDDYYYY(dateStr) {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  const compact = s.replace(/[^A-Za-z0-9]/g, '');
  const monthMap = {
    jan: '01', ene: '01',
    feb: '02',
    mar: '03',
    apr: '04', abr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08', ago: '08',
    sep: '09', set: '09',
    oct: '10',
    nov: '11',
    dec: '12', dic: '12',
  };
  const compactMatch = compact.match(/^(\d{1,2})([A-Za-z]{3,})(\d{4})$/);
  if (compactMatch) {
    const dd = String(compactMatch[1]).padStart(2, '0');
    const monToken = compactMatch[2].slice(0, 3).toLowerCase();
    const mm = monthMap[monToken] || '';
    const yyyy = compactMatch[3];
    if (mm) return `${mm}${dd}${yyyy}`;
  }
  const monFirst = s.match(/^([A-Za-z]{3,})\s*[-/ ]?\s*(\d{1,2})\s*[-/ ]?\s*(\d{4})$/);
  if (monFirst) {
    const monToken = monFirst[1].slice(0, 3).toLowerCase();
    const mm = monthMap[monToken] || '';
    const dd = String(monFirst[2]).padStart(2, '0');
    const yyyy = monFirst[3];
    if (mm) return `${mm}${dd}${yyyy}`;
  }
  const monMatch = s.match(/^(\d{1,2})\s*[-/ ]?\s*([A-Za-z]{3,})\s*[-/ ]?\s*(\d{4})$/);
  if (monMatch) {
    const dd = String(monMatch[1]).padStart(2, '0');
    const monToken = monMatch[2].slice(0, 3).toLowerCase();
    const mm = monthMap[monToken] || '';
    const yyyy = monMatch[3];
    if (mm) return `${mm}${dd}${yyyy}`;
  }
  // d/m/yyyy o dd/mm/yyyy
  if (s.includes('/')) {
    const parts = s.split('/');
    if (parts.length >= 3) {
      const [d, m, y] = parts;
      const dd = String(d).padStart(2, '0');
      const mm = String(m).padStart(2, '0');
      return `${mm}${dd}${y}`;
    }
  }
  // yyyy-mm-dd (con o sin tiempo)
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

export default function ModalFotos({ producto, onClose }) {
  const [ready, setReady] = React.useState(false);
  const [urls, setUrls] = React.useState([]);
  const [current, setCurrent] = React.useState(1);
  const [attempts, setAttempts] = React.useState([]);

  React.useEffect(() => {
    if (!producto) return;
    // Preferimos fecha de recepción del tracking (no la de compra)
    const recepDate = (() => {
      const arr = Array.isArray(producto?.tracking) ? producto.tracking : [];
      for (const t of arr) {
        if (t?.fechaRecepcion) return t.fechaRecepcion;
      }
      return '';
    })();
    const folder = toMMDDYYYY(recepDate || '');
    const tracking = (producto?.tracking || [])
      .map((t) => t?.trackingEshop)
      .find((v) => v && String(v).trim()) || '';
    if (!folder || !tracking) {
      setUrls([]);
      setReady(true);
      return;
    }
    const makeUrl = (i) =>
      `https://correoscostarica.eshopex.com/appdocs/ImageProducts/PCT_ESHOPEX/${folder}/${tracking}_${i}.jpg`;
    const candidates = [1, 2, 3, 4];
    const trying = candidates.map((i) => makeUrl(i));
    setAttempts(trying);
    const loaded = [];
    let remaining = candidates.length;
    candidates.forEach((i) => {
      const img = new Image();
      img.onload = () => {
        loaded.push({ i, url: makeUrl(i) });
        if (--remaining === 0) done();
      };
      img.onerror = () => {
        if (--remaining === 0) done();
      };
      img.src = makeUrl(i);
    });
    function done() {
      loaded.sort((a, b) => a.i - b.i);
      setUrls(loaded);
      setCurrent(loaded.length ? loaded[0].i : 1);
      setReady(true);
    }
  }, [producto]);

  const currentUrl = urls.find((u) => u.i === current)?.url || '';
  const hasCurrent = Boolean(currentUrl);
  const indices = urls.map((u) => u.i);

  if (!producto) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[92vh] sm:max-h-[90vh] rounded-xl shadow-lg p-4 sm:p-6 relative mx-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
          onClick={onClose}
          aria-label="Cerrar"
        >
          &times;
        </button>
        <h3 className="text-lg font-semibold mb-3 pr-10">
          Fotos Es - {producto?.tipo || ''}
        </h3>

        {!ready ? (
          <div className="text-center py-16 text-gray-500">Cargando...</div>
        ) : hasCurrent ? (
          <div className="flex flex-col gap-3 flex-1 min-h-0">
            <div className="text-xs sm:text-sm text-gray-600">
              <span className="font-semibold">Mostrando:</span>{' '}
              <a
                href={currentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 underline break-all"
              >
                {currentUrl}
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {indices.map((i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`px-3 py-1 rounded border ${
                    current === i
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>

            <div className="w-full flex-1 min-h-0 overflow-auto flex items-center justify-center border rounded bg-gray-50">
              <img
                src={currentUrl}
                alt={`Foto ${current}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 text-xs sm:text-sm text-gray-600">
              <div className="font-semibold">Mostrando:</div>
              <div className="break-all">
                <a
                  href={currentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 underline"
                >
                  {currentUrl}
                </a>
              </div>
              {attempts?.length ? (
                <div className="mt-2">
                  <div className="font-semibold">Intentos:</div>
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
                </div>
              ) : null}
            </div>
            <div className="text-center py-16 text-gray-500">
              No hay imagenes disponibles para este producto.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
