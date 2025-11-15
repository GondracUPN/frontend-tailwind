// src/components/ModalCalculadora.js
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { TC_FIJO } from '../utils/tipoCambio';

const fmtSoles = (v) => (isNaN(v) ? '-' : `S/ ${Number(v).toFixed(2)}`);
const roundUp10 = (n) => {
  const x = Number(n);
  if (!isFinite(x)) return NaN;
  return Math.ceil(x / 10) * 10;
};

export default function ModalCalculadora({ producto, onClose }) {

  // Valores base del producto
  const costoTotalBase = Number(producto?.valor?.costoTotal ?? 0);
  const valorUSD = Number(producto?.valor?.valorProducto ?? 0);
  const envioSoles = Number(producto?.valor?.costoEnvio ?? 0);

  const [precioCustom, setPrecioCustom] = useState('');
  const [tipoCambio, setTipoCambio] = useState('');
  // Analítica y datos comparables
  const [ventas, setVentas] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Cargar snapshot de analytics desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('analytics:lastSummary:v1::');
      const parsed = raw ? JSON.parse(raw) : null;
      setAnalytics(parsed || null);
    } catch {}
  }, []);

  // Cargar ventas (con joins de producto) para calcular comparables de venta
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const data = await api.get('/ventas');
        if (alive && Array.isArray(data)) setVentas(data);
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  // Productos cacheados para comparables de compra
  const productosCache = useMemo(() => {
    try {
      const raw = localStorage.getItem('productos:lastList:v1');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, []);

  // Helper: extrae atributos de agrupación (tipo, gama, proc, pantalla) similares al backend
  const extractAttrs = (p) => {
    const tipo = String(p?.tipo || '').toLowerCase();
    const d = p?.detalle || {};
    const sanitize = (s) => String(s)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9_]/g, '');
    let pantalla = null;
    for (const key of Object.keys(d || {})) {
      const k = sanitize(key);
      if (k.includes('tamano') || k.includes('tamanio') || k.includes('pantalla') || k.includes('screen') || k === 'tam' || k.includes('size')) {
        pantalla = d[key];
        break;
      }
    }
    if (!pantalla) {
      const candidates = Object.values(d || {}).filter((v) => typeof v === 'string');
      const known = ['10.2','10.9','11','12.9','13','14','15','16'];
      const hit = candidates.map(String).find(vs => known.find(x => vs.includes(x)));
      if (hit) pantalla = known.find(x => String(hit).includes(x)) || '';
    }
    const m = String(pantalla || '').match(/\d+(?:\.\d+)?/);
    const pant = m ? m[0] : (pantalla || '');
    const gama = d?.gama ? String(d.gama) : '';
    const proc = d?.procesador ? String(d.procesador) : '';
    return { tipo, gama, proc, pantalla: pant };
  };

  const attrsSel = useMemo(() => extractAttrs(producto || {}), [producto]);

  // Compras comparables (costo total) a partir del cache de productos
  const comprasComparables = useMemo(() => {
    if (!producto) return [];
    const { tipo, gama, proc, pantalla } = attrsSel;
    if (tipo !== 'macbook') return [];
    return (productosCache || [])
      .filter((p) => {
        const a = extractAttrs(p);
        if (a.tipo !== tipo) return false;
        return (String(a.gama||'') === String(gama||'')) && (String(a.proc||'') === String(proc||'')) && (String(a.pantalla||'') === String(pantalla||''));
      })
      .map((p) => Number(p?.valor?.costoTotal ?? 0))
      .filter((n) => isFinite(n) && n > 0)
      .sort((a,b)=>a-b);
  }, [producto, productosCache, attrsSel]);

  const avg = (arr) => arr.length ? +(arr.reduce((s,n)=>s+n,0)/arr.length).toFixed(2) : null;

  // Ventas comparables (lista de precios y márgenes)
  const ventasComparables = useMemo(() => {
    if (!producto) return [];
    const { tipo, gama, proc, pantalla } = attrsSel;
    if (tipo !== 'macbook') return [];
    return (ventas || [])
      .filter((v) => {
        const p = v?.producto;
        const a = extractAttrs(p || {});
        if (a.tipo !== tipo) return false;
        return (String(a.gama||'') === String(gama||'')) && (String(a.proc||'') === String(proc||'')) && (String(a.pantalla||'') === String(pantalla||''));
      })
      .map((v) => ({ precio: Number(v.precioVenta)||0, margen: Number(v.porcentajeGanancia)||0 }))
      .filter((x) => isFinite(x.precio) && x.precio > 0)
      .sort((a,b)=>a.precio-b.precio);
  }, [producto, ventas, attrsSel]);

  const ventasPrecios = useMemo(() => ventasComparables.map(x => x.precio), [ventasComparables]);
  const margenPromedio = useMemo(() => {
    const ms = ventasComparables.map(x => x.margen).filter((n)=>isFinite(n));
    return ms.length ? +(ms.reduce((s,n)=>s+n,0)/ms.length).toFixed(2) : null;
  }, [ventasComparables]);
  // costo usado: si hay TC válido, (valorUSD * TC) + envío; si no, costoBase
  const costoUsado = useMemo(() => {
    const tc = Number(tipoCambio);
    if (isFinite(tc) && tc > 0) return (valorUSD * tc) + envioSoles;
    return costoTotalBase;
  }, [tipoCambio, valorUSD, envioSoles, costoTotalBase]);

  // Sugerencias basadas en costo base
  const { pvMin,  pvMed } = useMemo(() => {
    const pvMinRounded = roundUp10(costoTotalBase * 1.20); // +20%
    const pvMedRounded = roundUp10(costoTotalBase * 1.40); // +40%
    return { pvMin: pvMinRounded, pvMed: pvMedRounded };
  }, [costoTotalBase]);

  // Personalizado con redondeo a 10 hacia arriba
  const customOut = useMemo(() => {
    const pcRaw = Number(precioCustom);
    const pc = isNaN(pcRaw) ? NaN : roundUp10(pcRaw);
    const ganancia = isNaN(pc) ? 0 : (pc - costoUsado);
    const pct = (!isNaN(pc) && costoUsado > 0) ? (ganancia / costoUsado) * 100 : 0;
    return { precio: pc, ganancia, pct };
  }, [precioCustom, costoUsado]);

  const gananciaMin = pvMin - costoTotalBase;
  const gananciaMed = pvMed - costoTotalBase;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full sm:max-w-lg rounded-xl shadow-lg p-6 relative mx-4 max-h-[90vh] overflow-y-auto">
        {/* Cerrar */}
        <button
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-800"
          onClick={onClose}
        >×</button>

        <h2 className="text-xl font-semibold mb-1">Calculadora rápida</h2>
        <p className="text-sm text-gray-600 mb-4">
          Producto: <span className="font-medium">{producto?.tipo}</span> — Costo total base:{' '}
          <span className="font-semibold">{fmtSoles(costoTotalBase)}</span>
        </p>

        {/* Sugerencias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">Precio mínimo (+20%)</div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMin)}</div>
            <div className="text-sm text-gray-700 mt-1">
              Ganancia: <strong>{fmtSoles(gananciaMin)}</strong>
            </div>
          </div>
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="text-sm text-gray-500 mb-1">Precio medio (+40%)</div>
            <div className="text-2xl font-semibold">{fmtSoles(pvMed)}</div>
            <div className="text-sm text-gray-700 mt-1">
              Ganancia: <strong>{fmtSoles(gananciaMed)}</strong>
            </div>
          </div>
        </div>

        {/* Personalizado con Tipo de Cambio */}
        <div className="border rounded-lg p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Precio personalizado (S/)</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full border rounded-lg p-2"
                placeholder="Ingresa un precio en soles"
                value={precioCustom}
                onChange={(e) => setPrecioCustom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Tipo de cambio (US$ → S/)</label>
              <input
                type="number"
                inputMode="decimal"
                className="w-full border rounded-lg p-2"
                placeholder="Opcional: p.ej. 3.80"
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value)}
              />
              <div className="text-xs text-gray-600 mt-1">
                Si ingresas TC, costo = (valor US$ × TC) + envío.
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-700 mt-3 space-y-1">
            <div className="flex justify-between"><span>Valor (US$):</span><strong>{isNaN(valorUSD) ? '-' : `$ ${valorUSD.toFixed(2)}`}</strong></div>
            <div className="flex justify-between"><span>Envío (S/):</span><strong>{fmtSoles(envioSoles)}</strong></div>
            <div className="flex justify-between"><span>Costo usado:</span><strong>{fmtSoles(costoUsado)}</strong></div>
            <div className="flex justify-between pt-1"><span>Precio aplicado (x10 arriba):</span><strong>{isNaN(customOut.precio) ? '-' : fmtSoles(customOut.precio)}</strong></div>
            <div className="flex justify-between"><span>Ganancia estimada:</span><strong>{fmtSoles(customOut.ganancia)}</strong></div>
            <div className="flex justify-between"><span>Margen sobre costo:</span><strong>{isNaN(customOut.pct) ? '-' : `${customOut.pct.toFixed(2)} %`}</strong></div>
          </div>
        </div>

        {/* Análisis comparables por producto */}
        {attrsSel.tipo === 'macbook' && (
          <div className="mt-4 grid grid-cols-1 gap-4">
            <div className="border rounded-lg p-4 bg-white">
              <div className="text-sm font-semibold mb-2">Compras comparables</div>
              <div className="text-xs text-gray-600 mb-2">Precio que se pagó (este producto): <strong>{fmtSoles(costoTotalBase)}</strong></div>
              {comprasComparables.length ? (
                <>
                  <div className="text-xs text-gray-700 mb-1">Todos los precios (S/):</div>
                  <div className="max-h-24 overflow-auto text-xs text-gray-800 border rounded p-2 bg-gray-50">
                    {comprasComparables.map((v, i) => (
                      <span key={`c-${i}`} className="inline-block mr-2 mb-1">{fmtSoles(v)}</span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-700 mt-2">Promedio compras: <strong>{fmtSoles(avg(comprasComparables))}</strong></div>
                </>
              ) : (
                <div className="text-xs text-gray-500">Sin comparables de compra.</div>
              )}
            </div>

            <div className="border rounded-lg p-4 bg-white">
              <div className="text-sm font-semibold mb-2">Ventas comparables</div>
              {ventasPrecios.length ? (
                <>
                  <div className="text-xs text-gray-700 mb-1">Todos los precios (S/):</div>
                  <div className="max-h-24 overflow-auto text-xs text-gray-800 border rounded p-2 bg-gray-50">
                    {ventasPrecios.map((v, i) => (
                      <span key={`v-${i}`} className="inline-block mr-2 mb-1">{fmtSoles(v)}</span>
                    ))}
                  </div>
                  <div className="text-xs text-gray-700 mt-2">Promedio ventas: <strong>{fmtSoles(avg(ventasPrecios))}</strong></div>
                  <div className="text-xs text-gray-700">Margen promedio: <strong>{margenPromedio != null ? `${margenPromedio.toFixed(2)} %` : '-'}</strong></div>
                </>
              ) : (
                <div className="text-xs text-gray-500">Sin ventas históricas para este grupo.</div>
              )}
            </div>

            <div className="border rounded-lg p-4 bg-emerald-50 border-emerald-200">
              <div className="text-sm font-semibold">Recomendación</div>
              {(() => {
                try {
                  const { tipo, gama, proc, pantalla } = attrsSel;
                  const g = (analytics?.productGroups || []).find((r) =>
                    String(r?.tipo||'') === String(tipo||'') &&
                    String(r?.gama||'') === String(gama||'') &&
                    String(r?.proc||'') === String(proc||'') &&
                    String(r?.pantalla||'') === String(pantalla||'')
                  );
                  const solMax = g ? Number(g?.recomendaciones?.compraMaxPara20?.max ?? 0) || null : null;
                  const tc = (Number(tipoCambio) > 0 ? Number(tipoCambio) : TC_FIJO);
                  const usdMax = solMax != null && tc > 0 ? `$ ${(solMax / tc).toFixed(2)}` : '-';
                  return (
                    <>
                      <div className="text-xs text-gray-700 mt-1">Comprar hasta:</div>
                      <div className="text-xs text-gray-800">
                        <span className="mr-2">USD: <strong>{usdMax}</strong></span>
                        <span>Sol: <strong>{solMax != null ? fmtSoles(solMax) : '-'}</strong></span>
                      </div>
                      <div className="text-xs text-gray-700 mt-2">Precio de venta histórico (mín y máx):</div>
                      <div className="text-xs text-gray-800">
                        <span className="mr-2">Mín: <strong>{ventasPrecios.length ? fmtSoles(Math.min(...ventasPrecios)) : '-'}</strong></span>
                        <span>Máx: <strong>{ventasPrecios.length ? fmtSoles(Math.max(...ventasPrecios)) : '-'}</strong></span>
                      </div>
                    </>
                  );
                } catch {
                  return <div className="text-xs text-gray-500">Sin datos suficientes para recomendación.</div>;
                }
              })()}
            </div>
          </div>
        )}

        <div className="text-right mt-5">
          <button
            onClick={onClose}
            className="bg-gray-800 text-white px-5 py-2 rounded hover:bg-gray-900"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
