// src/components/ModalTracking.js
import React, { useState, useEffect } from 'react';
import api from '../api';

export default function ModalTracking({ producto, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [trackRec, setTrackRec] = useState(null);

  // Campos
  const [trackingUsa, setTrackingUsa] = useState('');
  const [transportista, setTransportista] = useState('');
  const [casillero, setCasillero] = useState('');
  const [trackingEshop, setTrackingEshop] = useState('');
  const [fechaRecepcion, setFechaRecepcion] = useState('');
  const [fechaRecogido, setFechaRecogido] = useState('');

  // Subpaso local cuando estamos en "comprado_sin_tracking"
  const [subPasoUsa] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const hydrateFromTracking = (data = {}) => {
    setTrackingUsa(data.trackingUsa || '');
    setTransportista(data.transportista || '');
    setCasillero(data.casillero || '');
    setTrackingEshop(data.trackingEshop || '');
    setFechaRecepcion(data.fechaRecepcion || '');
    setFechaRecogido(data.fechaRecogido || '');
  };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/tracking/producto/${producto.id}`);

        if (data) {
          setTrackRec(data);
          hydrateFromTracking(data);
        }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [producto.id]);

  const estado = trackRec?.estado ?? 'comprado_sin_tracking';

  // Determinar "etapa visual" (1 a 4)
  const etapa =
    estado === 'recogido' ? 4
      : estado === 'en_eshopex' ? 3
        : estado === 'comprado_en_camino' ? 2
          : 1;

  // Helpers de links
  const buildCarrierLink = () => {
    const code = (trackingUsa || '').trim();
    if (!code) return null;
    const t = (transportista || '').toUpperCase();
    if (t === 'UPS') return `https://www.ups.com/track?track=yes&trackNums=${encodeURIComponent(code)}`;
    if (t === 'USPS') return `https://tools.usps.com/go/TrackConfirmAction?qtc_tLabels1=${encodeURIComponent(code)}`;
    if (t === 'FEDEX') return `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(code)}`;
    return null;
  };

  const buildEshopLink = () => {
    const code = (trackingEshop || '').trim();
    if (!code) return null;
    return `https://usamybox.com/internacional/tracking_box.php?nrotrack=${encodeURIComponent(code)}`;
  };

  const cancelarEdicion = () => {
    hydrateFromTracking(trackRec || {});
    setEditMode(false);
  };

  const normalizeBody = (body = {}, { allowEmpty = false } = {}) => {
    const cleanText = (v) => {
      if (v == null) return undefined;
      const s = String(v).trim();
      if (!s.length) return allowEmpty ? '' : undefined;
      return s;
    };
    const fecha = (v) => {
      if (!v) return null;
      return v;
    };
    return {
      trackingUsa: cleanText(body.trackingUsa),
      transportista: cleanText(body.transportista),
      casillero: cleanText(body.casillero),
      trackingEshop: cleanText(body.trackingEshop),
      fechaRecepcion: fecha(body.fechaRecepcion),
      fechaRecogido: fecha(body.fechaRecogido),
      estado: body.estado,
    };
  };

  const guardar = async (body) => {
    try {
    const payload = normalizeBody(body, { allowEmpty: Boolean(body?.__allowEmpty) });
      const exists = !!trackRec?.id;
      const saved = exists
        ? await api.patch(`/tracking/${trackRec.id}`, payload)
        : await api.post('/tracking', { productoId: producto.id, ...payload });

      setTrackRec(saved);
      return saved;
    } catch (e) {
      alert('No se pudo guardar el tracking');
      return null;
    }
  };

  // Refresca la tabla (via onSaved) y cierra el modal
  const afterSave = async (saved) => {
    if (!saved) return;
    try {
      if (typeof onSaved === 'function') {
        await onSaved(saved); // el padre hara el re-fetch
      }
    } catch (_) { }
    onClose();
  };

  const actionGuardarEdicion = async () => {
    const saved = await guardar({
      trackingUsa,
      transportista,
      casillero,
      trackingEshop,
      fechaRecepcion,
      fechaRecogido,
      __allowEmpty: true,
    });
    await afterSave(saved);
  };

  // Acciones
  const actionGuardarUsa = async () => {
    const saved = await guardar({ trackingUsa, transportista, casillero });
    await afterSave(saved);   // refresca lista y cierra modal
  };

  const actionGuardarEshop = async () => {
    // Forzamos estado porque en Eshopex no hay transportista
    const saved = await guardar({
      trackingEshop,
      fechaRecepcion,
      estado: 'en_eshopex',
    });
    await afterSave(saved);
  };

  const actionMarcarRecogido = async () => {
    const saved = await guardar({ fechaRecogido });
    await afterSave(saved);
  };

  const actionResetTracking = async () => {
    if (!trackRec?.id) return;
    const ok = window.confirm('Reiniciar tracking a "Sin Tracking"?');
    if (!ok) return;
    const saved = await guardar({
      trackingUsa: '',
      transportista: '',
      trackingEshop: '',
      fechaRecepcion: null,
      fechaRecogido: null,
      __allowEmpty: true,
    });
    setEditMode(false);
    await afterSave(saved);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">Cargando datos de tracking.</div>
      </div>
    );
  }

  const renderAccionesLinea = (primaryButton) => (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
      <button
        className="px-3 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50"
        onClick={actionResetTracking}
      >
        Cancelar tracking
      </button>
      <button
        className="px-3 py-2 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
        onClick={() => setEditMode(true)}
      >
        Editar
      </button>
      {primaryButton}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
        <button
          className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center text-2xl font-bold text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
          onClick={onClose}
          aria-label="Cerrar"
        >
          &times;
        </button>

        {/* Encabezado con estado */}
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Tracking de Producto #{producto.id}</h2>
          <p className="text-sm text-gray-700 mt-1">
            {estado === 'comprado_sin_tracking' && 'Comprado (Sin Tracking)'}
            {estado === 'comprado_en_camino' && 'Comprado (En Camino)'}
            {estado === 'en_eshopex' && 'En Eshopex (Camino Lima)'}
            {estado === 'recogido' && 'Recogido'}
          </p>
        </div>

        {/* Etapas */}
        <div className="text-xs mb-4">Etapa {etapa} / 4</div>

        {/* Bloque de edicion manual */}
        {editMode && (
          <div className="mb-6 border rounded p-4 bg-gray-50">
            <h3 className="font-medium mb-3">Editar tracking manualmente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking USA</label>
                <input className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={trackingUsa}
                  onChange={e => setTrackingUsa(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Transportista</label>
                <select className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={transportista}
                  onChange={e => setTransportista(e.target.value)}>
                  <option value="">Selecciona</option>
                  <option value="USPS">USPS</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Casillero</label>
                <select className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={casillero}
                  onChange={e => setCasillero(e.target.value)}>
                  <option value="">Selecciona</option>
                  <option>Walter</option>
                  <option>Renato</option>
                  <option>Christian</option>
                  <option>Alex</option>
                  <option>MamaRen</option>
                  <option>Jorge</option>
                  <option>Kenny</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Tracking Eshopex</label>
                <input className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={trackingEshop}
                  onChange={e => setTrackingEshop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recepcion</label>
                <input type="date" className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recogido</label>
                <input type="date" className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={fechaRecogido}
                  onChange={e => setFechaRecogido(e.target.value)} />
              </div>
            </div>

            {/* Links para referencia */}
            <div className="mt-3 space-y-1 text-sm">
              {buildCarrierLink() && (
                <div>
                  <a href={buildCarrierLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Ver Tracking (Transportista)
                  </a>
                </div>
              )}
              {buildEshopLink() && (
                <div>
                  <a href={buildEshopLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Ver Tracking (Eshopex)
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={cancelarEdicion}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100"
              >
                Cancelar edicion
              </button>
              <div className="flex gap-2">
                <button
                  onClick={actionResetTracking}
                  className="px-4 py-2 rounded border border-red-200 text-red-700 hover:bg-red-50"
                >
                  Reiniciar a Sin Tracking
                </button>
                <button
                  onClick={actionGuardarEdicion}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  Guardar cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === Vista 1: Comprado (Sin Tracking) === */}
        {!editMode && (estado === 'comprado_sin_tracking') && !subPasoUsa && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking USA</label>
                <input className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={trackingUsa}
                  onChange={e => setTrackingUsa(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Transportista</label>
                <select className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={transportista}
                  onChange={e => setTransportista(e.target.value)}>
                  <option value="">Selecciona</option>
                  <option value="USPS">USPS</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium">Casillero</label>
                <select className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={casillero}
                  onChange={e => setCasillero(e.target.value)}>
                  <option value="">Selecciona</option>
                  <option>Walter</option>
                  <option>Renato</option>
                  <option>Christian</option>
                  <option>Alex</option>
                  <option>MamaRen</option>
                  <option>Jorge</option>
                  <option>Kenny</option>
                </select>
              </div>
            </div>

            {/* Link del transportista si hay codigo */}
            {buildCarrierLink() && (
              <div className="mt-3 text-sm">
                <a
                  href={buildCarrierLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Ver Tracking (Transportista)
                </a>
              </div>
            )}

            {renderAccionesLinea(
              <button
                onClick={actionGuardarUsa}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Comprado (En Camino)
              </button>
            )}
          </>
        )}

        {/* Subpaso al continuar desde comprado_sin_tracking: pedir eshop/fecha */}
        {!editMode && (estado === 'comprado_sin_tracking') && subPasoUsa && (
          <>
            <h3 className="font-medium mb-2">Registrar Eshopex</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking Eshopex</label>
                <input className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={trackingEshop}
                  onChange={e => setTrackingEshop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recepcion</label>
                <input type="date" className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)} />
              </div>
            </div>

            {buildEshopLink() && (
              <div className="mt-3 text-sm">
                <a
                  href={buildEshopLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Ver Tracking (Eshopex)
                </a>
              </div>
            )}

            {renderAccionesLinea(
              <button
                onClick={actionGuardarEshop}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar En Eshopex
              </button>
            )}
          </>
        )}

        {/* === Vista 2: Comprado (En Camino) - pedir eshop/fecha === */}
        {!editMode && (estado === 'comprado_en_camino') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking Eshopex</label>
                <input className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={trackingEshop}
                  onChange={e => setTrackingEshop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recepcion</label>
                <input type="date" className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  value={fechaRecepcion}
                  onChange={e => setFechaRecepcion(e.target.value)} />
              </div>
            </div>

            {/* Links */}
            {buildCarrierLink() && (
              <div className="mt-3 text-sm">
                <a href={buildCarrierLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Ver Tracking (Transportista)
                </a>
              </div>
            )}
            {buildEshopLink() && (
              <div className="mt-1 text-sm">
                <a href={buildEshopLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Ver Tracking (Eshopex)
                </a>
              </div>
            )}

            {renderAccionesLinea(
              <button
                onClick={actionGuardarEshop}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar En Eshopex
              </button>
            )}
          </>
        )}

        {/* === Vista 3: En Eshopex (Camino Lima) - pedir fecha recogido === */}
        {!editMode && (estado === 'en_eshopex') && (
          <>
            {/* Fecha de recepcion (solo lectura) */}
            <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200">
              <div className="text-sm text-amber-900">
                <span className="font-semibold">Fecha de Recepcion: </span>
                {fechaRecepcion
                  ? new Date(fechaRecepcion).toLocaleDateString('es-PE', { timeZone: 'UTC' })
                  : '-'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Fecha de Recogido</label>
              <input
                type="date"
                className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={fechaRecogido}
                onChange={e => setFechaRecogido(e.target.value)}
              />
            </div>

            {buildCarrierLink() && (
              <div className="mt-3 text-sm">
                <a href={buildCarrierLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Ver Tracking (Transportista)
                </a>
              </div>
            )}
            {buildEshopLink() && (
              <div className="mt-1 text-sm">
                <a href={buildEshopLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Ver Tracking (Eshopex)
                </a>
              </div>
            )}

            {renderAccionesLinea(
              <button
                onClick={actionMarcarRecogido}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Marcar Recogido
              </button>
            )}
          </>
        )}

        {/* === Vista 4: Recogido (solo lectura con todo) === */}
        {!editMode && (estado === 'recogido') && (
          <>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Tracking USA:</strong> {trackingUsa || '-'}</li>
              <li><strong>Transportista:</strong> {transportista || '-'}</li>
              <li><strong>Casillero:</strong> {casillero || '-'}</li>
              <li><strong>Tracking Eshopex:</strong> {trackingEshop || '-'}</li>
              <li><strong>Fecha Recepcion:</strong> {fechaRecepcion || '-'}</li>
              <li><strong>Fecha Recogido:</strong> {fechaRecogido || '-'}</li>
            </ul>

            {/* Links */}
            <div className="mt-3 space-y-1 text-sm">
              {buildCarrierLink() && (
                <div>
                  <a href={buildCarrierLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Ver Tracking (Transportista)
                  </a>
                </div>
              )}
              {buildEshopLink() && (
                <div>
                  <a href={buildEshopLink()} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    Ver Tracking (Eshopex)
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                className="px-3 py-2 rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                onClick={() => setEditMode(true)}
              >
                Editar
              </button>
              <button className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
