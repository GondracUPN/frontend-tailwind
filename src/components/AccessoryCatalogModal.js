import React, { useEffect, useRef } from 'react';
import { FiUploadCloud, FiX } from 'react-icons/fi';
import AccessoryCatalogPanel from './AccessoryCatalogPanel';

export default function AccessoryCatalogModal({ open, revision, onEdit, onClose, editorHostRef, editorOpen }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);
  useEffect(() => {
    if (!editorOpen) return;
    const previousFocus = document.activeElement;
    editorHostRef?.current?.querySelector('button, input, select, textarea')?.focus();
    return () => { previousFocus?.focus(); };
  }, [editorOpen, editorHostRef]);

  return <dialog ref={dialogRef} aria-labelledby="accessory-catalog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_1.5rem)] max-w-7xl overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-2xl backdrop:bg-slate-950/55 backdrop:backdrop-blur-sm">
    <div inert={editorOpen ? true : undefined}>
      <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><FiUploadCloud className="h-6 w-6" /></span>
          <div><h2 id="accessory-catalog-title" className="text-lg font-semibold text-slate-950">Catálogo de accesorios</h2><p className="text-sm text-slate-500">Administra cuáles mostrar en Servicios</p></div>
        </div>
        <button type="button" autoFocus onClick={onClose} aria-label="Cerrar catálogo de accesorios" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-indigo-600"><FiX className="h-5 w-5" /></button>
      </header>
      <AccessoryCatalogPanel revision={revision} onEdit={onEdit} open={open} />
    </div>
    <div ref={editorHostRef} />
  </dialog>;
}
