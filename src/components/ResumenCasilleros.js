// src/components/ResumenCasilleros.js
import React, { useMemo, useState } from 'react';

// Casilleros a mostrar
export const CASILLEROS = ['Walter','Renato','Christian','Alex','MamaRen','Jorge','Kenny','Sebastian'];
// Monto DEC (USD) que puede tener en camino un casillero; desde este monto ya no recibe.
export const LIMITE_DEC_USD = 200;
const CASI_LLENO_PCT = 70;
const COLLAPSE_KEY = 'productos:casilleros:collapsed';

const fmtUSD = (v) => {
  const n = Number(v);
  if (!isFinite(n)) return '$ -';
  return `$ ${n.toFixed(2)}`;
};

/**
 * Espera productos con p.tracking?.[0]?.casillero y p.tracking?.[0]?.estado.
 * Cuenta solo paquetes no recogidos y sin despacho; el DEC se suma una vez por grupo de envio.
 * Devuelve los casilleros ordenados: primero los que pueden recibir, de mayor a menor saldo libre.
 */
export function computeCasilleroStats(productos = []) {
  const base = CASILLEROS.reduce((acc, c) => {
    acc[c] = { total: 0, actuales: 0, decActualUSD: 0, seenDec: new Set() };
    return acc;
  }, {});

  for (const p of productos || []) {
    const t = p?.tracking?.[0];
    const cas = t?.casillero;
    if (!cas || !base[cas]) continue;

    base[cas].total += 1;
    const estado = (t?.estado || '').toLowerCase();
    const noCuentaCasillero = Boolean(p?.despacho);
    if (estado !== 'recogido' && !noCuentaCasillero) {
      base[cas].actuales += 1;
      const decUSD = Number(p?.valor?.valorDec ?? 0);
      const groupKeyRaw = p?.envioGrupoId ?? p?.envioGrupo ?? p?.envioGrupoID ?? p?.id;
      const groupKey = String(groupKeyRaw ?? p?.id ?? '');
      if (isFinite(decUSD) && groupKey && !base[cas].seenDec.has(groupKey)) {
        base[cas].decActualUSD += decUSD;
        base[cas].seenDec.add(groupKey);
      }
    }
  }

  return CASILLEROS.map((nombre, orden) => {
    const { total, actuales, decActualUSD } = base[nombre];
    const libreUSD = Math.max(0, LIMITE_DEC_USD - decActualUSD);
    const pct = Math.min((decActualUSD / LIMITE_DEC_USD) * 100, 100);
    const nivel = decActualUSD >= LIMITE_DEC_USD ? 'lleno' : pct >= CASI_LLENO_PCT ? 'casi' : 'libre';
    return { nombre, orden, total, actuales, decActualUSD, libreUSD, pct, nivel, puedeRecibir: nivel !== 'lleno' };
  }).sort((a, b) => (Number(b.puedeRecibir) - Number(a.puedeRecibir)) || (b.libreUSD - a.libreUSD) || (a.orden - b.orden));
}

const NIVEL_UI = {
  libre: { label: 'Puede recibir', bar: 'bg-emerald-500' },
  casi: { label: 'Casi lleno', bar: 'bg-amber-500' },
  lleno: { label: 'Lleno', bar: 'bg-red-500' },
};

const readCollapsed = () => {
  try { return window.localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
};

export default function ResumenCasilleros({ productos = [], loading = false, onCasilleroClick }) {
  const stats = useMemo(() => computeCasilleroStats(productos), [productos]);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [montoCompra, setMontoCompra] = useState('');

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0'); } catch { /* sin almacenamiento */ }
      return next;
    });
  };

  const monto = Number(String(montoCompra).replace(',', '.'));
  const hayMonto = montoCompra !== '' && isFinite(monto) && monto > 0;
  const disponibles = stats.filter((c) => c.puedeRecibir && (!hayMonto || c.libreUSD >= monto));

  const resumenRapido = hayMonto
    ? (disponibles.length ? `${disponibles.length} aceptan ${fmtUSD(monto)}` : `Ninguno tiene ${fmtUSD(monto)} libres`)
    : (disponibles.length ? `${disponibles.length} de ${stats.length} pueden recibir` : 'Ninguno puede recibir');

  return (
    <section className="ux-casilleros" aria-labelledby="casilleros-title">
      <div className="ux-casilleros-head">
        <h2 id="casilleros-title">Casilleros</h2>
        {!loading && <span className="ux-casilleros-quick">{resumenRapido}</span>}
        <label className="ux-casilleros-monto" title="Escribe el valor declarado de tu compra para ver qué casilleros la aceptan">
          <span>Mi compra declara</span>
          <span className="ux-casilleros-monto-input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="0.00"
              aria-label="¿Cuánto declara tu compra?"
              value={montoCompra}
              onChange={(e) => setMontoCompra(e.target.value)}
            />
          </span>
        </label>
        <button type="button" className="ux-link-button" onClick={toggleCollapsed} aria-expanded={!collapsed} aria-controls="casilleros-grid">
          {collapsed ? 'Mostrar' : 'Ocultar'}
        </button>
      </div>

      {!collapsed && (
        <div id="casilleros-grid" className="ux-casilleros-grid">
          {loading
            ? CASILLEROS.map((k) => <div key={k} className="ux-casillero h-14 animate-pulse bg-slate-50" />)
            : stats.map((c) => {
              const ui = NIVEL_UI[c.nivel];
              const aceptaMonto = hayMonto && c.puedeRecibir && c.libreUSD >= monto;
              const open = () => { if (onCasilleroClick) onCasilleroClick(c.nombre); };
              const detalle = `${c.nombre}: ${ui.label}. ${fmtUSD(c.libreUSD)} libres de ${fmtUSD(LIMITE_DEC_USD)}, ${c.actuales === 1 ? '1 paquete' : `${c.actuales} paquetes`} en camino (usado ${fmtUSD(c.decActualUSD)}).`;
              return (
                <div
                  key={c.nombre}
                  role={onCasilleroClick ? 'button' : undefined}
                  tabIndex={onCasilleroClick ? 0 : undefined}
                  onClick={open}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } }}
                  className={`ux-casillero ux-casillero--${c.nivel} ${aceptaMonto ? 'ux-casillero--match' : ''} ${hayMonto && !aceptaMonto ? 'opacity-40' : ''}`}
                  title={detalle}
                  aria-label={detalle}
                >
                  <div className="ux-casillero-row">
                    <span className="ux-casillero-name"><span className={`ux-dot ${ui.bar}`} aria-hidden="true" />{c.nombre}</span>
                    <span className="ux-casillero-libre">{fmtUSD(c.libreUSD)}</span>
                  </div>
                  <div className="ux-casillero-meta">
                    <span><strong>{c.actuales}</strong> {c.actuales === 1 ? 'paquete' : 'paquetes'}</span>
                    <span>libre</span>
                  </div>
                  <div className="ux-casillero-bar" aria-hidden="true"><div className={ui.bar} style={{ width: `${c.pct}%` }} /></div>
                </div>
              );
            })}
        </div>
      )}
    </section>
  );
}
