import { notifyGastosChanged } from './gastosSync';
export const SALES_UPDATED_EVENT = 'ventas-updated';

const clearStaleSalesCaches = () => {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (['ganancias:cache:', 'analytics:lastSummary:', 'productos:cache:', 'inventario:cache:'].some((prefix) => key.startsWith(prefix))) {
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
    notifyGastosChanged(detail);
    window.dispatchEvent(new CustomEvent('productos-updated', { detail: { source: 'sales', ...detail } }));
  }
};
