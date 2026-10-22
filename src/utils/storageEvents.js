export const STORAGE_UPDATED = 'servicios-storage-updated';
let scheduled = false;
function notify() {
  if (scheduled) return;
  scheduled = true;
  Promise.resolve().then(() => {
    scheduled = false;
    window.dispatchEvent(new CustomEvent(STORAGE_UPDATED));
  });
}
export function setStoredValue(key, value) {
  const text = String(value);
  if (localStorage.getItem(key) === text) return;
  localStorage.setItem(key, text);
  notify();
}
export function removeStoredValue(key) {
  if (localStorage.getItem(key) === null) return;
  localStorage.removeItem(key);
  notify();
}
export function subscribeStorage(listener) {
  window.addEventListener('storage', listener);
  window.addEventListener(STORAGE_UPDATED, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(STORAGE_UPDATED, listener);
  };
}

export function subscribePolling(callback, intervalMs, view) {
  let timer;
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    try { await callback(); } finally { busy = false; }
  };
  const update = () => {
    clearInterval(timer);
    const activeView = document.documentElement.dataset.activeView;
    if (document.hidden || (view && activeView && activeView !== view)) return;
    run();
    timer = setInterval(run, intervalMs);
  };
  document.addEventListener('visibilitychange', update);
  window.addEventListener('app-view-activated', update);
  update();
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', update);
    window.removeEventListener('app-view-activated', update);
  };
}
