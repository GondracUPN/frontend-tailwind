// Estado por clave que vive fuera del componente (store de módulo).
//
// Sirve para que un proceso largo iniciado en una página (p. ej. la búsqueda de
// eBay) siga escribiendo su resultado aunque la página se desmonte al navegar, y
// para que al volver la página muestre el estado actual. Funciona como useState:
// el setter acepta un valor o una función `prev => next`, y se puede llamar
// después del desmontaje.
import { useCallback, useSyncExternalStore } from 'react';

const values = new Map();
const listeners = new Map();

const notify = (key) => {
  (listeners.get(key) || []).forEach((listener) => listener());
};

export function readSharedState(key, initial) {
  if (!values.has(key)) values.set(key, typeof initial === 'function' ? initial() : initial);
  return values.get(key);
}

export function writeSharedState(key, next) {
  const prev = values.get(key);
  const value = typeof next === 'function' ? next(prev) : next;
  if (Object.is(prev, value)) return;
  values.set(key, value);
  notify(key);
}

const subscribe = (key, listener) => {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(listener);
  return () => listeners.get(key)?.delete(listener);
};

export default function useSharedState(key, initial) {
  readSharedState(key, initial);
  const value = useSyncExternalStore(
    useCallback((listener) => subscribe(key, listener), [key]),
    () => values.get(key),
    () => values.get(key),
  );
  const setValue = useCallback((next) => writeSharedState(key, next), [key]);
  return [value, setValue];
}

// Solo para pruebas.
export function __resetSharedState(prefix = '') {
  Array.from(values.keys()).forEach((key) => {
    if (key.startsWith(prefix)) values.delete(key);
  });
}

if (typeof window !== 'undefined') {
  // Los resultados son por sesión: al cambiar de usuario se descartan.
  ['auth:logout', 'auth:expired'].forEach((event) => window.addEventListener(event, () => __resetSharedState()));
}
