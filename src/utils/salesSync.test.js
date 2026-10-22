import { notifySalesChanged } from './salesSync';
import { subscribeGastosChanges } from './gastosSync';

test('una operación de venta invalida cachés y actualiza los cuadros de dinero y stock', () => {
  jest.useFakeTimers();
  localStorage.setItem('gastos-panel-cache:1', 'viejo');
  localStorage.setItem('productos:cache:v2', 'viejo');
  localStorage.setItem('ganancias:cache:1', 'viejo');
  const gastos = jest.fn(); const stock = jest.fn();
  const unsubscribe = subscribeGastosChanges(gastos);
  window.addEventListener('productos-updated', stock);
  notifySalesChanged({ action: 'quick-sale' });
  jest.advanceTimersByTime(60);
  expect(gastos).toHaveBeenCalledTimes(1); expect(stock).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('gastos-panel-cache:1')).toBeNull();
  expect(localStorage.getItem('productos:cache:v2')).toBeNull();
  expect(localStorage.getItem('ganancias:cache:1')).toBeNull();
  unsubscribe(); window.removeEventListener('productos-updated', stock); localStorage.clear(); jest.useRealTimers();
});
