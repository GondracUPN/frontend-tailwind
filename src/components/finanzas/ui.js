import React from 'react';

export const money = (value) => (value == null || Number.isNaN(Number(value))
  ? '—'
  : Number(value).toLocaleString('es-PE', { style: 'currency', currency: 'PEN' }));

export const fecha = (value) => {
  if (!value) return 'Sin fecha';
  const [y, m, d] = String(value).slice(0, 10).split('-');
  return d ? `${d}/${m}/${y}` : String(value);
};

export const hoy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

const TONOS = {
  verde: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  ambar: 'bg-amber-50 text-amber-800 ring-amber-200',
  rojo: 'bg-red-50 text-red-700 ring-red-200',
  azul: 'bg-sky-50 text-sky-700 ring-sky-200',
  violeta: 'bg-violet-50 text-violet-700 ring-violet-200',
  gris: 'bg-slate-100 text-slate-600 ring-slate-200',
};

export const ESTADOS = {
  pendiente: ['Pendiente', 'ambar'],
  parcialmente_pagado: ['Pago parcial', 'ambar'],
  pagado: ['Pagado', 'verde'],
  devuelto: ['Devuelto', 'gris'],
  disputado: ['En disputa', 'rojo'],
  conciliacion_pendiente: ['Por conciliar', 'violeta'],
  no_requiere: ['Directo', 'gris'],
  pendiente_liquidacion: ['Por liquidar', 'azul'],
  parcialmente_liquidado: ['Liquidación parcial', 'azul'],
  liquidado: ['Liquidado', 'verde'],
  disponible: ['Disponible', 'verde'],
  anulado: ['Anulado', 'gris'],
  incidencia: ['Incidencia', 'ambar'],
  en_transito: ['En tránsito', 'azul'],
  reclamo_abierto: ['Reclamo abierto', 'ambar'],
  aprobado: ['Aprobado', 'azul'],
  reembolso_parcial: ['Reembolso parcial', 'azul'],
  recibido: ['Reembolsado', 'verde'],
  rechazado: ['Rechazado', 'rojo'],
  perdida_definitiva: ['Pérdida definitiva', 'rojo'],
  pendiente_hist: ['Por conciliar', 'violeta'],
};

export function Estado({ value, label }) {
  const [texto, tono] = ESTADOS[value] || [label || value || '—', 'gris'];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}>{label || texto}</span>;
}

export function Cifra({ label, value, hint, tone, onClick, extra }) {
  const color = tone === 'bad' ? 'text-red-700' : tone === 'good' ? 'text-emerald-700' : 'text-slate-950';
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={hint}
      className={`min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left ${onClick ? 'hover:border-slate-400 hover:shadow-sm' : ''}`}>
      <span className="block truncate text-xs font-medium text-slate-500">{label}</span>
      <strong className={`mt-1 block truncate text-lg tabular-nums ${color}`}>{value}</strong>
      {extra && <span className="mt-0.5 block text-xs text-slate-500">{extra}</span>}
    </Tag>
  );
}

export function Seccion({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Vacio({ children }) {
  return <p className="rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
      <span>{error}</span>
      {onRetry && <button type="button" onClick={onRetry} className="rounded border border-red-300 bg-white px-2 py-1 text-xs">Reintentar</button>}
    </div>
  );
}

export function AvisoSesion() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      Los datos financieros requieren una sesión de administrador. Inicia sesión en <strong>Gastos</strong> con una cuenta administradora y vuelve a esta sección.
    </div>
  );
}

export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200';
export const btnCls = 'rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50';
export const btnPrimaryCls = 'rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50';

export function Campo({ label, children, className = '' }) {
  return (
    <label className={`block min-w-0 text-xs font-medium text-slate-600 ${className}`}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
