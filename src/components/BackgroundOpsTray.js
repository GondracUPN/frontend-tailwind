import React, { useState } from 'react';
import { cancelTask, dismissOperation, editOperation, retryOperation, useBackgroundOps } from '../services/backgroundOps';

const STATUS_TEXT = { queued: 'En cola', running: 'En proceso', success: 'Listo', error: 'Error' };
const STATUS_CLASS = {
  queued: 'bg-slate-100 text-slate-700',
  running: 'bg-indigo-100 text-indigo-700',
  success: 'bg-emerald-100 text-emerald-700',
  error: 'bg-rose-100 text-rose-700',
};

const isWideScreen = () => {
  try { return window.matchMedia('(min-width: 1024px)').matches; } catch { return true; }
};

export default function BackgroundOpsTray({ activeView = '' }) {
  const allOps = useBackgroundOps();
  // En pantallas estrechas empieza como una pastilla para no tapar el modal siguiente.
  const [expanded, setExpanded] = useState(isWideScreen);
  // Una tarea de búsqueda ya tiene su propio indicador dentro de su vista.
  const ops = allOps.filter((op) => !(op.kind === 'task' && op.view && op.view === activeView));
  if (!ops.length) return null;
  const pending = ops.filter((op) => op.status === 'running' || op.status === 'queued').length;
  const errors = ops.filter((op) => op.status === 'error').length;
  const summary = [pending ? `${pending} en proceso` : '', errors ? `${errors} con error` : '', !pending && !errors ? 'Listo' : '']
    .filter(Boolean).join(' · ');
  return (
    <aside
      aria-label="Operaciones en segundo plano"
      className="fixed bottom-3 right-3 z-[70] flex w-[min(22rem,calc(100vw-1.5rem))] flex-col items-end gap-2"
    >
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className={`rounded-full px-3 py-1 text-xs font-medium text-white shadow ${errors ? 'bg-rose-600' : 'bg-slate-900'}`}
      >
        {summary}{expanded ? ' · ocultar' : ''}
      </button>
      {expanded && ops.slice(-6).map((op) => (
        <div key={op.id} role="status" className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-lg">
          <div className="flex items-start gap-2">
            {(op.status === 'running' || op.status === 'queued') && (
              <span aria-hidden="true" className="mt-1 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium text-slate-900">{op.label}</span>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_CLASS[op.status] || ''}`}>
                  {STATUS_TEXT[op.status] || op.status}
                </span>
              </div>
              {op.progress && op.status !== 'error' && <p className="mt-0.5 truncate text-xs text-slate-500">{op.progress}</p>}
              {op.error && <p className="mt-1 break-words text-xs text-rose-700">{op.error}</p>}
              {op.uncertain && (
                <p className="mt-1 text-xs text-amber-700">
                  Sin respuesta del servidor: puede que sí se haya guardado. Revisa la lista antes de reintentar.
                </p>
              )}
            </div>
          </div>
          {(op.status === 'error' || op.status === 'success' || (op.kind === 'task' && op.cancellable)) && (
            <div className="mt-2 flex justify-end gap-2">
              {op.kind === 'op' && op.status === 'error' && op.editable && (
                <button type="button" onClick={() => editOperation(op.id)} className="rounded-md border border-indigo-300 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                  Editar
                </button>
              )}
              {op.kind === 'op' && op.status === 'error' && (
                <button type="button" onClick={() => retryOperation(op.id)} className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                  Reintentar
                </button>
              )}
              {op.kind === 'task' && op.status === 'running' ? (
                <button type="button" onClick={() => cancelTask(op.id.replace(/^task-/, ''))} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                  Detener
                </button>
              ) : (
                <button type="button" onClick={() => dismissOperation(op.id)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
                  Cerrar
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </aside>
  );
}
