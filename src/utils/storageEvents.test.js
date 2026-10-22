import { subscribePolling } from './storageEvents';

test('el sondeo de progreso se pausa con la pestaña oculta y la vista inactiva', async () => {
  jest.useFakeTimers();
  const descriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
  const previousView = document.documentElement.dataset.activeView;
  let hidden = false;
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.documentElement.dataset.activeView = 'productos';
  const callback = jest.fn(async () => {});
  const stop = subscribePolling(callback, 700, 'productos');
  try {
    await Promise.resolve();
    expect(callback).toHaveBeenCalledTimes(1);
    hidden = true;
    document.dispatchEvent(new Event('visibilitychange'));
    jest.advanceTimersByTime(7000);
    expect(callback).toHaveBeenCalledTimes(1);
    hidden = false;
    document.documentElement.dataset.activeView = 'home';
    window.dispatchEvent(new Event('app-view-activated'));
    jest.advanceTimersByTime(7000);
    expect(callback).toHaveBeenCalledTimes(1);
    document.documentElement.dataset.activeView = 'productos';
    window.dispatchEvent(new Event('app-view-activated'));
    expect(callback).toHaveBeenCalledTimes(2);
  } finally {
    stop();
    if (descriptor) Object.defineProperty(document, 'hidden', descriptor);
    else delete document.hidden;
    if (previousView === undefined) delete document.documentElement.dataset.activeView;
    else document.documentElement.dataset.activeView = previousView;
    jest.useRealTimers();
  }
});
