import React from 'react';

export default function ModalCloseButton({ onClick, className = '', label = 'Cerrar modal' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Cerrar"
      className={`modal-close-button absolute right-3 top-3 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-md transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${className}`}
    />
  );
}
