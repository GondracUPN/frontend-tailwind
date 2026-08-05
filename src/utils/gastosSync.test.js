import { notifyGastosChanged, subscribeGastosChanges } from './gastosSync';

describe('gastosSync', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('invalida la cache y avisa a las vistas abiertas', () => {
    localStorage.setItem('gastos-panel-cache:1', '{"rows":[]}');
    localStorage.setItem('otra-cache', 'conservar');
    const handler = jest.fn();
    const unsubscribe = subscribeGastosChanges(handler);

    notifyGastosChanged({ action: 'create', gastoId: 9 });
    jest.advanceTimersByTime(60);

    expect(localStorage.getItem('gastos-panel-cache:1')).toBeNull();
    expect(localStorage.getItem('otra-cache')).toBe('conservar');
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
  });
});
