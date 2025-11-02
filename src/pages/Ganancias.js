// src/pages/Ganancias.js
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

/* =========================
   Helpers
   ========================= */
const fmtSoles = (n) =>
  n != null && n !== '' ? `S/ ${Number(n).toFixed(2)}` : 'S/ 0.00';
const fmtUSD = (n) =>
  n != null && n !== '' ? `$ ${Number(n).toFixed(2)}` : '$ 0.00';

function nombreProducto(p) {
  if (!p) return '';
  const d = p.detalle || {};
  const tipoRaw = (p.tipo || '').toString().trim();
  const tipoKey = tipoRaw.toLowerCase().replace(/\s+/g, ''); // ej. "applewatch"

  // iPad: incluir Generación, Tamaño (pulgadas) y Conexión
  if (tipoKey.includes('ipad')) {
    const gen = d.generacion ? String(d.generacion).trim() : null;
    const size = (d.tamaño ?? d.tamanio) ? `${d.tamaño ?? d.tamanio}"` : null; // pulgadas
    const conn = (d.conexion ?? d.conectividad) ? String(d.conexion ?? d.conectividad).trim() : null;

    return ['iPad', gen, size, conn].filter(Boolean).join(' ');
  }

  // Apple Watch: incluir Generación, Tamaño (mm) y Conexión
  if (tipoKey.includes('applewatch') || tipoKey === 'watch') {
    const gen = d.generacion ? String(d.generacion).trim() : null;
    const size = (d.tamaño ?? d.tamanio) ? `${d.tamaño ?? d.tamanio}mm` : null; // milímetros
    const conn = (d.conexion ?? d.conectividad) ? String(d.conexion ?? d.conectividad).trim() : null;

    return ['Apple Watch', gen, size, conn].filter(Boolean).join(' ');
  }

  // Otros tipos (Macbook, iPhone, etc.) -> comportamiento anterior
  if (tipoKey === 'otro' || tipoKey === 'otros') {
    return (d.descripcionOtro || 'Otros').toString().trim();
  }

  const parts = [
    tipoRaw,
    d.gama,
    d.procesador,
    d.tamaño || d.tamanio, // deja tal cual para los demás
  ].filter(Boolean);

  return parts.join(' ');
}


function lastDayOfMonth(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function rangoFromMesAnio(mes, anio) {
  if (!mes || !anio) return null;
  const mm = String(mes).padStart(2, '0');
  const from = `${anio}-${mm}-01`;
  const to = `${anio}-${mm}-${String(lastDayOfMonth(Number(anio), Number(mes))).padStart(2, '0')}`;
  return { from, to };
}

function filtraPorRango(ventas, rango) {
  if (!rango) return ventas;
  const { from, to } = rango;
  const f = new Date(from);
  const t = new Date(to);
  return ventas.filter(v => {
    const d = new Date(v.fechaVenta || v.createdAt);
    if (isNaN(d.getTime())) return false;
    return d >= f && d <= t;
  });
}

function totales(ventasArr) {
  let totalVentasSoles = 0;
  let totalGanancia = 0;
  for (const v of ventasArr) {
    totalVentasSoles += Number(v.precioVenta ?? 0);
    totalGanancia += Number(v.ganancia ?? 0);
  }
  return {
    cantidad: ventasArr.length,
    brutaSoles: totalVentasSoles,
    netaSoles: totalGanancia,
  };
}

/* =========================
   Página principal
   ========================= */
export default function Ganancias({ setVista }) {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = String(new Date().getFullYear());

  // Filtros globales (por defecto año actual)
  const [mesGlobal, setMesGlobal] = useState('');
  const [anioGlobal, setAnioGlobal] = useState(currentYear);

  // Filtros por vendedor (por defecto año actual)
  const [mesGonzalo, setMesGonzalo] = useState('');
  const [anioGonzalo, setAnioGonzalo] = useState(currentYear);
  const [mesRenato, setMesRenato] = useState('');
  const [anioRenato, setAnioRenato] = useState(currentYear);

  // Modales
  const [sellerTarget, setSellerTarget] = useState(null);   // 'Gonzalo' | 'Renato' | null
  const [sellerSunat, setSellerSunat] = useState(null);   // 'Gonzalo' | 'Renato' | null

  // Carga TODAS las ventas
  const loadVentas = async () => {
    setLoading(true);
    try {
      const data = await api.get('/ventas'); // idealmente con producto + valor
      const list = Array.isArray(data) ? data : [];
      list.sort(
        (a, b) =>
          new Date(b.fechaVenta || b.createdAt || 0) -
          new Date(a.fechaVenta || a.createdAt || 0)
      );
      setVentas(list);
    } catch (e) {
      console.error('[Ganancias] Error cargando ventas:', e);
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadVentas(); }, []);

  // Global
  const rangoGlobal = useMemo(
    () => rangoFromMesAnio(mesGlobal, anioGlobal),
    [mesGlobal, anioGlobal]
  );
  const ventasGlobalFiltradas = useMemo(
    () => filtraPorRango(ventas, rangoGlobal),
    [ventas, rangoGlobal]
  );
  const totalesGlobales = useMemo(
    () => totales(ventasGlobalFiltradas),
    [ventasGlobalFiltradas]
  );

  // Por vendedor
  const ventasGonzalo = useMemo(
    () => ventas.filter(v => (v.vendedor || '').toLowerCase() === 'gonzalo'),
    [ventas]
  );
  const ventasRenato = useMemo(
    () => ventas.filter(v => (v.vendedor || '').toLowerCase() === 'renato'),
    [ventas]
  );

  const rangoGonzalo = useMemo(
    () => rangoFromMesAnio(mesGonzalo, anioGonzalo),
    [mesGonzalo, anioGonzalo]
  );
  const rangoRenato = useMemo(
    () => rangoFromMesAnio(mesRenato, anioRenato),
    [mesRenato, anioRenato]
  );

  const ventasGonzaloFiltradas = useMemo(
    () => filtraPorRango(ventasGonzalo, rangoGonzalo),
    [ventasGonzalo, rangoGonzalo]
  );
  const ventasRenatoFiltradas = useMemo(
    () => filtraPorRango(ventasRenato, rangoRenato),
    [ventasRenato, rangoRenato]
  );

  const tG = useMemo(() => totales(ventasGonzaloFiltradas), [ventasGonzaloFiltradas]);
  const tR = useMemo(() => totales(ventasRenatoFiltradas), [ventasRenatoFiltradas]);

  return (
    <div className="min-h-screen p-8 bg-macGray text-macDark">
      {/* Header */}
      <header className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-semibold">Ganancias</h2>
        <button
          onClick={() => setVista && setVista('home')}
          className="px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-100"
        >
          ← Volver
        </button>
      </header>

      {/* Resumen Global */}
      <div className="bg-white border rounded-2xl shadow-sm p-5 mb-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-end lg:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <Kpi titulo="Ventas totales" valor={totalesGlobales.cantidad} />
            <Kpi titulo="Ganancia bruta total" valor={fmtSoles(totalesGlobales.brutaSoles)} />
            <Kpi titulo="Ganancia neta total" valor={fmtSoles(totalesGlobales.netaSoles)} />
          </div>

          <div className="flex gap-3 w-full lg:w-auto">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Mes (global)</label>
              <select
                className="border rounded px-3 py-2"
                value={mesGlobal}
                onChange={e => setMesGlobal(e.target.value)}
              >
                <option value="">Todos</option>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Año (global)</label>
              <input
                type="number"
                className="border rounded px-3 py-2 w-28"
                placeholder="YYYY"
                value={anioGlobal}
                onChange={e => setAnioGlobal(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => { setMesGlobal(''); setAnioGlobal(currentYear); }}
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dos columnas: Gonzalo y Renato */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ColVendedor
          titulo="Gonzalo"
          ventas={ventasGonzaloFiltradas}
          totales={tG}
          mes={mesGonzalo}
          anio={anioGonzalo}
          setMes={setMesGonzalo}
          setAnio={setAnioGonzalo}
          onImport={() => setSellerTarget('Gonzalo')}
          onSunat={() => setSellerSunat('Gonzalo')}
          reloadVentas={loadVentas}
        />
        <ColVendedor
          titulo="Renato"
          ventas={ventasRenatoFiltradas}
          totales={tR}
          mes={mesRenato}
          anio={anioRenato}
          setMes={setMesRenato}
          setAnio={setAnioRenato}
          onImport={() => setSellerTarget('Renato')}
          onSunat={() => setSellerSunat('Renato')}
          reloadVentas={loadVentas}
        />
      </div>

      {loading && <p className="mt-4 text-gray-500">Cargando ventas…</p>}

      {/* Modal: Importar ventas */}
      {sellerTarget && (
        <ModalImportarVenta
          seller={sellerTarget}
          onClose={() => setSellerTarget(null)}
          onImported={async () => {
            await loadVentas();
            setSellerTarget(null);
          }}
        />
      )}

      {/* Modal: Sunat */}
      {sellerSunat && (
        <ModalSunat
          seller={sellerSunat}
          onClose={() => setSellerSunat(null)}
          ventas={ventas}
        />
      )}
    </div>
  );
}

/* =========================
   Subcomponentes visuales
   ========================= */
function Kpi({ titulo, valor }) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm">
      <div className="text-sm text-gray-500">{titulo}</div>
      <div className="text-2xl font-semibold">{valor}</div>
    </div>
  );
}

function ColVendedor({
  titulo,
  ventas,
  totales,
  mes, anio, setMes, setAnio,
  onImport,
  onSunat,
  reloadVentas,
}) {
  const currentYear = String(new Date().getFullYear());
  const [unassigningId, setUnassigningId] = useState(null);

  const handleQuitar = async (ventaId) => {
    if (!window.confirm('¿Quitar esta venta del vendedor?')) return;
    try {
      setUnassigningId(ventaId);
      await api.patch(`/ventas/${ventaId}`, { vendedor: null });
      await reloadVentas();
    } catch (e) {
      console.error('[ColVendedor] Error al quitar venta:', e);
      alert('No se pudo quitar la venta.');
    } finally {
      setUnassigningId(null);
    }
  };

  return (
    <div className="bg-white border rounded-2xl shadow-sm p-5">
      {/* Cabecera vendedor + botones */}
      <div className="flex items-center justify-between mb-4 gap-2">
        <div>
          <div className="text-sm text-gray-500">Vendedor</div>
          <div className="text-xl font-semibold">{titulo}</div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSunat}
            className="bg-amber-600 text-white px-4 py-2 rounded-xl hover:bg-amber-700"
          >
            Calcular Sunat
          </button>
          <button
            onClick={onImport}
            className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700"
          >
            Importar venta
          </button>
        </div>
      </div>

      {/* KPIs por vendedor + Filtros */}
      <div className="flex flex-col lg:flex-row items-start lg:items-end lg:justify-between gap-4 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full lg:w-auto">
          <Kpi titulo="Ventas" valor={totales.cantidad} />
          <Kpi titulo="Bruta" valor={fmtSoles(totales.brutaSoles)} />
          <Kpi titulo="Neta" valor={fmtSoles(totales.netaSoles)} />
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mes</label>
            <select
              className="border rounded px-3 py-2"
              value={mes}
              onChange={e => setMes(e.target.value)}
            >
              <option value="">Todos</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Año</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-28"
              placeholder="YYYY"
              value={anio}
              onChange={e => setAnio(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => { setMes(''); setAnio(currentYear); }}
            >
              Limpiar
            </button>
          </div>
        </div>
      </div>

      {/* Tabla de ventas del vendedor (sin Precio DEC) */}
      <div className="overflow-auto max-h-[60vh] border rounded">
        <table className="w-full text-left">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="p-2">Nombre</th>
              <th className="p-2">Total (S/)</th>
              <th className="p-2">F. compra</th>
              <th className="p-2">Precio venta (S/)</th>
              <th className="p-2">Ganancia (S/)</th>
              <th className="p-2">% Gan.</th>
              <th className="p-2">F. venta</th>
              <th className="p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ventas.length === 0 ? (
              <tr>
                <td className="p-3 text-sm text-gray-500" colSpan={8}>
                  Sin ventas en este rango.
                </td>
              </tr>
            ) : (
              ventas.map(v => {
                const p = v.producto || {};
                const val = p.valor || {};
                const pct = Number(v.porcentajeGanancia ?? 0);

                return (
                  <tr key={v.id} className="border-t">
                    <td className="p-2">{nombreProducto(p) || '—'}</td>
                    <td className="p-2">{fmtSoles(val.costoTotal)}</td>
                    <td className="p-2">
                      {val.fechaCompra
                        ? new Date(val.fechaCompra).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-2">{fmtSoles(v.precioVenta)}</td>
                    <td className="p-2">{fmtSoles(v.ganancia)}</td>
                    <td className="p-2">{isFinite(pct) ? `${pct.toFixed(2)}%` : '—'}</td>
                    <td className="p-2">
                      {v.fechaVenta
                        ? new Date(v.fechaVenta).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="p-2">
                      <button
                        className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                        onClick={() => handleQuitar(v.id)}
                        disabled={unassigningId === v.id}
                        title="Quitar esta venta del vendedor"
                      >
                        {unassigningId === v.id ? 'Quitando…' : 'Quitar'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   ModalImportarVenta
   ========================= */
function ModalImportarVenta({ seller, onClose, onImported }) {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);

  const currentYear = String(new Date().getFullYear());
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState(currentYear);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const fetchVentas = async (m = mes, y = anio) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('unassigned', 'true');
      if (y && m) {
        const mm = String(m).padStart(2, '0');
        const from = `${y}-${mm}-01`;
        const to = `${y}-${mm}-${String(lastDayOfMonth(Number(y), Number(m))).padStart(2, '0')}`;
        params.set('from', from);
        params.set('to', to);
      }
      const data = await api.get(`/ventas?${params.toString()}`);
      const list = (Array.isArray(data) ? data : []).sort(
        (a, b) =>
          new Date(b.fechaVenta || b.createdAt || 0) -
          new Date(a.fechaVenta || a.createdAt || 0)
      );
      setVentas(list);
    } catch (e) {
      console.error('[ModalImportarVenta] Error cargando ventas:', e);
      setVentas([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVentas(); }, []);
  useEffect(() => {
    if (anio && mes) fetchVentas(mes, anio);
    if (!anio || !mes) fetchVentas('', '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes, anio]);

  const toggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const aceptar = async () => {
    if (selectedIds.size === 0) {
      alert('Selecciona al menos una venta.');
      return;
    }
    try {
      const payload = { vendedor: seller };
      await Promise.all(
        [...selectedIds].map(id => api.patch(`/ventas/${id}`, payload))
      );
      onImported && onImported();
    } catch (e) {
      console.error('[ModalImportarVenta] Error asignando vendedor:', e);
      alert('No se pudo asignar el vendedor a alguna venta.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-lg p-6 relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          ✖
        </button>
        <h2 className="text-2xl font-semibold mb-4">Importar venta — {seller}</h2>

        {/* Filtros Mes/Año */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Mes</label>
            <select
              className="border rounded px-3 py-2"
              value={mes}
              onChange={e => setMes(e.target.value)}
            >
              <option value="">Todos</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Año</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-28"
              placeholder="YYYY"
              value={anio}
              onChange={e => setAnio(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => { setMes(''); setAnio(currentYear); }}
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Tabla (sin Precio DEC) */}
        {loading ? (
          <p>Cargando ventas…</p>
        ) : ventas.length === 0 ? (
          <p>No hay ventas sin asignar en ese rango.</p>
        ) : (
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="w-full text-left">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2">Sel.</th>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">Total (S/)</th>
                  <th className="p-2">F. compra</th>
                  <th className="p-2">Precio venta (S/)</th>
                  <th className="p-2">Ganancia (S/)</th>
                  <th className="p-2">% Gan.</th>
                  <th className="p-2">F. venta</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map(v => {
                  const p = v.producto || {};
                  const val = p.valor || {};
                  const nombre = nombreProducto(p);
                  const costoTotal = Number(val.costoTotal ?? 0);
                  const precioVenta = Number(v.precioVenta ?? 0);
                  const ganancia = Number(v.ganancia ?? (precioVenta - costoTotal));
                  const pct = costoTotal > 0 ? (ganancia / costoTotal) * 100 : 0;

                  return (
                    <tr key={v.id} className="border-t">
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(v.id)}
                          onChange={() => toggle(v.id)}
                        />
                      </td>
                      <td className="p-2">{nombre || '—'}</td>
                      <td className="p-2">{fmtSoles(costoTotal)}</td>
                      <td className="p-2">
                        {val.fechaCompra
                          ? new Date(val.fechaCompra).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="p-2">{fmtSoles(precioVenta)}</td>
                      <td className="p-2">{fmtSoles(ganancia)}</td>
                      <td className="p-2">{isFinite(pct) ? `${pct.toFixed(2)}%` : '—'}</td>
                      <td className="p-2">
                        {v.fechaVenta
                          ? new Date(v.fechaVenta).toLocaleDateString()
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            className="bg-indigo-600 text-white px-5 py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
            onClick={aceptar}
            disabled={selectedIds.size === 0}
          >
            Aceptar
          </button>
          <button
            className="bg-gray-300 text-gray-800 px-5 py-2 rounded hover:bg-gray-400"
            onClick={onClose}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================
   ModalSunat (por vendedor)
   ========================= */
function ModalSunat({ seller, onClose, ventas }) {
  const currentYear = String(new Date().getFullYear());
  const [mes, setMes] = useState('');
  const [anio, setAnio] = useState(currentYear);

  const ventasSeller = useMemo(
    () => ventas.filter(v => (v.vendedor || '').toLowerCase() === seller.toLowerCase()),
    [ventas, seller]
  );

  const rango = useMemo(() => rangoFromMesAnio(mes, anio), [mes, anio]);
  const lista = useMemo(
    () => filtraPorRango(ventasSeller, rango).sort(
      (a, b) =>
        new Date(b.fechaVenta || b.createdAt || 0) -
        new Date(a.fechaVenta || a.createdAt || 0)
    ),
    [ventasSeller, rango]
  );

  const filas = useMemo(() => {
    return lista.map(v => {
      const p = v.producto || {};
      const val = p.valor || {};
      const tipoCambio = Number(v.tipoCambio ?? 0);
      const valorDecUSD = Number(val.valorDec ?? 0);
      const envioSoles = Number(val.costoEnvio ?? 0);
      const ventaSoles = Number(v.precioVenta ?? 0);

      const decSoles = valorDecUSD * tipoCambio;
      const costoBase = decSoles + envioSoles;
      const gananciaNeta = ventaSoles - costoBase;

      return {
        id: v.id,
        nombre: nombreProducto(p),
        valorDecUSD,
        decSoles,
        envioSoles,
        ventaSoles,
        costoBase,
        gananciaNeta,
        fechaVenta: v.fechaVenta || v.createdAt || null,
      };
    });
  }, [lista]);

  const kpis = useMemo(() => {
    let envioTotal = 0;
    let decTotalS = 0;
    let baseTotal = 0;
    let ventaTotal = 0;
    let ganTotal = 0;
    for (const f of filas) {
      envioTotal += f.envioSoles;
      decTotalS += f.decSoles;
      baseTotal += f.costoBase;
      ventaTotal += f.ventaSoles;
      ganTotal += f.gananciaNeta;
    }
    return { envioTotal, decTotalS, baseTotal, ventaTotal, ganTotal };
  }, [filas]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-lg p-6 relative">
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >
          ✖
        </button>
        <h2 className="text-2xl font-semibold mb-4">Calcular Ganancia Sunat — {seller}</h2>

        {/* Filtros Mes/Año */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Mes</label>
            <select
              className="border rounded px-3 py-2"
              value={mes}
              onChange={e => setMes(e.target.value)}
            >
              <option value="">Todos</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Año</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-28"
              placeholder="YYYY"
              value={anio}
              onChange={e => setAnio(e.target.value)}
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              className="px-3 py-2 bg-gray-200 rounded hover:bg-gray-300"
              onClick={() => { setMes(''); setAnio(currentYear); }}
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* KPIs superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mb-4">
          <Kpi titulo="Envío total" valor={fmtSoles(kpis.envioTotal)} />
          <Kpi titulo="DEC total (S/)" valor={fmtSoles(kpis.decTotalS)} />
          <Kpi titulo="Costo base (S/)" valor={fmtSoles(kpis.baseTotal)} />
          <Kpi titulo="Venta total (S/)" valor={fmtSoles(kpis.ventaTotal)} />
          <Kpi titulo="Ganancia neta (S/)" valor={fmtSoles(kpis.ganTotal)} />
        </div>

        {/* Tabla detalle (Sunat mantiene DEC $) */}
        {filas.length === 0 ? (
          <p>No hay ventas en ese rango.</p>
        ) : (
          <div className="overflow-auto max-h-[60vh] border rounded">
            <table className="w-full text-left">
              <thead className="bg-gray-100 sticky top-0">
                <tr>
                  <th className="p-2">Nombre</th>
                  <th className="p-2">DEC ($)</th>
                  <th className="p-2">DEC (S/)</th>
                  <th className="p-2">Envío (S/)</th>
                  <th className="p-2">Precio venta (S/)</th>
                  <th className="p-2">Costo base (S/)</th>
                  <th className="p-2">Ganancia neta (S/)</th>
                  <th className="p-2">F. venta</th>
                </tr>
              </thead>
              <tbody>
                {filas.map(f => (
                  <tr key={f.id} className="border-t">
                    <td className="p-2">{f.nombre || '—'}</td>
                    <td className="p-2">{fmtUSD(f.valorDecUSD)}</td>
                    <td className="p-2">{fmtSoles(f.decSoles)}</td>
                    <td className="p-2">{fmtSoles(f.envioSoles)}</td>
                    <td className="p-2">{fmtSoles(f.ventaSoles)}</td>
                    <td className="p-2">{fmtSoles(f.costoBase)}</td>
                    <td className="p-2">{fmtSoles(f.gananciaNeta)}</td>
                    <td className="p-2">
                      {f.fechaVenta ? new Date(f.fechaVenta).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            className="bg-gray-300 text-gray-800 px-5 py-2 rounded hover:bg-gray-400"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}