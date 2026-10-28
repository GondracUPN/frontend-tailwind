import React, { useRef, useState } from 'react';
import { mapSelectionToImage } from '../utils/snImeiOcr';

/** Imagen con selección de zona para «Volver a leer esa zona». La selección se convierte a fracciones de la
 * imagen original (naturalWidth/naturalHeight, ya orientada por el navegador igual que en el backend), así que
 * es independiente del zoom, del scroll y del escalado de la vista. */
export default function OcrCropSelector({ src, alt, fit = 'fill', imgClassName = '', style, disabled = false, onCrop }) {
  const wrapperRef = useRef(null);
  const imgRef = useRef(null);
  const [selecting, setSelecting] = useState(false);
  const [drag, setDrag] = useState(null);
  const [crop, setCrop] = useState(null);

  const point = (event) => ({ x: event.clientX, y: event.clientY });
  const start = (event) => {
    if (!selecting || disabled || !Number.isFinite(event.clientX)) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const p = point(event);
    setCrop(null);
    setDrag({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
  };
  const move = (event) => {
    if (!drag || !Number.isFinite(event.clientX)) return;
    const p = point(event);
    setDrag((current) => (current ? { ...current, x2: p.x, y2: p.y } : current));
  };
  const end = (event) => {
    if (!drag) return;
    const p = Number.isFinite(event.clientX) ? point(event) : { x: drag.x2, y: drag.y2 };
    const selection = { ...drag, x2: p.x, y2: p.y };
    setDrag(null);
    const img = imgRef.current;
    const mapped = img && mapSelectionToImage(selection, img.getBoundingClientRect(), { width: img.naturalWidth, height: img.naturalHeight }, fit);
    setCrop(mapped ? { ...mapped, selection } : null);
  };

  const overlay = (() => {
    const rect = drag || crop?.selection;
    const box = wrapperRef.current?.getBoundingClientRect();
    if (!rect || !box) return null;
    return {
      left: Math.min(rect.x1, rect.x2) - box.left,
      top: Math.min(rect.y1, rect.y2) - box.top,
      width: Math.abs(rect.x2 - rect.x1),
      height: Math.abs(rect.y2 - rect.y1),
    };
  })();

  return (
    <div>
      <div
        ref={wrapperRef}
        data-testid="ocr-crop-area"
        className={`relative ${selecting ? 'cursor-crosshair touch-none select-none' : ''}`}
        style={style}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
      >
        <img ref={imgRef} src={src} alt={alt} draggable={false} className={imgClassName} />
        {overlay && <div className="pointer-events-none absolute border-2 border-amber-400 bg-amber-300/20" style={overlay} />}
      </div>
      <div className="flex flex-wrap items-center gap-2 bg-slate-900 px-2 py-2 text-xs text-white">
        <button
          type="button"
          onClick={() => { setSelecting((value) => !value); setCrop(null); setDrag(null); }}
          disabled={disabled}
          className="rounded bg-white/10 px-2 py-1 font-semibold hover:bg-white/20 disabled:opacity-40"
        >
          {selecting ? 'Cancelar selección' : 'Seleccionar zona'}
        </button>
        {selecting && !crop && <span className="text-slate-300">Arrastra sobre la etiqueta del SN / IMEI.</span>}
        {crop && (
          <button
            type="button"
            onClick={() => { onCrop?.({ x: crop.x, y: crop.y, width: crop.width, height: crop.height }); setSelecting(false); setCrop(null); }}
            disabled={disabled}
            className="rounded bg-amber-400 px-2 py-1 font-semibold text-slate-950 hover:bg-amber-300 disabled:opacity-40"
          >
            Volver a leer esa zona
          </button>
        )}
      </div>
    </div>
  );
}
