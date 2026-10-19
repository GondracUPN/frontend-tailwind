import api from '../api';

const qs = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '' || value === false) return;
    search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : '';
};

// Clave de idempotencia: se genera al abrir un formulario y se reutiliza en los reintentos.
export const nuevaClave = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  } catch {
    /* sin crypto */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const sesionFinanciera = () => {
  try {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    return { token, user, esAdmin: !!token && user?.role === 'admin' };
  } catch {
    return { token: null, user: null, esAdmin: false };
  }
};

export const esErrorDePermiso = (error) => /HTTP (401|403)/.test(String(error?.message || ''));

export const limpiarError = (error) => String(error?.message || error || 'Error inesperado').replace(/^HTTP \d+ - /, '');

export const finanzasApi = {
  analisis: (params) => api.get(`/finanzas/analisis${qs(params)}`),
  ventas: (params) => api.get(`/finanzas/ventas${qs(params)}`),
  detalleVenta: (id) => api.get(`/finanzas/ventas/${id}`),
  precioPactado: (id, precioLista) => api.patch(`/finanzas/ventas/${id}/precio-pactado`, { precioLista }),
  registrarPago: (body) => api.post('/finanzas/pagos', body),
  registrarEvento: (pagoId, body) => api.post(`/finanzas/pagos/${pagoId}/eventos`, body),
  anularPago: (pagoId, motivo) => api.post(`/finanzas/pagos/${pagoId}/anular`, { motivo }),
  cuentas: () => api.get('/finanzas/cuentas'),
  crearCuenta: (body) => api.post('/finanzas/cuentas', body),
  actualizarCuenta: (id, body) => api.patch(`/finanzas/cuentas/${id}`, body),
  movimientos: (params) => api.get(`/finanzas/movimientos${qs(params)}`),
  registrarMovimiento: (body) => api.post('/finanzas/movimientos', body),
  anularMovimiento: (id, motivo) => api.post(`/finanzas/movimientos/${id}/anular`, { motivo }),
  conciliacion: (params) => api.get(`/finanzas/conciliacion${qs(params)}`),
  conciliar: (ventaId, body) => api.post(`/finanzas/conciliacion/${ventaId}`, body),
  conciliarLote: (ventaIds) => api.post('/finanzas/conciliacion/lote', { ventaIds }),
  importarHistorico: (aplicar) => api.post(`/finanzas/conciliacion/importar${qs({ aplicar })}`, {}),
  gastosSinClasificar: (params) => api.get(`/finanzas/gastos/sin-clasificar${qs(params)}`),
  clasificarGasto: (id, body) => api.patch(`/finanzas/gastos/${id}/clasificacion`, body),
  reembolsos: (params) => api.get(`/finanzas/reembolsos${qs(params)}`),
  crearReembolso: (body) => api.post('/finanzas/reembolsos', body),
  eventoReembolso: (id, body) => api.post(`/finanzas/reembolsos/${id}/eventos`, body),
  cerrarProducto: (id, motivo) => api.patch(`/finanzas/productos/${id}/cierre`, { motivo }),
  accesorios: () => api.get('/finanzas/accesorios'),
  ventaRapida: (body) => api.post('/finanzas/ventas-rapidas', body),
};

export const CLASIFICACIONES_GASTO = [
  ['costo_inventario', 'Compra de inventario'],
  ['costo_directo', 'Costo directo de producto o venta'],
  ['comision_venta', 'Comisión de venta'],
  ['gasto_operativo', 'Gasto operativo'],
  ['gasto_financiero', 'Gasto financiero'],
  ['perdida', 'Pérdida'],
  ['movimiento_deuda', 'Movimiento de deuda'],
  ['transferencia', 'Transferencia entre cuentas'],
  ['ajuste_devolucion', 'Ajuste o devolución'],
  ['personal', 'Personal (fuera del negocio)'],
];

export const METODOS_PAGO = [
  ['transferencia', 'Transferencia'],
  ['yape', 'Yape'],
  ['plin', 'Plin'],
  ['efectivo', 'Efectivo'],
  ['tarjeta', 'Tarjeta (POS / pasarela)'],
  ['deposito', 'Depósito'],
  ['x500', 'Cuotas x500'],
  ['otro', 'Otro'],
];
