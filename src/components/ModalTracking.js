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

  // Subpaso local cuando estamos en “comprado_sin_tracking”
  const [subPasoUsa, setSubPasoUsa] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get(`/tracking/producto/${producto.id}`);

        if (data) {
          setTrackRec(data);
          setTrackingUsa(data.trackingUsa || '');
          setTransportista(data.transportista || '');
          setCasillero(data.casillero || '');
          setTrackingEshop(data.trackingEshop || '');
          setFechaRecepcion(data.fechaRecepcion || '');
          setFechaRecogido(data.fechaRecogido || '');
        }
      } catch { /* noop */ }
      setLoading(false);
    })();
  }, [producto.id]);

  const estado = trackRec?.estado ?? 'comprado_sin_tracking';

  // Determinar “etapa visual” (1 a 4)
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

  const guardar = async (body) => {
    try {
      const exists = !!trackRec?.id;
      const saved = exists
        ? await api.patch(`/tracking/${trackRec.id}`, body)
        : await api.post('/tracking', { productoId: producto.id, ...body });

      setTrackRec(saved);
      return saved;
    } catch (e) {
      alert('No se pudo guardar el tracking');
      return null;
    }
  };


  // 🔧 Refresca la tabla (vía onSaved) y cierra el modal
  const afterSave = async (saved) => {
    if (!saved) return;
    try {
      if (typeof onSaved === 'function') {
        await onSaved(saved); // el padre hará el re-fetch
      }
    } catch (_) { }
    onClose(); // se cierra el modal después de guardar
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


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/30 flex items-center justify-center">
        <div className="bg-white p-6 rounded shadow">Cargando datos de tracking…</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg relative">
        <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={onClose}>✖</button>

        {/* Encabezado con estado bonito */}
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

        {/* === Vista 1: Comprado (Sin Tracking) === */}
        {(estado === 'comprado_sin_tracking') && !subPasoUsa && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking USA</label>
                <input className="w-full border p-2 rounded"
                  value={trackingUsa}
                  onChange={e => setTrackingUsa(e.target.value)} />
              </div>

              <div>
                <label className="block text-sm font-medium">Transportista</label>
                <select className="w-full border p-2 rounded"
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
                <select className="w-full border p-2 rounded"
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

            {/* Link del transportista si hay código */}
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

            <div className="mt-6 text-right">
              <button
                onClick={actionGuardarUsa}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Comprado (En Camino)
              </button>
            </div>
          </>
        )}

        {/* Subpaso al continuar desde comprado_sin_tracking: pedir eshop/fecha */}
        {(estado === 'comprado_sin_tracking') && subPasoUsa && (
          <>
            <h3 className="font-medium mb-2">Registrar Eshopex</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking Eshopex</label>
                <input className="w-full border p-2 rounded"
                  value={trackingEshop}
                  onChange={e => setTrackingEshop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recepción</label>
                <input type="date" className="w-full border p-2 rounded"
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

            <div className="mt-6 text-right">
              <button
                onClick={actionGuardarEshop}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar En Eshopex
              </button>
            </div>
          </>
        )}

        {/* === Vista 2: Comprado (En Camino) → pedir eshop/fecha === */}
        {(estado === 'comprado_en_camino') && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium">Tracking Eshopex</label>
                <input className="w-full border p-2 rounded"
                  value={trackingEshop}
                  onChange={e => setTrackingEshop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium">Fecha de Recepción</label>
                <input type="date" className="w-full border p-2 rounded"
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

            <div className="mt-6 text-right">
              <button
                onClick={actionGuardarEshop}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              >
                Guardar En Eshopex
              </button>
            </div>
          </>
        )}

        {/* === Vista 3: En Eshopex (Camino Lima) → pedir fecha recogido === */}
        {(estado === 'en_eshopex') && (
          <>
            {/* Fecha de recepción (solo lectura) */}
            <div className="mb-4 p-3 rounded bg-amber-50 border border-amber-200">
              <div className="text-sm text-amber-900">
                <span className="font-semibold">Fecha de Recepción: </span>
                {fechaRecepcion
                  ? new Date(fechaRecepcion).toLocaleDateString('es-PE', { timeZone: 'UTC' })
                  : '—'}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Fecha de Recogido</label>
              <input
                type="date"
                className="w-full border p-2 rounded"
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

            <div className="mt-6 text-right">
              <button
                onClick={actionMarcarRecogido}
                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              >
                Marcar Recogido
              </button>
            </div>
          </>
        )}


        {/* === Vista 4: Recogido (solo lectura con todo) === */}
        {(estado === 'recogido') && (
          <>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>Tracking USA:</strong> {trackingUsa || '—'}</li>
              <li><strong>Transportista:</strong> {transportista || '—'}</li>
              <li><strong>Casillero:</strong> {casillero || '—'}</li>
              <li><strong>Tracking Eshopex:</strong> {trackingEshop || '—'}</li>
              <li><strong>Fecha Recepción:</strong> {fechaRecepcion || '—'}</li>
              <li><strong>Fecha Recogido:</strong> {fechaRecogido || '—'}</li>
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

            <div className="mt-6 text-right">
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