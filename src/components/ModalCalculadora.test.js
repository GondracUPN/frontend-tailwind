import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../api';
import ModalCalculadora from './ModalCalculadora';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const producto = {
  id: 42,
  tipo: 'macbook',
  estado: 'usado',
  detalle: { gama: 'Pro', procesador: 'M3 Pro', tamano: '14', ram: '18 GB', almacenamiento: '512 GB' },
  valor: { valorProducto: 100, costoEnvio: 50, costoTotal: 420 },
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('editar y borrar el precio recalcula sin cargar, perder foco ni consultar de nuevo; respeta el TC manual', async () => {
  jest.useFakeTimers();
  try {
    const accessory = { id: 11, tipo: 'accesorios', soloInventario: true,
      stockInicial: 2, stockActual: 2, vendedor: 'Gonzalo',
      valor: { monedaCompra: 'USD', valorProducto: 20, costoEnvio: 4 } };
    api.post.mockResolvedValue({ cotizacionToken: 'a'.repeat(64), costoTotal: 39,
      lotes: [{ productoId: 11, cantidad: 1, costoUnitario: 39 }] });
    render(<ModalCalculadora producto={accessory} onClose={jest.fn()} />);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenLastCalledWith('/ventas/accesorios/cotizar', {
      productoId: 11, cantidad: 1, comprador: 'Gonzalo', loteInicialId: 11,
    });
    const price = screen.getByLabelText('Precio unitario de venta (S/)');
    const rate = screen.getByLabelText('Tipo de cambio (US$ a S/)');
    fireEvent.change(rate, { target: { value: '4' } });
    const minimumCard = screen.getByText('Precio mínimo (+30%)').parentElement;
    const suggestedCard = screen.getByText('Precio sugerido (+50%)').parentElement;
    const minimumText = minimumCard.textContent;
    const suggestedText = suggestedCard.textContent;
    price.focus();
    for (const value of ['1', '12', '125', '', '5', '50']) {
      fireEvent.change(price, { target: { value } });
      expect(price).toHaveValue(value === '' ? null : Number(value));
      expect(price).toHaveFocus();
      expect(rate).toHaveValue(4);
      expect(screen.queryByText('Cotizando…')).not.toBeInTheDocument();
      expect(minimumCard.textContent).toBe(minimumText);
      expect(suggestedCard.textContent).toBe(suggestedText);
      expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 42.00');
      expect(screen.getByText('Venta total:').parentElement).toHaveTextContent(`S/ ${Number(value).toFixed(2)}`);
      expect(screen.getAllByText('Venta total:')).toHaveLength(1);
      expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent(`S/ ${(Number(value) - 42).toFixed(2)}`);
      await act(async () => { jest.advanceTimersByTime(500); });
      expect(api.post).toHaveBeenCalledTimes(1);
    }
    expect(screen.getByText('Margen sobre costo:').parentElement).toHaveTextContent('19.05 %');
    fireEvent.click(screen.getByText('Ver detalle del cálculo'));
    expect(screen.getByText('Margen sobre venta: 16.00%')).toBeVisible();
    fireEvent.change(rate, { target: { value: '' } });
    expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 39.00');
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Cotizando…')).not.toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

test('una cotización fallida termina la carga y editar precio o TC no dispara reintentos', async () => {
  jest.useFakeTimers();
  try {
    api.post.mockRejectedValue(new Error('No se pudo consultar el stock'));
    render(<ModalCalculadora producto={{ id: 11, tipo: 'accesorios', stockInicial: 2, stockActual: 2,
      valor: { monedaCompra: 'USD', valorProducto: 20, costoEnvio: 4 } }} onClose={jest.fn()} />);
    await act(async () => { jest.advanceTimersByTime(300); });
    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar el stock');
    const rate = screen.getByLabelText('Tipo de cambio (US$ a S/)');
    fireEvent.change(rate, { target: { value: '4' } });
    for (const value of ['1', '12', '', '50']) {
      fireEvent.change(screen.getByLabelText('Precio unitario de venta (S/)'), { target: { value } });
      expect(screen.queryByText('Cotizando…')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo consultar el stock');
      expect(rate).toHaveValue(4);
      await act(async () => { jest.advanceTimersByTime(1000); });
    }
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.get).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});

test('soloInventario muestra historial exacto y familia, cantidades netas y precio unitario', async () => {
  api.post.mockResolvedValue({ cotizacionToken: 'a'.repeat(64), costoTotal: 10 });
  const product = { id: 900, tipo: 'accesorios', estado: 'nuevo', soloInventario: true, detalle: { modelo: 'Cable 60W' }, stockActual: 5 };
  api.get.mockResolvedValue({ coincidenciaExacta: [{ id: 1, cantidad: 3, precioVenta: 100, total: 60, precioUnitario: 20,
    fechaVenta: '2026-10-20', producto: product }], mismaFamilia: [{ id: 2, cantidad: 1, total: 30, precioUnitario: 30,
    fechaVenta: '2026-10-19', producto: { ...product, detalle: { modelo: 'Cable 240W' } } }] });
  render(<ModalCalculadora producto={product} onClose={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Últimos vendidos →' }));
  const history = await screen.findByLabelText('Últimos equipos vendidos similares');
  expect(await within(history).findByText('Coincidencia exacta')).toBeVisible();
  expect(within(history).getByText('Misma familia')).toBeVisible();
  const sale = within(history).getByText('Cable 60W').closest('article');
  expect(within(sale).getByText('Cantidad:')).toHaveTextContent('3');
  expect(within(sale).getByText('Precio por unidad:')).toHaveTextContent('S/ 20.00');
  expect(within(sale).getByText('Total:')).toHaveTextContent('S/ 60.00');
  expect(within(sale).getByText('Estado:')).toHaveTextContent('nuevo');
});

test('recalcula precio mínimo y medio con el tipo de cambio ingresado', () => {
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  expect(screen.queryByRole('region', { name: 'Resumen de accesorios' })).not.toBeInTheDocument();
  expect(screen.getByText('Valor (US$):')).toBeVisible();
  expect(screen.getByText('Precio aplicado (x10 arriba):')).toBeVisible();

  expect(screen.getByText('MacBook Pro · M3 Pro · 14" · 18 · 512')).toBeInTheDocument();
  const minimumCard = screen.getByText('Precio minimo (+20%)').parentElement;
  const mediumCard = screen.getByText('Precio medio (+30%)').parentElement;
  expect(within(minimumCard).getByText('S/ 510.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 550.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 126.00')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de cambio (US$ a S/)'), { target: { value: '4' } });

  expect(within(minimumCard).getByText('S/ 540.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 600.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 135.00')).toBeInTheDocument();
});

test.each([
  ['PEN', 0, 53], ['PEN', 6, 56], ['USD', 0, 196.1], ['USD', 6, 199.1],
])('accesorio simple %s con envío %s muestra solo los datos de compra aplicables', async (monedaCompra, costoEnvio, unitCost) => {
  api.post.mockImplementation(async (_, body) => ({ cotizacionToken: 'a'.repeat(64), costoTotal: unitCost * body.cantidad }));
  render(<ModalCalculadora producto={{ id: 465, tipo: 'accesorios', soloInventario: true,
    stockInicial: 2, stockActual: 2, detalle: { modelo: 'Case Macbook Air M1' },
    valor: { monedaCompra, valorProducto: 106, costoEnvio } }} onClose={jest.fn()} />);

  const costLabel = 'Costo unitario:';
  await waitFor(() => expect(screen.getByText(costLabel).parentElement).toHaveTextContent(`S/ ${unitCost.toFixed(2)}`));
  const summary = screen.getByRole('region', { name: 'Resumen de accesorios' });
  expect(within(summary).getByText(costLabel)).toBeVisible();
  expect(within(summary).getByText('Venta total:')).toBeVisible();
  expect(within(summary).getByText('Ganancia estimada:')).toBeVisible();
  expect(within(summary).getByText('Margen sobre costo:')).toBeVisible();
  expect(within(summary).getAllByText('Venta total:')).toHaveLength(1);
  expect(within(summary).queryByText('Precio de venta por unidad:')).not.toBeInTheDocument();
  expect(screen.queryByText('Precio unitario aplicado:')).not.toBeInTheDocument();
  expect(screen.getByText(/^Margen sobre venta:/)).not.toBeVisible();
  expect(screen.getByText('Precio mínimo (+30%)').parentElement).toHaveTextContent(`S/ ${(Math.ceil(unitCost * 1.3 * 2 - 1e-9) / 2).toFixed(2)}`);
  expect(screen.getByText('Precio sugerido (+50%)').parentElement).toHaveTextContent(`S/ ${(Math.ceil(unitCost * 1.5 * 2 - 1e-9) / 2).toFixed(2)}`);
  if (monedaCompra === 'PEN') {
    expect(screen.queryByLabelText('Tipo de cambio (US$ a S/)')).not.toBeInTheDocument();
    expect(screen.queryByText('Valor base del lote (US$):')).not.toBeInTheDocument();
    expect(screen.queryByText(/\$ 53/)).not.toBeInTheDocument();
  } else {
    expect(screen.getByLabelText('Tipo de cambio (US$ a S/)')).not.toHaveAttribute('readonly');
    expect(screen.getByText('Valor base del lote (US$):').parentElement).toHaveTextContent('$ 53.00');
    expect(screen.getByText('Valor base del lote (US$):')).not.toBeVisible();
  }
  if (costoEnvio > 0) expect(screen.getByText('Envío del lote (S/):').parentElement).toHaveTextContent('S/ 3.00');
  else expect(screen.queryByText('Envío del lote (S/):')).not.toBeInTheDocument();
  expect(screen.queryByText('Costo total:')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Ver detalle del cálculo'));
  expect(screen.getByText(/^Margen sobre venta:/)).toBeVisible();
  if (monedaCompra === 'USD') expect(screen.getByText('Valor base del lote (US$):')).toBeVisible();
  if (costoEnvio > 0) expect(screen.getByText('Envío del lote (S/):')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Unidades a vender'), { target: { value: '2' } });
  await waitFor(() => expect(screen.getByText('Costo total:').parentElement).toHaveTextContent(`S/ ${(unitCost * 2).toFixed(2)}`));
  expect(screen.getByText('Venta total:')).toBeVisible();
  expect(screen.getByText('Por las 2 unidades')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Unidades a vender'), { target: { value: '1' } });
  expect(screen.getAllByText('Venta total:')).toHaveLength(1);
  expect(screen.queryByText('Costo total:')).not.toBeInTheDocument();
});

test('redondea el precio medio hacia arriba para terminar en 00 o 50', () => {
  render(<ModalCalculadora producto={{
    ...producto,
    valor: { valorProducto: 0, costoEnvio: 0, costoTotal: 3617.45 },
  }} onClose={jest.fn()} />);

  const mediumCard = screen.getByText('Precio medio (+30%)').parentElement;
  expect(within(mediumCard).getByText('S/ 4750.00')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 1085.24')).toBeInTheDocument();
  expect(within(mediumCard).getByText('S/ 1132.55')).toBeInTheDocument();
});

test('simula cualquier cambio en accesorios simples, convierte solo lotes USD y redondea precios a 0.50', async () => {
  const lots = [
    { id: 11, tipo: 'accesorios', soloInventario: true, stockInicial: 2, stockActual: 1,
      valor: { monedaCompra: 'USD', valorProducto: 20, costoEnvio: 4, fechaCompra: '2026-01-01' } },
    { id: 12, tipo: 'accesorios', soloInventario: true, stockInicial: 2, stockActual: 2,
      valor: { monedaCompra: 'PEN', valorProducto: 40, costoEnvio: 0, fechaCompra: '2026-02-01' } },
  ];
  const originalLots = JSON.stringify(lots);
  api.post.mockImplementation(async (_, body) => ({ cotizacionToken: 'a'.repeat(64),
    costoTotal: body.cantidad === 1 ? 39 : 59,
    lotes: [{ productoId: 11, cantidad: 1, costoUnitario: 39 },
      ...(body.cantidad === 1 ? [] : [{ productoId: 12, cantidad: 1, costoUnitario: 20 }])],
  }));
  render(<ModalCalculadora producto={{ ...lots[0], __lots: lots }} onClose={jest.fn()} />);
  await waitFor(() => expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 39.00'));
  fireEvent.change(screen.getByLabelText('Unidades a vender'), { target: { value: '2' } });
  await waitFor(() => expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 29.50'));
  const rate = screen.getByLabelText('Tipo de cambio (US$ a S/)');
  expect(rate).not.toHaveAttribute('readonly');
  fireEvent.change(rate, { target: { value: '4' } });
  expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 31.00');
  expect(screen.getByText('Precio mínimo (+30%)').parentElement).toHaveTextContent('S/ 40.50');
  expect(screen.getByText('Precio sugerido (+50%)').parentElement).toHaveTextContent('S/ 46.50');
  fireEvent.change(screen.getByLabelText('Precio unitario de venta (S/)'), { target: { value: '50' } });
  await waitFor(() => expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent('S/ 38.00'));
  fireEvent.click(screen.getByText('Ver detalle del cálculo'));
  expect(screen.getByText('Margen sobre venta: 38.00%')).toBeVisible();
  fireEvent.change(rate, { target: { value: '' } });
  expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 29.50');
  expect(JSON.stringify(lots)).toBe(originalLots);
  expect(api.post.mock.calls.every(([path]) => path === '/ventas/accesorios/cotizar')).toBe(true);
});

test('calcula accesorios por cantidad, precio unitario y lote seleccionado', async () => {
  api.post.mockImplementation(async (_, body) => ({ cotizacionToken: 'a'.repeat(64), costoTotal: (body.loteInicialId === 12 ? 30 : 50) * body.cantidad }));
  render(<ModalCalculadora producto={{
    id: 40,
    tipo: 'accesorios',
    detalle: { descripcionOtro: 'AirTag' },
    stockInicial: 10,
    stockActual: 6,
    valor: { costoTotal: 500, valorProducto: 100, costoEnvio: 20 },
    __lots: [
      { id: 12, tipo: 'accesorios', stockInicial: 24, stockActual: 4, valor: { costoTotal: 720, fechaCompra: '2026-01-10' }, tracking: [{ fechaRecogido: '2026-02-01' }] },
      { id: 40, tipo: 'accesorios', stockInicial: 10, stockActual: 6, valor: { costoTotal: 500, fechaCompra: '2026-07-10' }, tracking: [{ fechaRecogido: '2026-07-20' }] },
    ],
  }} onClose={jest.fn()} />);

  expect(screen.getByLabelText('Lote de compra')).toHaveValue('12');
  await waitFor(() => expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 30.00'));
  expect(screen.getByText('Precio mínimo').parentElement).toHaveTextContent('S/ 36.00');
  expect(screen.getByText('Precio sugerido').parentElement).toHaveTextContent('S/ 39.00');
  fireEvent.change(screen.getByLabelText('Unidades a vender'), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText('Precio unitario de venta (S/)'), { target: { value: '50' } });
  expect(screen.getByText('Venta total:').parentElement).toHaveTextContent('S/ 150.00');
  await waitFor(() => expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent('S/ 60.00'));

  fireEvent.change(screen.getByLabelText('Lote de compra'), { target: { value: '40' } });
  await waitFor(() => expect(screen.getByText('Costo unitario:').parentElement).toHaveTextContent('S/ 50.00'));
  expect(screen.getByText('Venta total:').parentElement).toHaveTextContent('S/ 150.00');
  expect(screen.getByText('Ganancia estimada:').parentElement).toHaveTextContent('S/ 0.00');
});

test('resume un iPhone sin agregar procesador, pantalla ni RAM', () => {
  render(<ModalCalculadora producto={{
    ...producto,
    tipo: 'iphone',
    detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
  }} onClose={jest.fn()} />);

  expect(screen.getByText('iPhone 15 Pro · 256')).toBeInTheDocument();
  expect(screen.queryByText(/M3 Pro/)).not.toBeInTheDocument();
});

test('abre al lado los últimos equipos vendidos similares', async () => {
  api.get.mockResolvedValue([{
    id: 10,
    fechaVenta: '2026-07-01',
    diasHastaVenta: 11,
    precioVenta: 5990,
    producto: {
      id: 201,
      tipo: 'macbook',
      estado: 'usado',
      detalle: { gama: 'Pro', procesador: 'M3 Pro', tamano: '14', ram: '18 GB', almacenamiento: '1 TB' },
    },
  }]);
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Últimos vendidos →' }));

  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/ventas/similares?productoId=42&limit=8'));
  const history = await screen.findByLabelText('Últimos equipos vendidos similares');
  expect(within(history).getByText('MacBook Pro')).toBeInTheDocument();
  expect(within(history).getByText('Procesador:')).toHaveTextContent('M3 Pro');
  expect(within(history).getByText('Pantalla:')).toHaveTextContent('14"');
  expect(within(history).getByText('RAM:')).toHaveTextContent('18 GB');
  expect(within(history).getByText('SSD:')).toHaveTextContent('1 TB');
  expect(within(history).getByText('Estado:')).toHaveTextContent('usado');
  expect(within(history).getByText('Fecha venta:')).toHaveTextContent('01/07/2026');
  expect(within(history).getByText('Días hasta venta:')).toHaveTextContent('11 días');
  expect(within(history).getAllByText('S/ 5990.00').length).toBeGreaterThan(0);
});

test('muestra solo los datos correspondientes a iPhone y Apple Watch', async () => {
  api.get.mockResolvedValue([
    {
      id: 20,
      fechaVenta: '2026-07-01',
      diasHastaVenta: 7,
      precioVenta: 3200,
      producto: {
        tipo: 'iphone',
        estado: 'usado',
        detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
      },
    },
    {
      id: 21,
      fechaVenta: '2026-06-28',
      diasHastaVenta: 4,
      precioVenta: 2500,
      producto: {
        tipo: 'watch',
        estado: 'nuevo',
        detalle: { gama: 'Ultra', generacion: '2', tamano: '49 mm', conexion: 'GPS + Cel' },
      },
    },
    {
      id: 22,
      fechaVenta: '2026-06-25',
      diasHastaVenta: 6,
      precioVenta: 2800,
      producto: {
        tipo: 'ipad',
        estado: 'usado',
        detalle: { gama: 'Pro', procesador: 'M2', tamano: '11', ram: '8 GB', almacenamiento: '256 GB' },
      },
    },
  ]);
  render(<ModalCalculadora producto={producto} onClose={jest.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: 'Últimos vendidos →' }));
  const history = await screen.findByLabelText('Últimos equipos vendidos similares');
  const iphone = (await within(history).findByText('iPhone 15 Pro')).closest('article');
  expect(within(iphone).getByText('Almacenamiento:')).toHaveTextContent('256 GB');
  expect(within(iphone).getByText('Estado:')).toHaveTextContent('usado');
  expect(within(iphone).queryByText('SSD:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('RAM:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('Procesador:')).not.toBeInTheDocument();
  expect(within(iphone).queryByText('Pantalla:')).not.toBeInTheDocument();

  const watch = within(history).getByText('Apple Watch Ultra 2 49 mm GPS + Cel').closest('article');
  expect(within(watch).getByText('Serie:')).toHaveTextContent('2');
  expect(within(watch).getByText('Tamaño:')).toHaveTextContent('49 mm');
  expect(within(watch).getByText('Conexión:')).toHaveTextContent('GPS + Cel');
  expect(within(watch).getByText('Estado:')).toHaveTextContent('nuevo');
  expect(within(watch).queryByText('SSD:')).not.toBeInTheDocument();

  const ipad = within(history).getByText('iPad Pro').closest('article');
  expect(within(ipad).getByText('Procesador:')).toHaveTextContent('M2');
  expect(within(ipad).getByText('Pantalla:')).toHaveTextContent('11"');
  expect(within(ipad).getByText('RAM:')).toHaveTextContent('8 GB');
  expect(within(ipad).getByText('Almacenamiento:')).toHaveTextContent('256 GB');
  expect(within(ipad).queryByText('SSD:')).not.toBeInTheDocument();
});
