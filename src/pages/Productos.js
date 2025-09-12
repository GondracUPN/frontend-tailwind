// src/pages/Productos.js
import React, { useState, useEffect } from 'react';
import ModalProducto from '../components/ModalProducto';
import DetallesProductoModal from '../components/DetallesProductoModal';
import ModalCostos from '../components/ModalCostos';
import ModalTracking from '../components/ModalTracking';
import api from '../api';  // cliente fetch centralizado
import ResumenCasilleros from '../components/ResumenCasilleros';
import ModalVenta from '../components/ModalVenta';
import ModalCalculadora from '../components/ModalCalculadora';

export default function Productos({ setVista }) {
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [modalModo, setModalModo] = useState(null); // 'crear'|'detalle'|'costos'|'track'
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  // Mapa: productoId -> última venta (o null)
  const [ventasMap, setVentasMap] = useState({});

  // Abre modal de venta (creación o lectura)
  const abrirVenta = (p) => { setProductoSeleccionado(p); setModalModo('venta'); };
  const abrirCalculadora = (p) => { setProductoSeleccionado(p); setModalModo('calc'); };

  // Cuando se guarda una venta, refrescamos sólo ese producto en el mapa
  const handleVentaSaved = (ventaGuardada) => {
    setVentasMap(prev => ({ ...prev, [ventaGuardada.productoId]: ventaGuardada }));
    cerrarModal();
  };

  const fmtSoles = (v) => (v != null ? `S/ ${parseFloat(v).toFixed(2)}` : '—');

  // ===== Helpers de Tracking (sin heurística) =====
  const labelFromEstado = (estado) => {
    switch (estado) {
      case 'comprado_sin_tracking': return 'Comprado (Sin Tracking)';
      case 'comprado_en_camino': return 'Comprado (En Camino US)';
      case 'en_eshopex': return 'En Eshopex (Camino Lima)';
      case 'recogido': return 'Recogido';
      default: return '—';
    }
  };
  // Colores Tailwind por estado
  const badgeClasses = (estado) => {
    switch (estado) {
      case 'comprado_sin_tracking':
        return 'bg-slate-100 text-slate-700 border border-slate-300';
      case 'comprado_en_camino':
        return 'bg-[#d6effe] text-[#009eff] border border-[#90b5fe]';
      case 'en_eshopex':
        return 'bg-amber-100 text-amber-800 border border-amber-300';
      case 'recogido':
        return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-300';
    }
  };

  // Bases de URL por operador declarado por backend
  const URLS = {
    usps: (code) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(code)}`,
    ups: (code) => `https://www.ups.com/track?tracknum=${encodeURIComponent(code)}`,
    fedex: (code) => `https://www.fedex.com/fedextrack/?tracknumbers=${encodeURIComponent(code)}`,
    dhl: (code) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(code)}&brand=DHL`,
    amazon: (code) => `https://www.amazon.com/progress-tracker/package?trackingId=${encodeURIComponent(code)}`,
    eshopex: (code) => `https://usamybox.com/internacional/tracking_box.php?nrotrack=${encodeURIComponent(code)}`,
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
      case 'comprado_en_camino':
        if (!trackingUsa || !operador || !URLS[operador]) return null;
        return { href: URLS[operador](trackingUsa), text: `Ver tracking ${operador.toUpperCase()}` };
      case 'en_eshopex':
        if (!trackingEsh) return null;
        return { href: URLS.eshopex(trackingEsh), text: 'Ver tracking Eshopex' };
      case 'recogido':
        if (trackingEsh) return { href: URLS.eshopex(trackingEsh), text: 'Ver historial Eshopex' };
        if (trackingUsa && operador && URLS[operador]) {
          return { href: URLS[operador](trackingUsa), text: `Ver historial ${operador.toUpperCase()}` };
        }
        return null;
      default:
        return null;
    }
  };

  // 🔄 Carga inicial usando api.js
  useEffect(() => {
    let alive = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const data = await api.get('/productos');
        if (alive) setProductos(data);
      } catch (e) {
        console.error(e);
        if (alive) setError('No se pudieron cargar los productos.');
      } finally {
        if (alive) setCargando(false);
      }
    })();
    return () => { alive = false; };
  }, []);
  // Cargar última venta por producto (si existe) cuando cambia la lista
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!productos || productos.length === 0) return;
      try {
        const entries = await Promise.all(
          productos.map(async (p) => {
            try {
              const data = await api.get(`/ventas/producto/${p.id}`); // devuelve array desc
              const ultima = Array.isArray(data) && data.length > 0 ? data[0] : null;
              return [p.id, ultima];
            } catch {
              return [p.id, null];
            }
          })
        );
        if (!mounted) return;
        const map = {};
        entries.forEach(([id, v]) => { map[id] = v; });
        setVentasMap(map);
      } catch (e) {
        console.error('Error cargando ventas:', e);
      }
    })();
    return () => { mounted = false; };
  }, [productos]);





  const abrirCrear = () => { setProductoSeleccionado(null); setModalModo('crear'); };
  const abrirDetalle = (p) => { setProductoSeleccionado(p); setModalModo('detalle'); };
  const abrirCostos = (p) => { setProductoSeleccionado(p); setModalModo('costos'); };
  const abrirTrack = (p) => { setProductoSeleccionado(p); setModalModo('track'); };
  const cerrarModal = () => setModalModo(null);

  const handleSaved = (updated) => {
    setProductos(list =>
      modalModo === 'crear'
        ? [updated, ...list]
        : list.map(p => (p.id === updated.id ? updated : p))
    );
    cerrarModal();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este producto?')) return;
    try {
      await api.del(`/productos/${id}`);
      setProductos(list => list.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
      alert('Error al eliminar.');
    }
  };

  // === CONTADORES ===
  const stats = React.useMemo(() => {
    const total = productos.length;
    let sinTracking = 0;
    let enCamino = 0;
    let enEshopex = 0;
    let disponible = 0;
    let vendido = 0;

    for (const p of productos) {
      const t = p.tracking?.[0];
      const estado = t?.estado || null;
      const venta = ventasMap[p.id] || null;

      if (!t || estado === 'comprado_sin_tracking') sinTracking++;
      if (estado === 'comprado_en_camino') enCamino++;
      if (estado === 'en_eshopex') enEshopex++;

      if (venta) {
        vendido++;
      } else if (estado === 'recogido') {
        disponible++;
      }
    }

    return { total, sinTracking, enCamino, enEshopex, disponible, vendido };
  }, [productos, ventasMap]);

  // === TOTALES DE MONTOS ===
  // Suma global de valorProducto ($), costoEnvio (S/), costoTotal (S/), total vendido (S/), y ganancia (S/)
  const totals = React.useMemo(() => {
    let totalGastadoUSD = 0;   // suma de valorProducto ($)
    let totalEnvioSoles = 0;   // suma de costoEnvio (S/)
    let totalDecUSD = 0;
    let totalCostoSoles = 0;   // suma de costoTotal (S/)
    let totalVentaSoles = 0;   // suma de venta (S/) sólo si existe registro de venta
    let gananciaSoles = 0;     // totalVentaSoles - totalCostoSoles (por producto vendido)

    for (const p of productos) {
      const v = p.valor || {};
      const venta = ventasMap[p.id] || null;

      // Costos
      if (v.valorProducto != null && v.valorProducto !== '') {
        totalGastadoUSD += Number(v.valorProducto) || 0;
      }
      if (v.valorDec != null && v.valorDec !== '') {
        totalDecUSD += Number(v.valorDec) || 0;
      }
      if (v.costoEnvio != null && v.costoEnvio !== '') {
        totalEnvioSoles += Number(v.costoEnvio) || 0;
      }
      if (v.costoTotal != null && v.costoTotal !== '') {
        totalCostoSoles += Number(v.costoTotal) || 0;
      }

      // Ventas y ganancia (si existe venta)
      if (venta) {
        const montoVenta = Number(venta.montoVentaSoles ?? venta.montoVenta ?? 0); // ajusta al nombre real de tu campo
        totalVentaSoles += montoVenta;

        const costoProducto = Number(v.costoTotal ?? 0);
        gananciaSoles += (montoVenta - costoProducto);
      }
    }

    // Helpers de formato
    const fmtSoles = (n) => `S/ ${Number(n).toFixed(2)}`;
    const fmtUSD = (n) => `$ ${Number(n).toFixed(2)}`;

    return {
      totalGastadoUSD: fmtUSD(totalGastadoUSD),
      totalEnvioSoles: fmtSoles(totalEnvioSoles),
      totalDecUSD: fmtUSD(totalDecUSD),
      totalCostoSoles: fmtSoles(totalCostoSoles),
      totalVentaSoles: fmtSoles(totalVentaSoles),
      gananciaSoles: fmtSoles(gananciaSoles),
    };
  }, [productos, ventasMap]);



  return (
    <div className="min-h-screen p-8 bg-macGray text-macDark">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-semibold">Gestión de Productos</h2>
        <button onClick={() => setVista('home')} className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100">
          ← Volver
        </button>
      </header>

      {/* Resumen de conteos */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Totales</div>
          <div className="text-2xl font-semibold">{stats.total}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Sin tracking</div>
          <div className="text-2xl font-semibold">{stats.sinTracking}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">En camino US</div>
          <div className="text-2xl font-semibold">{stats.enCamino}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">En Eshopex</div>
          <div className="text-2xl font-semibold">{stats.enEshopex}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Disponible</div>
          <div className="text-2xl font-semibold">{stats.disponible}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Vendido</div>
          <div className="text-2xl font-semibold">{stats.vendido}</div>
        </div>
      </div>



      {/* Panel de casilleros */}
      <ResumenCasilleros productos={productos} />

      {/* Totales de montos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total gastado ($)</div>
          <div className="text-2xl font-semibold">{totals.totalGastadoUSD}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total envío (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalEnvioSoles}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total DEC ($)</div>
          <div className="text-2xl font-semibold">{totals.totalDecUSD}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total costo (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalCostoSoles}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Total venta (S/)</div>
          <div className="text-2xl font-semibold">{totals.totalVentaSoles}</div>
        </div>
        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-sm text-gray-500">Ganancia total (S/)</div>
          <div className="text-2xl font-semibold">{totals.gananciaSoles}</div>
        </div>
      </div>



      {/* Botón Agregar */}
      <div className="flex justify-end mb-4">
        <button onClick={abrirCrear} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700">
          Agregar Producto
        </button>
      </div>

      {/* Cargando / Error */}
      {cargando && <p>Cargando productos…</p>}
      {error && <p className="text-red-500">{error}</p>}

      {/* Tabla */}
      {!cargando && !error && (
        productos.length > 0 ? (
          <table className="w-full text-left border">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2">Tipo</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Caja</th>
                <th className="p-2">Valor $</th>
                <th className="p-2">Valor S/</th>
                <th className="p-2">Envio S/</th>
                <th className="p-2">Total S/</th>
                <th className="p-2">Calculadora</th>
                <th className="p-2">F. Compra</th>
                <th className="p-2">Tracking</th>
                <th className="p-2">Venta</th>
                <th className="p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const v = p.valor || {};
                const t = p.tracking?.[0]; // Primer tracking (si existe)
                const label = labelFromEstado(t?.estado);
                const link = buildTrackingLink(t);

                return (
                  <tr key={p.id} className="border-t hover:bg-gray-50">
                    <td className="p-2">
                      <button
                        onClick={() => abrirDetalle(p)}
                        className="bg-gray-200 px-2 py-1 rounded hover:bg-gray-300"
                      >
                        {p.tipo}
                      </button>
                    </td>
                    <td className="p-2">{p.estado}</td>
                    <td className="p-2">{p.conCaja ? 'Sí' : 'No'}</td>
                    <td className="p-2">{v.valorProducto != null ? `$ ${v.valorProducto}` : '—'}</td>
                    <td className="p-2">{fmtSoles(v.valorSoles)}</td>
                    <td className="p-2">{fmtSoles(v.costoEnvio)}</td>
                    <td className="p-2">{fmtSoles(v.costoTotal)}</td>
                    <td className="p-2">
                      <button
                        onClick={() => abrirCalculadora(p)}
                        className="bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                        title="Calcular precio de venta"
                      >
                        Calcular precio venta
                      </button>
                    </td>
                    <td className="p-2">
                      {v.fechaCompra ? new Date(v.fechaCompra).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-2">
                      {/* Pill/ botón de estado: más grande, negrita y “clickable” */}
                      <button
                        onClick={() => abrirTrack(p)}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold ${badgeClasses(t?.estado)}`}
                        title="Abrir tracking"
                      >
                        <span className="text-xs">📦</span>
                        {label}
                      </button>

                      {/* Casillero más visible (más grande + negrita) */}
                      <div className="mt-1 text-sm font-semibold text-gray-800">
                        {t?.casillero ? `Casillero: ${t.casillero}` : 'Casillero: —'}
                      </div>

                      {/* Enlace dinámico debajo */}
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



                    {/* Venta */}
                    <td className="p-2">
                      {(() => {
                        const t = p.tracking?.[0];
                        const venta = ventasMap[p.id] || null;
                        const recogido = t?.estado === 'recogido';

                        let text = 'En espera';
                        let className = 'bg-gray-300 text-gray-600 cursor-not-allowed opacity-60';
                        let disabled = true;

                        if (recogido && !venta) {
                          text = 'Disponible';
                          className = 'bg-yellow-500 text-white hover:bg-yellow-600';
                          disabled = false;
                        }
                        if (venta) {
                          text = 'Vendido';
                          className = 'bg-green-600 text-white hover:bg-green-700';
                          disabled = false;
                        }

                        return (
                          <button
                            onClick={() => { if (!disabled) abrirVenta(p); }}
                            className={`${className} px-3 py-1 rounded`}
                            disabled={disabled}
                            title={disabled ? 'Aún no está recogido' : ''}
                          >
                            {text}
                          </button>
                        );
                      })()}
                    </td>


                    <td className="p-2 space-x-1">
                      <button
                        onClick={() => abrirCostos(p)}
                        className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                      >
                        Editar Costos
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                      >
                        Borrar
                      </button>
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
      {modalModo === 'crear' && <ModalProducto onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'detalle' && <DetallesProductoModal producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'costos' && <ModalCostos producto={productoSeleccionado} onClose={cerrarModal} onSaved={handleSaved} />}
      {modalModo === 'track' && (
        <ModalTracking
          producto={productoSeleccionado}
          onClose={cerrarModal}
          onSaved={async () => {
            try {
              const data = await api.get('/productos'); // ← refresca desde backend correcto
              setProductos(data);
            } catch { }
            cerrarModal();
          }}
        />
      )}
      {modalModo === 'venta' && (
        <ModalVenta
          producto={productoSeleccionado}
          venta={ventasMap[productoSeleccionado?.id] || null}
          onClose={cerrarModal}
          onSaved={handleVentaSaved}
        />
      )}
      {modalModo === 'calc' && (
        <ModalCalculadora
          producto={productoSeleccionado}
          onClose={cerrarModal}
        />
      )}



    </div>
  );

}
