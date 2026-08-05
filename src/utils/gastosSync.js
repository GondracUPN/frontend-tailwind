export const GASTOS_CHANGED_EVENT = 'gastos:changed';
const GASTOS_CHANGED_KEY = 'gastos:lastChanged';

const clearGastosCaches = () => {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('gastos-panel-cache:'))
      .forEach((key) => localStorage.removeItem(key));
  } catch {}
};

export const notifyGastosChanged = (detail = {}) => {
  clearGastosCaches();
  const payload = { ...detail, timestamp: Date.now() };
  try {
    localStorage.setItem(GASTOS_CHANGED_KEY, JSON.stringify(payload));
  } catch {}
  window.dispatchEvent(new CustomEvent(GASTOS_CHANGED_EVENT, { detail: payload }));
};

export const subscribeGastosChanges = (handler) => {
  let timer = null;
  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => handler(), 60);
  };
  const onStorage = (event) => {
    if (event.key === GASTOS_CHANGED_KEY) schedule();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'visible') schedule();
  };

  window.addEventListener(GASTOS_CHANGED_EVENT, schedule);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', schedule);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    window.clearTimeout(timer);
    window.removeEventListener(GASTOS_CHANGED_EVENT, schedule);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
  };
};

