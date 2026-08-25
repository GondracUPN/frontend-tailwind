export const SALES_UPDATED_EVENT = 'ventas-updated';

const clearStaleSalesCaches = () => {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('ganancias:cache:') || key.startsWith('analytics:lastSummary:')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    /* ignore unavailable storage */
  }
};

export const notifySalesChanged = (detail = {}) => {
  clearStaleSalesCaches();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SALES_UPDATED_EVENT, { detail }));
  }
};
