import React from 'react';

// Presentation only: amounts are formatted at the point of display, never parsed back.
export function formatDisplayMoney(value, currency = 'PEN') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return `${currency === 'USD' ? 'US$' : 'S/'} ${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

export function ActionButton({ variant = 'secondary', className = '', children, ...props }) {
  return <button type="button" className={`ux-button ux-button--${variant} ${className}`} {...props}>{children}</button>;
}

export function PageHeader({ title, description, eyebrow, actions }) {
  return <header className="ux-page-header">
    <div className="min-w-0">
      {eyebrow && <p className="ux-eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      {description && <p className="ux-description">{description}</p>}
    </div>
    {actions && <div className="ux-page-actions">{actions}</div>}
  </header>;
}

export function StatCard({ title, value, tone = 'neutral', loading = false }) {
  return <div className={`ux-stat ux-stat--${tone}`} aria-busy={loading}>
    <div className="ux-stat-label">{title}</div>
    <div className="ux-stat-value">{loading ? <span aria-label="Cargando" className="ux-placeholder">—</span> : value}</div>
  </div>;
}

export function Disclosure({ title, description, children, className = '', ...props }) {
  return <details className={`ux-disclosure ${className}`} {...props}>
    <summary><span>{title}{description && <small>{description}</small>}</span><span aria-hidden="true" className="ux-chevron">⌄</span></summary>
    <div className="ux-disclosure-body">{children}</div>
  </details>;
}

export function LoadingState({ children = 'Cargando información…' }) {
  return <div className="ux-notice" role="status"><span className="ux-loading-dot" aria-hidden="true" />{children}</div>;
}

export function ErrorState({ children }) {
  return <div className="ux-notice ux-notice--error" role="alert">{children}</div>;
}
