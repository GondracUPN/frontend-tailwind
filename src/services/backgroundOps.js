// Cola global de operaciones en segundo plano.
//
// Los modales validan, arman el payload y encolan la operación; luego se cierran
// sin esperar al servidor. La operación vive aquí (fuera de cualquier componente),
// así que sigue corriendo aunque se cierre el modal o se cambie de página.
//
// - `run(state)` recibe un objeto `state` que se conserva entre reintentos: los
//   pasos ya completados (p. ej. `state.savedId`) se guardan ahí para que un
//   reintento continúe desde el paso que falló y no repita escrituras.
// - `lockKey` serializa operaciones sobre la misma entidad (p. ej. `producto:12`).
// - `startTask/updateTask/finishTask` registran tareas largas (búsquedas) para
//   mostrarlas con progreso en la misma bandeja.
import { useSyncExternalStore } from 'react';

const MAX_PARALLEL = 3;
const SUCCESS_TTL_MS = 4000;

const items = new Map();
const listeners = new Set();
let snapshot = [];
let seq = 0;

const emit = () => {
  snapshot = Array.from(items.values()).map((item) => ({ ...item }));
  listeners.forEach((listener) => {
    try { listener(snapshot); } catch { /* ignore listener errors */ }
  });
};

export const subscribeBackgroundOps = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getBackgroundOps = () => snapshot;

const nextId = (prefix) => {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq}`;
};

// Sin respuesta del servidor (red caída o timeout): no sabemos si se guardó.
export const isUncertainError = (error) => !error?.status && !/^HTTP \d+/.test(String(error?.message || ''));

const errorMessage = (error) => {
  const raw = String(error?.message || error || 'Error desconocido');
  return raw.replace(/^HTTP \d+ - /, '').slice(0, 300) || 'Error desconocido';
};

const runtime = new Map(); // id -> { run, state, onSuccess, onError }

const isActive = (item) => item.kind === 'op' && (item.status === 'running' || item.status === 'queued');

const lockBusy = (lockKey, exceptId) => lockKey && Array.from(items.values())
  .some((item) => item.id !== exceptId && item.lockKey === lockKey && item.status === 'running');

const pump = () => {
  const running = Array.from(items.values()).filter((item) => item.kind === 'op' && item.status === 'running').length;
  let slots = MAX_PARALLEL - running;
  if (slots <= 0) return;
  const queued = Array.from(items.values())
    .filter((item) => item.kind === 'op' && item.status === 'queued')
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const item of queued) {
    if (slots <= 0) break;
    if (lockBusy(item.lockKey, item.id)) continue;
    slots -= 1;
    execute(item.id);
  }
};

async function execute(id) {
  const item = items.get(id);
  const rt = runtime.get(id);
  if (!item || !rt) return;
  items.set(id, { ...item, status: 'running', error: '', uncertain: false, startedAt: Date.now() });
  emit();
  try {
    const result = await rt.run(rt.state);
    items.set(id, { ...items.get(id), status: 'success', finishedAt: Date.now() });
    emit();
    try { rt.onSuccess?.(result, rt.state); } catch (e) { console.error('[backgroundOps] onSuccess', e); }
    setTimeout(() => {
      const current = items.get(id);
      if (current?.status === 'success') dismissOperation(id);
    }, SUCCESS_TTL_MS);
  } catch (error) {
    console.error(`[backgroundOps] ${item.label}:`, error);
    items.set(id, {
      ...items.get(id),
      status: 'error',
      error: errorMessage(error),
      uncertain: Boolean(rt.uncertainOnNetworkError?.(rt.state)) && isUncertainError(error),
      // onEdit(state) devuelve una función que reabre el formulario, o null si ya no es seguro.
      editable: Boolean(rt.onEdit?.(rt.state)),
      finishedAt: Date.now(),
    });
    emit();
    try { rt.onError?.(error, rt.state); } catch { /* ignore */ }
  } finally {
    pump();
  }
}

/**
 * Encola una operación de escritura.
 * @param {object} options
 * @param {string} options.label  Texto visible en la bandeja.
 * @param {(state: object) => Promise<any>} options.run
 * @param {string} [options.lockKey] Serializa operaciones sobre la misma entidad.
 * @param {(state: object) => boolean} [options.uncertainOnNetworkError] Devuelve true
 *   si, ante un error sin respuesta, un reintento podría duplicar (p. ej. una alta
 *   sin clave idempotente que todavía no se confirmó).
 * @returns {string} id de la operación
 */
export function enqueueOperation({ label, run, lockKey = '', onSuccess, onError, uncertainOnNetworkError, onEdit, state = {} }) {
  const id = nextId('op');
  runtime.set(id, { run, state, onSuccess, onError, uncertainOnNetworkError, onEdit });
  items.set(id, { id, kind: 'op', label: String(label || 'Operación'), lockKey, status: 'queued', error: '', uncertain: false, createdAt: Date.now() });
  emit();
  pump();
  return id;
}

export function retryOperation(id) {
  const item = items.get(id);
  if (!item || item.kind !== 'op' || item.status !== 'error') return;
  items.set(id, { ...item, status: 'queued', error: '', uncertain: false });
  emit();
  pump();
}

// Descarta la operación fallida y reabre su formulario con los datos enviados.
export function editOperation(id) {
  const item = items.get(id);
  const rt = runtime.get(id);
  if (!item || item.status !== 'error' || !rt?.onEdit) return;
  const reopen = rt.onEdit(rt.state);
  if (!reopen) return;
  items.delete(id);
  runtime.delete(id);
  emit();
  reopen();
}

export function dismissOperation(id) {
  const item = items.get(id);
  if (!item || isActive(item) || (item.kind === 'task' && item.status === 'running')) return;
  items.delete(id);
  runtime.delete(id);
  emit();
}

export const isLocked = (lockKey) => Boolean(lockKey) && Array.from(items.values())
  .some((item) => item.lockKey === lockKey && isActive(item));

export const hasPendingOperations = () => Array.from(items.values()).some(isActive);
// Errores sin resolver: al recargar se perdería el borrador para Reintentar/Editar.
const hasUnsavedWork = () => Array.from(items.values()).some((item) => isActive(item) || (item.kind === 'op' && item.status === 'error'));

// ---- Tareas largas (búsquedas) ----
// `view`: vista donde la tarea ya se ve en pantalla; la bandeja la oculta ahí.
export function startTask(key, { label, progress = '', onCancel, view = '' } = {}) {
  const id = `task-${key}`;
  runtime.set(id, { onCancel });
  items.set(id, { id, kind: 'task', label: String(label || key), progress, view, cancellable: Boolean(onCancel), status: 'running', error: '', createdAt: Date.now() });
  emit();
  return id;
}
export function updateTask(key, patch = {}) {
  const id = `task-${key}`;
  const item = items.get(id);
  if (!item) return;
  items.set(id, { ...item, ...patch });
  emit();
}
export function finishTask(key, { error = '', progress } = {}) {
  const id = `task-${key}`;
  const item = items.get(id);
  if (!item) return;
  items.set(id, { ...item, status: error ? 'error' : 'success', error: error ? errorMessage(error) : '', ...(progress !== undefined ? { progress } : {}), finishedAt: Date.now() });
  emit();
  if (!error) {
    setTimeout(() => {
      if (items.get(id)?.status === 'success') dismissOperation(id);
    }, SUCCESS_TTL_MS);
  }
}
export function cancelTask(key) {
  const id = `task-${key}`;
  const rt = runtime.get(id);
  if (!items.has(id)) return;
  // Se borra antes de avisar: onCancel puede volver a llamar a cancelTask.
  items.delete(id);
  runtime.delete(id);
  emit();
  try { rt?.onCancel?.(); } catch { /* ignore */ }
}

export const useBackgroundOps = () => useSyncExternalStore(subscribeBackgroundOps, getBackgroundOps, getBackgroundOps);

// Solo para pruebas.
export function __resetBackgroundOps() {
  items.clear();
  runtime.clear();
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (event) => {
    if (!hasUnsavedWork()) return undefined;
    event.preventDefault();
    // eslint-disable-next-line no-param-reassign
    event.returnValue = 'Hay operaciones guardándose. Si sales ahora podrían perderse.';
    return event.returnValue;
  });
}
