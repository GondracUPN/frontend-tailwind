// src/components/ModalMarcaAgua.js
import React from 'react';

const DEFAULT_WATERMARK_URL = `${process.env.PUBLIC_URL || ''}/logo.png`;
const OUTPUT_PRESETS = [
  {
    id: 'general',
    label: '2K general',
    detail: 'lado mayor 2048px',
    maxDim: 2048,
    quality: 0.98,
    sharpen: 0.24,
    exactMax: true,
    enhance: { contrast: 1.045, saturation: 1.035, brightness: 1.01 },
  },
  {
    id: 'max',
    label: 'Maxima calidad',
    detail: 'hasta 4K',
    maxDim: 3840,
    quality: 0.98,
    sharpen: 0.08,
    exactMax: false,
    enhance: { contrast: 1.02, saturation: 1.015, brightness: 1 },
  },
];

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = (err) => reject(err);
  img.src = src;
});

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const imageWidth = (img) => img?.naturalWidth || img?.width || 1;
const imageHeight = (img) => img?.naturalHeight || img?.height || 1;

const buildOutputName = (name) => {
  if (!name) return 'foto-marca-agua.jpg';
  const parts = name.split('.');
  if (parts.length <= 1) return `${name}-marca-agua.jpg`;
  parts.pop();
  return `${parts.join('.')}-marca-agua.jpg`;
};

const drawImageHighQuality = (ctx, img, outWidth, outHeight) => {
  const srcWidth = imageWidth(img);
  const srcHeight = imageHeight(img);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (outWidth === srcWidth && outHeight === srcHeight) {
    ctx.drawImage(img, 0, 0);
    return;
  }

  let current = document.createElement('canvas');
  current.width = srcWidth;
  current.height = srcHeight;
  let currentCtx = current.getContext('2d');
  currentCtx.imageSmoothingEnabled = true;
  currentCtx.imageSmoothingQuality = 'high';
  currentCtx.drawImage(img, 0, 0);

  while (current.width * 0.5 > outWidth && current.height * 0.5 > outHeight) {
    const next = document.createElement('canvas');
    next.width = Math.max(outWidth, Math.round(current.width * 0.5));
    next.height = Math.max(outHeight, Math.round(current.height * 0.5));
    const nextCtx = next.getContext('2d');
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = 'high';
    nextCtx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
    currentCtx = nextCtx;
  }

  while (current.width * 1.5 < outWidth && current.height * 1.5 < outHeight) {
    const next = document.createElement('canvas');
    next.width = Math.min(outWidth, Math.round(current.width * 1.5));
    next.height = Math.min(outHeight, Math.round(current.height * 1.5));
    const nextCtx = next.getContext('2d');
    nextCtx.imageSmoothingEnabled = true;
    nextCtx.imageSmoothingQuality = 'high';
    nextCtx.drawImage(current, 0, 0, next.width, next.height);
    current = next;
    currentCtx = nextCtx;
  }

  ctx.drawImage(current, 0, 0, outWidth, outHeight);
};

const sharpenCanvas = (ctx, width, height, amount) => {
  const strength = clamp(Number(amount) || 0, 0, 0.4);
  if (!strength) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const src = imageData.data;
    const out = new Uint8ClampedArray(src);
    const centerWeight = 1 + (4 * strength);

    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = (y * width + x) * 4;
        const left = idx - 4;
        const right = idx + 4;
        const top = idx - width * 4;
        const bottom = idx + width * 4;

        for (let c = 0; c < 3; c += 1) {
          out[idx + c] = clamp(
            (src[idx + c] * centerWeight) -
              ((src[left + c] + src[right + c] + src[top + c] + src[bottom + c]) * strength),
            0,
            255,
          );
        }
      }
    }

    imageData.data.set(out);
    ctx.putImageData(imageData, 0, 0);
  } catch {
    // Canvas may reject pixel access for some image sources; keep the resized output.
  }
};

const enhanceCanvas = (ctx, width, height, options = {}) => {
  const contrast = clamp(Number(options.contrast) || 1, 0.8, 1.2);
  const saturation = clamp(Number(options.saturation) || 1, 0.8, 1.25);
  const brightness = clamp(Number(options.brightness) || 1, 0.9, 1.12);
  if (contrast === 1 && saturation === 1 && brightness === 1) return;

  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const contrastOffset = 128 * (1 - contrast);

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i] * brightness;
      let g = data[i + 1] * brightness;
      let b = data[i + 2] * brightness;

      r = (r * contrast) + contrastOffset;
      g = (g * contrast) + contrastOffset;
      b = (b * contrast) + contrastOffset;

      const gray = (r * 0.299) + (g * 0.587) + (b * 0.114);
      data[i] = clamp(gray + ((r - gray) * saturation), 0, 255);
      data[i + 1] = clamp(gray + ((g - gray) * saturation), 0, 255);
      data[i + 2] = clamp(gray + ((b - gray) * saturation), 0, 255);
    }

    ctx.putImageData(imageData, 0, 0);
  } catch {
    // Keep resized output if the browser blocks pixel access.
  }
};

async function applyWatermark(file, watermarkImg, { opacity, scale, maxDim, quality, sharpen, exactMax, enhance }) {
  const baseUrl = URL.createObjectURL(file);
  try {
    const baseImg = await loadImage(baseUrl);
    const targetMax = Math.max(1, Number(maxDim) || 0);
    const baseWidth = imageWidth(baseImg);
    const baseHeight = imageHeight(baseImg);
    const baseMax = Math.max(baseWidth, baseHeight);
    const factor = targetMax > 0
      ? (exactMax ? targetMax / baseMax : Math.min(1, targetMax / baseMax))
      : 1;
    const outWidth = Math.max(1, Math.round(baseWidth * factor));
    const outHeight = Math.max(1, Math.round(baseHeight * factor));
    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas context');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outWidth, outHeight);
    drawImageHighQuality(ctx, baseImg, outWidth, outHeight);
    enhanceCanvas(ctx, outWidth, outHeight, enhance);
    if (factor !== 1) sharpenCanvas(ctx, outWidth, outHeight, sharpen);

    const wmScale = clamp(scale, 0.05, 1);
    const wmSourceWidth = imageWidth(watermarkImg);
    const wmSourceHeight = imageHeight(watermarkImg);
    const wmWidth = outWidth * wmScale;
    const wmHeight = (wmSourceHeight * wmWidth) / wmSourceWidth;
    const x = (outWidth - wmWidth) / 2;
    const y = (outHeight - wmHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = clamp(opacity, 0.1, 1);
    ctx.drawImage(watermarkImg, x, y, wmWidth, wmHeight);
    ctx.globalAlpha = 1;

    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', clamp(Number(quality) || 0.96, 0.9, 1));
    });
    if (!blob) throw new Error('No output blob');
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(baseUrl);
  }
}

export default function ModalMarcaAgua({ onClose }) {
  const [images, setImages] = React.useState([]);
  const [watermarkFile, setWatermarkFile] = React.useState(null);
  const [outputs, setOutputs] = React.useState([]);
  const [previewItem, setPreviewItem] = React.useState(null);
  const [processing, setProcessing] = React.useState(false);
  const [opacity, setOpacity] = React.useState(0.5);
  const [scale, setScale] = React.useState(1);
  const [outputPresetId, setOutputPresetId] = React.useState('general');
  const outputPreset = OUTPUT_PRESETS.find((preset) => preset.id === outputPresetId) || OUTPUT_PRESETS[0];
  const maxDim = outputPreset.maxDim;
  const [watermarkError, setWatermarkError] = React.useState('');
  const prevUrlsRef = React.useRef([]);

  const loadWatermark = React.useCallback(async () => {
    if (watermarkFile) {
      const wmUrl = URL.createObjectURL(watermarkFile);
      try {
        return await loadImage(wmUrl);
      } finally {
        URL.revokeObjectURL(wmUrl);
      }
    }
    try {
      return await loadImage(DEFAULT_WATERMARK_URL);
    } catch (err) {
      return null;
    }
  }, [watermarkFile]);

  React.useEffect(() => {
    prevUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    prevUrlsRef.current = outputs.map((o) => o.url);
  }, [outputs]);

  React.useEffect(() => {
    let active = true;
    const run = async () => {
      if (!images.length) {
        setOutputs([]);
        return;
      }
      setProcessing(true);
      setWatermarkError('');
      try {
        const wmImg = await loadWatermark();
        if (!wmImg) {
          if (active) {
            setOutputs([]);
          setWatermarkError('No se encontro marca de agua. Sube un logo o agrega public/logo.png');
          }
          return;
        }
        const results = [];
        for (const file of images) {
          if (!active) return;
          const url = await applyWatermark(file, wmImg, {
            opacity,
            scale,
            maxDim,
            quality: outputPreset.quality,
            sharpen: outputPreset.sharpen,
            exactMax: outputPreset.exactMax,
            enhance: outputPreset.enhance,
          });
          results.push({ name: buildOutputName(file.name), url });
        }
        if (active) setOutputs(results);
      } catch (err) {
        if (active) {
          setOutputs([]);
          setWatermarkError('No se pudo procesar las imagenes.');
        }
      } finally {
        if (active) setProcessing(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [images, loadWatermark, opacity, scale, maxDim, outputPreset.quality, outputPreset.sharpen, outputPreset.exactMax, outputPreset.enhance]);

  React.useEffect(() => () => {
    prevUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const handleWatermarkChange = (e) => {
    const file = e.target.files?.[0] || null;
    setWatermarkFile(file);
  };

  const downloadAll = () => {
    outputs.forEach((item, idx) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = item.name;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, idx * 120);
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-4xl max-h-[92vh] sm:max-h-[90vh] rounded-xl shadow-lg relative mx-auto flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b">
          <h3 className="text-lg font-semibold">Marca de agua</h3>
          <button
            className="w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
            onClick={onClose}
            aria-label="Cerrar"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div className="rounded-2xl border border-dashed border-emerald-400/60 bg-emerald-50/60 p-4 sm:p-6">
                <div className="text-sm font-semibold text-emerald-900">Fotos</div>
                <div className="text-xs text-emerald-800 mt-1">Arrastra o haz clic para cargar varias imagenes</div>
                <div className="mt-3 relative">
                  <div className="h-32 sm:h-40 rounded-xl bg-white/80 ring-1 ring-emerald-200 flex flex-col items-center justify-center text-sm text-emerald-700">
                    <div className="font-semibold">
                      {images.length ? `${images.length} archivos seleccionados` : 'Seleccionar imagenes'}
                    </div>
                    <div className="text-xs text-emerald-600 mt-1">PNG, JPG, WEBP</div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    onChange={handleImagesChange}
                    aria-label="Seleccionar fotos"
                  />
                </div>
                {images.length > 0 && (
                  <div className="mt-3 text-xs text-emerald-900">
                    {images.slice(0, 3).map((f) => f.name).join(', ')}
                    {images.length > 3 ? ` y ${images.length - 3} mas...` : ''}
                  </div>
                )}
              </div>

              <label className="block text-sm font-medium">
                Logo de marca de agua (opcional si ya existe public/logo.png)
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm"
                  onChange={handleWatermarkChange}
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
                <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  2K general reescala a 2048px y mejora nitidez, contraste y color de forma suave para publicar. Maxima calidad conserva mas detalle para casos puntuales.
                </div>
                <div>
                  <div className="mb-2 text-sm font-medium">Calidad de salida</div>
                  <div className="grid grid-cols-2 gap-2">
                    {OUTPUT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setOutputPresetId(preset.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                          outputPresetId === preset.id
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block font-semibold">{preset.label}</span>
                        <span className="block text-xs opacity-75">{preset.detail}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <label className="block text-sm font-medium">
                  Opacidad: {Math.round(opacity * 100)}%
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={opacity}
                    onChange={(e) => setOpacity(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </label>

                <label className="block text-sm font-medium">
                  Tamano maximo del logo: {Math.round(scale * 100)}%
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(Number(e.target.value))}
                    className="mt-2 w-full"
                  />
                </label>
              </div>
            </div>

            <div className="border rounded-2xl bg-white p-3 sm:p-4 flex flex-col min-h-[320px] max-h-[62vh]">
              <div className="text-sm font-semibold text-gray-800 mb-2">Vista previa</div>
              {watermarkError && (
                <div className="mb-2 text-sm text-red-600">{watermarkError}</div>
              )}
              <div className="flex-1 overflow-auto pr-1">
                {outputs.length === 0 ? (
                  <div className="text-sm text-gray-500 py-10 text-center">
                    Selecciona fotos para ver la vista previa.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {outputs.map((item, idx) => (
                      <div key={item.url} className="group border rounded-xl overflow-hidden bg-white shadow-sm relative">
                        <button
                          type="button"
                          onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                          className="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 text-gray-700 shadow-sm opacity-0 group-hover:opacity-100 transition"
                          title="Eliminar"
                          aria-label="Eliminar foto"
                        >
                          &times;
                        </button>
                        <div className="bg-gray-100 h-44 flex items-center justify-center">
                          <button
                            type="button"
                            className="w-full h-full flex items-center justify-center"
                            onClick={() => setPreviewItem(item)}
                            aria-label="Ver foto"
                          >
                            <img src={item.url} alt={item.name} className="max-h-full max-w-full object-contain" />
                          </button>
                        </div>
                        <div className="p-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-gray-600 truncate" title={item.name}>{item.name}</div>
                          <a
                            href={item.url}
                            download={item.name}
                            className="text-sm text-blue-600 underline"
                          >
                            Descargar
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white">
          <div className="flex flex-wrap gap-3">
            <div className="border rounded-lg px-4 py-2 text-sm bg-white shadow-sm">
              <div className="text-gray-500 text-xs">Fotos totales</div>
              <div className="text-lg font-semibold">{images.length}</div>
            </div>
            <div className="border rounded-lg px-4 py-2 text-sm bg-white shadow-sm">
              <div className="text-gray-500 text-xs">Procesadas</div>
              <div className="text-lg font-semibold">{outputs.length}</div>
            </div>
            <div className="text-sm text-gray-600 flex items-center">
              {processing ? 'Procesando...' : `${outputPreset.label} (${outputPreset.detail})`}
            </div>
          </div>
          <button
            onClick={downloadAll}
            disabled={outputs.length === 0}
            className={`${outputs.length === 0 ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-emerald-600 text-white hover:bg-emerald-700'} px-3 py-2 rounded`}
          >
            Descargar todo
          </button>
        </div>
      </div>
      {previewItem ? (
        <div
          className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-5xl w-full max-h-[90vh] p-3 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-medium truncate">{previewItem.name}</div>
              <button
                type="button"
                className="w-9 h-9 rounded-full text-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                onClick={() => setPreviewItem(null)}
                aria-label="Cerrar"
              >
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-100 rounded-lg">
              <img src={previewItem.url} alt={previewItem.name} className="max-h-[75vh] max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
