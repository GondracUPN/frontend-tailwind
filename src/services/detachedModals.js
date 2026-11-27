// Modales abiertos fuera de la página que los creó (p. ej. reabrir un formulario
// cuyo guardado en segundo plano falló). App monta <DetachedModalsHost />.
import { useSyncExternalStore } from 'react';

let modals = [];
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

/** @param {(close: () => void) => import('react').ReactNode} render */
export function openDetachedModal(render) {
  seq += 1;
  const id = `modal-${seq}`;
  modals = [...modals, { id, render }];
  emit();
  return id;
}

export function closeDetachedModal(id) {
  modals = modals.filter((modal) => modal.id !== id);
  emit();
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useDetachedModals = () => useSyncExternalStore(subscribe, () => modals, () => modals);
