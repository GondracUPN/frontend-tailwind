import {
  __resetBackgroundOps, enqueueOperation, getBackgroundOps, hasPendingOperations, isLocked, retryOperation,
  startTask, finishTask, cancelTask,
} from './backgroundOps';

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const deferred = () => { let resolve; let reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; };

beforeEach(() => __resetBackgroundOps());

test('varias operaciones corren en paralelo sin esperar unas a otras', async () => {
  const a = deferred();
  const b = deferred();
  const runA = jest.fn(() => a.promise);
  const runB = jest.fn(() => b.promise);
  enqueueOperation({ label: 'A', run: runA });
  enqueueOperation({ label: 'B', run: runB });
  await flush();
  expect(runA).toHaveBeenCalled();
  expect(runB).toHaveBeenCalled();
  expect(hasPendingOperations()).toBe(true);
  b.resolve('ok');
  await flush();
  expect(getBackgroundOps().find((op) => op.label === 'B').status).toBe('success');
  expect(getBackgroundOps().find((op) => op.label === 'A').status).toBe('running');
  a.resolve('ok');
  await flush();
  expect(hasPendingOperations()).toBe(false);
});

test('las operaciones sobre la misma entidad se aplican en orden', async () => {
  const first = deferred();
  const order = [];
  enqueueOperation({ label: '1', lockKey: 'producto:7', run: async () => { order.push('start1'); await first.promise; order.push('end1'); } });
  enqueueOperation({ label: '2', lockKey: 'producto:7', run: async () => { order.push('start2'); } });
  await flush();
  expect(order).toEqual(['start1']);
  expect(isLocked('producto:7')).toBe(true);
  first.resolve();
  await flush(); await flush();
  expect(order).toEqual(['start1', 'end1', 'start2']);
});

test('reintentar continúa desde el paso que falló sin repetir los ya hechos', async () => {
  const post = jest.fn(async () => ({ id: 9 }));
  let expenseFails = true;
  const expense = jest.fn(async () => { if (expenseFails) throw Object.assign(new Error('HTTP 500 - caído'), { status: 500 }); });
  const onSuccess = jest.fn();
  enqueueOperation({
    label: 'Crear',
    run: async (state) => {
      if (!state.saved) state.saved = await post();
      if (!state.expenseDone) { await expense(); state.expenseDone = true; }
      return state.saved;
    },
    onSuccess,
    uncertainOnNetworkError: (state) => !state.saved,
  });
  await flush();
  const failed = getBackgroundOps()[0];
  expect(failed.status).toBe('error');
  expect(failed.error).toBe('caído');
  expect(failed.uncertain).toBe(false);
  expenseFails = false;
  retryOperation(failed.id);
  await flush(); await flush();
  expect(post).toHaveBeenCalledTimes(1);
  expect(expense).toHaveBeenCalledTimes(2);
  expect(onSuccess).toHaveBeenCalledWith({ id: 9 }, expect.objectContaining({ expenseDone: true }));
});

test('sin respuesta del servidor en un alta sin confirmar avisa que podría haberse guardado', async () => {
  enqueueOperation({
    label: 'Crear',
    run: async () => { throw new TypeError('Failed to fetch'); },
    uncertainOnNetworkError: (state) => !state.saved,
  });
  await flush();
  expect(getBackgroundOps()[0]).toEqual(expect.objectContaining({ status: 'error', uncertain: true }));
});

test('las tareas largas muestran progreso y se pueden detener', () => {
  const onCancel = jest.fn();
  startTask('ebay', { label: 'eBay', onCancel });
  expect(getBackgroundOps()[0]).toEqual(expect.objectContaining({ kind: 'task', status: 'running', cancellable: true }));
  cancelTask('ebay');
  expect(onCancel).toHaveBeenCalledTimes(1);
  expect(getBackgroundOps()).toHaveLength(0);
  startTask('eshopex', { label: 'Eshopex' });
  finishTask('eshopex', { error: 'HTTP 500 - falló' });
  expect(getBackgroundOps()[0]).toEqual(expect.objectContaining({ status: 'error', error: 'falló', cancellable: false }));
});
