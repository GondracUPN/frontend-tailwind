import { act, renderHook } from '@testing-library/react';
import api from '../api';
import useAccessoryQuote from './useAccessoryQuote';

jest.mock('../api', () => ({ __esModule: true, default: { post: jest.fn() } }));
beforeEach(() => { jest.useFakeTimers(); api.post.mockReset(); api.post.mockResolvedValue({ cotizacionToken: 'a'.repeat(64), costoTotal: 10 }); });
afterEach(() => { jest.useRealTimers(); });
const base = { enabled: true, productoId: 1, cantidad: 1, precioUnitario: '' };

test('escribir 125 dispara una sola solicitud tras 300 ms y mantiene pendiente la confirmación', async () => {
  const { result, rerender } = renderHook((props) => useAccessoryQuote(props), { initialProps: base });
  rerender({ ...base, precioUnitario: '1' });
  act(() => jest.advanceTimersByTime(100));
  rerender({ ...base, precioUnitario: '12' });
  act(() => jest.advanceTimersByTime(100));
  rerender({ ...base, precioUnitario: '125' });
  expect(result.current.loading).toBe(true);
  act(() => jest.advanceTimersByTime(299));
  expect(api.post).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post).toHaveBeenCalledWith('/ventas/accesorios/cotizar', { productoId: 1, cantidad: 1, precioUnitario: 125 });
  expect(result.current.loading).toBe(false);
  act(() => result.current.refresh());
  await act(async () => { jest.advanceTimersByTime(0); });
  expect(api.post).toHaveBeenCalledTimes(2);
});

test('descarta respuestas viejas aunque terminen después de la nueva cantidad', async () => {
  let oldResolve;
  api.post.mockImplementationOnce(() => new Promise((resolve) => { oldResolve = resolve; }));
  const { result, rerender } = renderHook((props) => useAccessoryQuote(props), { initialProps: base });
  await act(async () => { jest.advanceTimersByTime(300); });
  rerender({ ...base, cantidad: 2 });
  await act(async () => { jest.advanceTimersByTime(300); });
  await act(async () => { oldResolve({ cotizacionToken: 'old', costoTotal: 999 }); });
  expect(result.current.quote.costoTotal).toBe(10);
});

test('volver a un precio ya cotizado mantiene bloqueada la confirmación hasta terminar la nueva solicitud', async () => {
  const { result, rerender } = renderHook((props) => useAccessoryQuote(props), { initialProps: { ...base, precioUnitario: '1' } });
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(result.current.quote).toBeTruthy();
  rerender({ ...base, precioUnitario: '12' });
  rerender({ ...base, precioUnitario: '1' });
  expect(result.current.loading).toBe(true);
  expect(result.current.quote).toBeFalsy();
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(result.current.loading).toBe(false);
});
