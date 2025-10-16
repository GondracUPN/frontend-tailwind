import React from 'react';

export default function CloseX({ onClick, className = '', title = 'Cerrar', ariaLabel = 'Cerrar' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={`absolute top-4 right-4 inline-flex items-center justify-center w-8 h-8 rounded-full border border-gray-200 bg-white/80 text-gray-700 shadow-sm hover:bg-white focus:outline-none focus:ring-2 focus:ring-violet-300 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id="closex_grad" x1="0" y1="0" x2="18" y2="18" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1"/>
            <stop offset="100%" stopColor="#A855F7"/>
          </linearGradient>
        </defs>
        <path d="M2 2 L16 16" stroke="url(#closex_grad)" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M16 2 L2 16" stroke="url(#closex_grad)" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </button>
  );
}
