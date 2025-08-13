// src/pages/Productos.js
import React, { useState, useEffect } from 'react';
import ModalProducto from '../components/ModalProducto';
import DetallesProductoModal from '../components/DetallesProductoModal';
import ModalCostos from '../components/ModalCostos';
import ModalTracking from '../components/ModalTracking';

export default function Productos({ setVista }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [modalModo, setModalModo] = useState(null); // 'crear'|'detalle'|'costos'|'track'
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);

  const fmtSoles = v => v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '—';

  // ===== Helpers de Tracking (sin heurística) =====
  const labelFromEstado = (estado) => {
    switch (estado) {
      case 'comprado_sin_tracking': return 'Comprado (Sin Tracking)';
      case 'comprado_en_camino':    return 'Comprado (En Camino US)';
      case 'en_eshopex':            return 'En Eshopex (Camino Lima)';
      case 'recogido':              return 'Recogido';
      default:                      return '—';
    }
  };

  // Bases de URL por operador declarado por backend
  const URLS = {
    usps:   (code) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(code)}`,
    ups:    (code) => `https://www.ups.com/track?tracknum=${encodeURIComponent(code)}`,
    fedex:  (code) => `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(code)}`,
    dhl:    (code) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(code)}&brand=DHL`,
    amazon: (code) => `https://www.amazon.com/progress-tracker/package?trackingId=${encodeURIComponent(code)}`,
    eshopex:(code) => `https://usamybox.com/internacional/tracking_box.php?nrotrack=${encodeURIComponent(code)}`,
  };

  // Construye el link según estado y datos
  const buildTrackingLink = (t) => {
    if (!t) return null;

    const trackingUsa = typeof t.trackingUsa === 'string' ? t.trackingUsa.trim() : '';
    const trackingEsh = typeof t.trackingEshop === 'string' ? t.trackingEshop.trim() : '';
    const operadorRaw = typeof t.transportista === 'string' ? t.transportista : '';
    const operador = operadorRaw.toLowerCase();

    switch (t.estado) {
      case 'comprado_sin_tracking':
        return null;

      case 'comprado_en_camino': {
        if (!trackingUsa || !operador || !URLS[operador]) return null;
        return { href: URLS[operador](trackingUsa), text: `Ver tracking ${operador.toUpperCase()}` };
      }

      case 'en_eshopex': {
        if (!trackingEsh) return null;
        return { href: URLS.eshopex(trackingEsh), text: 'Ver tracking Eshopex' };
      }

      case 'recogido': {
        if (trackingEsh) return { href: URLS.eshopex(trackingEsh), text: 'Ver historial Eshopex' };
        if (trackingUsa && operador && URLS[operador]) {
          return { href: URLS[operador](trackingUsa), text: `Ver historial ${operador.toUpperCase()}` };
        }
        return null;
      }

      default:
        return null;
    }
  };

  // 🔄 Carga inicial
  useEffect(() => {
    async function fetchProductos() {
      setCargando(true);
      setError(null);
      try {
        const res = await fetch('http://localhost:3000/productos');
        if (!res.ok) throw new Error(res.statusText);
        setProductos(await res.json());
      } catch (e) {
        console.error(e);
        setError('No se pudieron cargar los productos.');
      } finally {
        setCargando(false);
      }
    }
    fetchProductos();
  }, []);

  const abrirCrear   = () => { setProductoSeleccionado(null); setModalModo('crear');   };
  const abrirDetalle = p    => { setProductoSeleccionado(p);  setModalModo('detalle'); };
  const abrirCostos  = p    => { setProductoSeleccionado(p);  setModalModo('costos');  };
  const abrirTrack   = p    => { setProductoSeleccionado(p);  setModalModo('track');   };
  const cerrarModal  = ()   => setModalModo(null);

  const handleSaved = updated => {
    setProductos(list =>
      modalModo === 'crear'
        ? [updated, ...list]
        : list.map(p => p.id === updated.id ? updated : p)
    );
    cerrarModal();
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try {
      const res = await fetch(`http://localhost:3000/productos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setProductos(list => list.filter(p => p.id !== id));
    } catch {
      alert('Error al eliminar.');
    }
  };

  return (
    <div className="min-h-screen p-8 bg-macGray text-macDark">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold">Gestión de Productos</h2>
        <button onClick={()=>setVista('home')} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">
          ← Volver
        </button>
      </header>

      {/* Botón Agregar */}
      <div className="flex justify-end mb-4">
        <button onClick={abrirCrear} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700">
          Agregar Producto
        </button>
      </div>

      {/* Cargando / Error */}
      {cargando && <p>Cargando productos…</p>}
      {error   && <p className="text-red-500">{error}</p>}

      {/* Tabla */}
      {!cargando && !error && (
        productos.length > 0 ? (
          <table className="w-full text-left border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">ID</th>
                <th className="p-2">Tipo</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Caja</th>
                <th className="p-2">Valor $</th>
                <th className="p-2">Valor S/</th>
                <th className="p-2">Envio S/</th>
                <th className="p-2">Total S/</th>
                <th className="p-2">F. Compra</th>
                <th className="p-2">Tracking</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(p => {
                const v = p.valor || {};
                const t = p.tracking?.[0]; // Primer tracking (si existe)

                const label = labelFromEstado(t?.estado);
                const link  = buildTrackingLink(t);

                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">{p.id}</td>
                    <td className="p-2">
                      <button
                        onClick={()=>abrirDetalle(p)}
                        className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                      >{p.tipo}</button>
                    </td>
                    <td className="p-2">{p.estado}</td>
                    <td className="p-2">{p.conCaja ? 'Sí' : 'No'}</td>
                    <td className="p-2">
                      {v.valorProducto!=null?`$ ${v.valorProducto}`:'—'}
                    </td>
                    <td className="p-2">{fmtSoles(v.valorSoles)}</td>
                    <td className="p-2">{fmtSoles(v.costoEnvio)}</td>
                    <td className="p-2">{fmtSoles(v.costoTotal)}</td>
                    <td className="p-2">
                      {v.fechaCompra
                        ? new Date(v.fechaCompra).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-2">
                      <button
                        onClick={()=>abrirTrack(p)}
                        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                      >
                        {label}
                      </button>

                      {/* Enlace dinámico debajo del botón */}
                      {link && (
                        <div className="mt-1 text-xs">
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 underline"
                          >
                            {link.text}
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="p-2 space-x-1">
                      <button
                        onClick={()=>abrirCostos(p)}
                        className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >Editar Costos</button>
                      <button
                        onClick={()=>handleDelete(p.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >Borrar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No hay productos aún.</p>
        )
      )}

      {/* Modales */}
      {modalModo==='crear'   && <ModalProducto         onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo==='detalle' && <DetallesProductoModal producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo==='costos'  && <ModalCostos           producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo==='track'   && (
        <ModalTracking
          producto={productoSeleccionado}
          onClose={cerrarModal}
          onSaved={async () => {
            try {
              const res = await fetch('http://localhost:3000/productos');
              if (res.ok) setProductos(await res.json());
            } catch {}
            cerrarModal();
          }}
        />
      )}
    </div>
  );
}
