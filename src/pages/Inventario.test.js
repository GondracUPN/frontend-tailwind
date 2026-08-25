import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import api from '../api';
import Inventario, { groupInventoryEntries } from './Inventario';

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    patch: jest.fn(),
    post: jest.fn(),
    del: jest.fn(),
  },
}));

const entry = {
  producto: {
    id: 42,
    tipo: 'iphone',
    estado: 'usado',
    accesorios: ['Caja'],
    detalle: { numero: '15', modelo: 'Pro', almacenamiento: '256 GB' },
    tracking: [{ id: 1, estado: 'recogido', fechaRecogido: '2026-06-20' }],
  },
  ficha: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  api.get.mockResolvedValue([entry]);
});

test('fusiona en Inventario los lotes de accesorios con el mismo codigo y suma el stock', () => {
  const grouped = groupInventoryEntries([
    {
      producto: { id: 421, codigoInventario: 421, tipo: 'accesorios', stockInicial: 5, stockActual: 5, detalle: { modelo: 'Apple Pencil Pro' } },
      ficha: { enAlmacen: true },
    },
    {
      producto: { id: 430, codigoInventario: 421, tipo: 'accesorios', stockInicial: 20, stockActual: 18, detalle: { modelo: 'Apple Pencil Pro' } },
      ficha: { enAlmacen: true, fotoUrl: '/pencil.jpg', fotosTomadas: true },
    },
  ]);

  expect(grouped).toHaveLength(1);
  expect(grouped[0]).toMatchObject({
    producto: {
      id: 430,
      codigoInventario: 421,
      stockInicial: 25,
      stockActual: 23,
      __inventoryGroup: true,
      __lotIds: [421, 430],
    },
    ficha: { fotoUrl: '/pencil.jpg', enAlmacen: true, fotosTomadas: true },
  });
});

test('separa todos los accesorios del inventario y los muestra tengan o no foto', async () => {
  api.get.mockResolvedValue([
    entry,
    { producto: { id: 501, codigoInventario: 501, tipo: 'accesorios', stockInicial: 3, stockActual: 0, detalle: { modelo: 'Cable USB-C' } }, ficha: null },
    { producto: { id: 502, codigoInventario: 502, tipo: 'accesorios', stockInicial: 4, stockActual: 2, detalle: { modelo: 'Cubo 20W' } }, ficha: { fotoUrl: '/cubo.jpg' } },
  ]);
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByText('MS-42')).toBeInTheDocument();
  expect(screen.queryByText('MS-501')).not.toBeInTheDocument();
  expect(screen.getByText('Total inventario').parentElement).toHaveTextContent('1');

  fireEvent.click(screen.getByRole('button', { name: 'Accesorios' }));
  expect(screen.getByText('MS-501')).toBeInTheDocument();
  expect(screen.getByText('MS-502')).toBeInTheDocument();
  expect(screen.getByText('Sin foto de inventario')).toBeInTheDocument();
  expect(screen.getAllByText('Accesorio')).toHaveLength(2);
});

test('lista un producto disponible y abre su ficha de cotejo', async () => {
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByText(/iPhone 15 Pro/)).toBeInTheDocument();
  expect(screen.getByText('MS-42')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Agregar foto' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Vender' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Buscar producto, color, serial o IMEI'), { target: { value: 'ms-code-42' } });
  expect(screen.getByText('MS-42')).toBeInTheDocument();
  expect(screen.getAllByText('Por cotejar')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  expect(within(screen.getByRole('dialog', { name: 'Completar ficha de inventario' })).getByRole('heading', { name: 'iPhone 15 Pro' })).toBeInTheDocument();
  expect(screen.getByLabelText('Color')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Caja' })).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/inventario'));
});

test('muestra Vender en la tarjeta solamente cuando el producto ya esta en almacen', async () => {
  api.get.mockResolvedValue([{ ...entry, ficha: { enAlmacen: true } }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByRole('button', { name: 'Vender' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  expect(within(screen.getByRole('dialog', { name: 'Completar ficha de inventario' })).queryByRole('button', { name: 'Vender' })).not.toBeInTheDocument();
});

test('cambia Completar ficha por Editar ficha cuando almacen, fotos y Marketplace estan listos', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { enAlmacen: true, fotosTomadas: true, marketplaceSubido: true },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByRole('button', { name: 'Editar ficha' })).toBeInTheDocument();
  expect(screen.getByText('Disponible')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Completar ficha' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Editar ficha' }));
  expect(screen.getByRole('dialog', { name: 'Completar ficha de inventario' })).toBeInTheDocument();
});

test('desde Vender permite poner numero, lugar y precio para copiar el mensaje al cliente', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { enAlmacen: true, primerPrecioSoles: 1250 },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Vender' }));
  expect(screen.getByRole('dialog', { name: 'Opciones para vender' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Poner cliente/ }));
  expect(await screen.findByRole('heading', { name: 'Venta' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Volver a elegir' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Realizar venta/ })).toBeInTheDocument();
  fireEvent.change(screen.getByPlaceholderText('Ej: 987654321 o +51...'), { target: { value: '987654321' } });
  expect(screen.getByDisplayValue('MS-42 - iPhone 15 Pro')).toBeInTheDocument();
  expect(screen.getByDisplayValue('1250')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Copiar texto' }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith([
    'wa.me/+51987654321',
    'Producto: MS-42 - iPhone 15 Pro',
    'Precio acordado: S/ 1250',
    'Lugar: Almacen',
    '987654321',
  ].join('\n')));
  expect(api.patch).not.toHaveBeenCalledWith('/productos/42', expect.anything());
});

test('desde Vender abre la calculadora rapida del producto en el panel lateral', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    producto: {
      ...entry.producto,
      valor: { valorProducto: 300, costoEnvio: 110, costoTotal: 1220 },
    },
    ficha: { enAlmacen: true },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Vender' }));
  fireEvent.click(screen.getByRole('button', { name: /Calculadora/ }));

  expect(await screen.findByRole('heading', { name: 'Calculadora rapida' })).toBeInTheDocument();
  expect(screen.getByText(/Costo total base:/)).toHaveTextContent('S/ 1220.00');
  expect(screen.getByRole('button', { name: 'Volver a elegir' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Poner cliente/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Realizar venta/ })).toBeInTheDocument();
});

test('desde Vender reutiliza el registro completo de venta y retira el producto del inventario', async () => {
  api.get
    .mockResolvedValueOnce([{ ...entry, ficha: { enAlmacen: true } }])
    .mockResolvedValue([]);
  api.post.mockResolvedValue({ id: 9, productoId: 42, tipoCambio: 3.75, fechaVenta: '2026-07-31', precioVenta: 1500 });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Vender' }));
  fireEvent.click(screen.getByRole('button', { name: /Realizar venta/ }));
  expect(await screen.findByRole('heading', { name: 'Registrar Venta' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Tipo de cambio'), { target: { value: '3.75' } });
  fireEvent.change(screen.getByLabelText('Fecha de venta'), { target: { value: '2026-07-31' } });
  fireEvent.change(screen.getByLabelText('Precio de venta (S/)'), { target: { value: '1500' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/ventas', {
    productoId: 42,
    fechaVenta: '2026-07-31',
    precioVenta: 1500,
    tipoCambio: 3.75,
    incomeBank: 'bcp',
  }));
  await waitFor(() => expect(screen.queryByText('MS-42')).not.toBeInTheDocument());
});

test('resume costo y precios de inventario y permite ocultar solo los costos', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    producto: {
      ...entry.producto,
      valor: { valorProducto: 90, valorSoles: 333, costoEnvio: 37, costoTotal: 370 },
    },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  const costs = await screen.findByLabelText('Costos de inventario');
  await waitFor(() => expect(within(costs).getByText('$ 100.00')).toBeInTheDocument());
  expect(within(costs).getByText('S/ 370.00')).toBeInTheDocument();
  expect(screen.getByText('S/ 450.00')).toBeInTheDocument();
  expect(screen.getByText('S/ 500.00')).toBeInTheDocument();
  expect(costs).toHaveClass('blur-sm');
  expect(screen.getByRole('button', { name: 'Mostrar costos de inventario' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Mostrar costos de inventario' }));
  expect(costs).not.toHaveClass('blur-sm');
  expect(screen.getByText('S/ 450.00')).toBeVisible();
  expect(screen.getByText('S/ 500.00')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Ocultar costos de inventario' })).toBeInTheDocument();
});

test('confirma antes de quitar el cotejo de almacén', async () => {
  api.get.mockResolvedValue([{ ...entry, ficha: { enAlmacen: true } }]);
  api.patch.mockResolvedValue({ enAlmacen: false });
  render(<Inventario setVista={jest.fn()} />);

  const storageCheck = await screen.findByRole('checkbox', { name: 'Almacén' });
  fireEvent.click(storageCheck);
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(api.patch).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'No, mantener' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(storageCheck).toBeChecked();

  fireEvent.click(storageCheck);
  fireEvent.click(screen.getByRole('button', { name: 'Sí, quitar' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/inventario/42', { enAlmacen: false }));
});

test('muestra la foto solamente al pulsar Ver foto', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { fotoUrl: 'https://res.cloudinary.com/demo/image/upload/foto.jpg', fotosTomadas: true },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(screen.queryByRole('img', { name: 'iPhone 15 Pro' })).not.toBeInTheDocument();
  expect(screen.queryByText('Ampliar')).not.toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Ampliar foto de iPhone 15 Pro' }));
  expect(screen.getByRole('img', { name: 'iPhone 15 Pro' })).toHaveClass('max-h-[calc(100dvh-1.5rem)]');
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto' }));
  expect(screen.getByRole('button', { name: 'Reducir foto' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'iPhone 15 Pro' })).toHaveClass('w-full', 'max-w-none');
  expect(screen.getByRole('button', { name: 'Cerrar foto' })).toBeInTheDocument();
});

test('filtra por check de fotos y descarga solo portadas disponibles en ZIP', async () => {
  const originalFetch = global.fetch;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;
  const anchorClick = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok: true,
    blob: async () => new Blob(['zip'], { type: 'application/zip' }),
  });
  URL.createObjectURL = jest.fn(() => 'blob:inventario-portadas');
  URL.revokeObjectURL = jest.fn();
  const coverEntries = Array.from({ length: 12 }, (_, index) => {
    const id = 42 + index;
    return {
      ...entry,
      producto: {
        ...entry.producto,
        id,
      },
      ficha: {
        fotoUrl: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
        enAlmacen: true,
        fotosTomadas: true,
      },
    };
  });
  api.get.mockResolvedValue([
    ...coverEntries,
    {
      ...entry,
      producto: {
        ...entry.producto,
        id: 99,
        tipo: 'ipad',
        detalle: { gama: 'Pro', procesador: 'M2', tamano: '11' },
      },
      ficha: {
        fotoUrl: 'https://res.cloudinary.com/demo/image/upload/solo-portada.jpg',
        fotosTomadas: false,
      },
    },
    {
      ...entry,
      producto: {
        ...entry.producto,
        id: 100,
        tipo: 'macbook',
        detalle: { gama: 'Air', procesador: 'M3', tamano: '13' },
      },
      ficha: {
        fotoUrl: null,
        enAlmacen: true,
        fotosTomadas: true,
      },
    },
  ]);

  try {
    render(<Inventario setVista={jest.fn()} />);
    expect(await screen.findByText('MS-99')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Disponibles' }));

    expect(screen.getByText('MS-42')).toBeInTheDocument();
    expect(screen.getByText('MS-53')).toBeInTheDocument();
    expect(screen.getByText('MS-100')).toBeInTheDocument();
    expect(screen.queryByText('MS-99')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar portadas (13)' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toContain('/inventario/fotos-zip');
    expect(options.method).toBe('POST');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('scope')).toBe('conFotosPortada');
    expect(options.body.get('productoIds')).toBe(JSON.stringify([100, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42]));
    expect(options.body.get('watermark')).toBeNull();
    expect(anchorClick).toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    anchorClick.mockRestore();
  }
});

test('ordena los productos con fotos por código MS en ambos sentidos', async () => {
  api.get.mockResolvedValue([42, 7, 105].map((id) => ({
    ...entry,
    producto: { ...entry.producto, id },
    ficha: { fotoUrl: `https://example.com/${id}.jpg`, enAlmacen: true, fotosTomadas: true },
  })));
  render(<Inventario setVista={jest.fn()} />);

  await screen.findByText('MS-42');
  fireEvent.click(screen.getByRole('button', { name: 'Disponibles' }));
  const orderSelect = screen.getByRole('combobox', { name: 'Ordenar inventario' });

  fireEvent.change(orderSelect, { target: { value: 'codeAsc' } });
  expect(screen.getAllByText(/^MS-/).map((element) => element.textContent)).toEqual(['MS-7', 'MS-42', 'MS-105']);

  fireEvent.change(orderSelect, { target: { value: 'codeDesc' } });
  expect(screen.getAllByText(/^MS-/).map((element) => element.textContent)).toEqual(['MS-105', 'MS-42', 'MS-7']);
});

test('los filtros respetan el flujo de cotejo, fotos y Marketplace', async () => {
  api.get.mockResolvedValue([
    { ...entry, producto: { ...entry.producto, id: 42 }, ficha: null },
    { ...entry, producto: { ...entry.producto, id: 43 }, ficha: { enAlmacen: false, fotosTomadas: true, marketplaceSubido: false } },
    { ...entry, producto: { ...entry.producto, id: 44 }, ficha: { enAlmacen: true, fotosTomadas: false, marketplaceSubido: false } },
    { ...entry, producto: { ...entry.producto, id: 45 }, ficha: { enAlmacen: true, fotosTomadas: true, marketplaceSubido: false } },
    { ...entry, producto: { ...entry.producto, id: 46 }, ficha: { enAlmacen: true, fotosTomadas: true, marketplaceSubido: true } },
  ]);
  render(<Inventario setVista={jest.fn()} />);

  await screen.findByText('MS-42');
  fireEvent.click(screen.getByRole('button', { name: 'Por cotejar' }));
  expect(screen.getByText('MS-42')).toBeInTheDocument();
  expect(screen.getByText('MS-43')).toBeInTheDocument();
  expect(screen.queryByText('MS-44')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'En almacén' }));
  expect(screen.getByText('MS-44')).toBeInTheDocument();
  expect(screen.getByText('MS-45')).toBeInTheDocument();
  expect(screen.getByText('MS-46')).toBeInTheDocument();
  expect(screen.queryByText('MS-43')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sin foto' }));
  expect(screen.getByText('MS-44')).toBeInTheDocument();
  expect(screen.queryByText('MS-43')).not.toBeInTheDocument();
  expect(screen.queryByText('MS-45')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Disponibles' }));
  expect(screen.getByText('MS-45')).toBeInTheDocument();
  expect(screen.getByText('MS-46')).toBeInTheDocument();
  expect(screen.queryByText('MS-43')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sin Marketplace' }));
  expect(screen.getByText('MS-45')).toBeInTheDocument();
  expect(screen.queryByText('MS-43')).not.toBeInTheDocument();
  expect(screen.queryByText('MS-46')).not.toBeInTheDocument();
});

test('mantiene las tarjetas con portada en escritorio y muestra más columnas', async () => {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { fotoUrl: 'https://res.cloudinary.com/demo/image/upload/portada.jpg' },
  }]);

  render(<Inventario setVista={jest.fn()} />);

  const cover = await screen.findByRole('button', { name: 'Ampliar foto de iPhone 15 Pro' });
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(cover.closest('article').parentElement).toHaveClass('grid-cols-4');

  Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight });
});

test('subir la portada marca almacén pero no la sesión de fotos', async () => {
  api.patch.mockResolvedValue({ enAlmacen: false, fotosTomadas: false });
  api.post.mockResolvedValue({
    fotoUrl: 'https://res.cloudinary.com/demo/image/upload/portada.jpg',
    enAlmacen: true,
    fotosTomadas: false,
  });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  const photosFinished = screen.getByRole('checkbox', { name: 'Sesión de fotos terminada' });
  const coverInput = screen.getByText('Arrastra la foto aquí').closest('label').querySelector('input');
  expect(photosFinished).not.toBeChecked();

  fireEvent.change(coverInput, {
    target: { files: [new File(['foto'], 'portada.jpg', { type: 'image/jpeg' })] },
  });

  expect(await screen.findByText('Nueva foto seleccionada; se subirá al guardar.')).toBeInTheDocument();
  expect(photosFinished).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));

  await waitFor(() => expect(api.post).toHaveBeenCalledWith(
    '/inventario/42/foto',
    expect.objectContaining({ dataUrl: expect.stringContaining('data:image/jpeg;base64,') }),
  ));
  expect(screen.getByRole('checkbox', { name: 'Almacén' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Fotos' })).not.toBeChecked();
});

test('mantiene el serial y el IMEI ocultos fuera de la ficha', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { serial: 'SN-PRIVADO-123', imei: '490154203237518' },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByText(/iPhone 15 Pro/)).toBeInTheDocument();
  expect(screen.queryByText('SN-PRIVADO-123')).not.toBeInTheDocument();
  expect(screen.queryByText('490154203237518')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  expect(screen.getByLabelText('Serial')).toHaveValue('SN-PRIVADO-123');
  expect(screen.getByLabelText('IMEI 1')).toHaveValue('490154203237518');
});

test('guarda el precio en soles dentro de la ficha', async () => {
  api.get.mockResolvedValue([entry]);
  api.patch.mockResolvedValue({ primerPrecioSoles: 125.5 });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  const priceInput = screen.getByLabelText('Precio (S/)');
  expect(priceInput).toHaveValue(null);
  fireEvent.change(priceInput, { target: { value: '125.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/inventario/42',
    expect.objectContaining({ primerPrecioSoles: 125.5 }),
  ));
  expect(api.patch).not.toHaveBeenCalledWith('/productos/42', expect.anything());
});

test('copia los datos disponibles con el formato de iPhone y el precio normal', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  api.get.mockResolvedValue([entry]);
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  fireEvent.change(screen.getByLabelText('Precio (S/)'), { target: { value: '1250' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copiar datos' }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith(
    'iPhone 15 Pro\n256 GB\nS/ 1250',
  ));
  expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
});

test('copia RAM, SSD y conectividad sin dejar lineas vacias', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  api.get.mockResolvedValue([{
    ...entry,
    producto: {
      ...entry.producto,
      tipo: 'macbook',
      detalle: {
        gama: 'Pro', procesador: 'M4 Pro', tamano: '14', ram: '24 GB', almacenamiento: '1TB', conexion: 'Wifi + Cel',
      },
    },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copiar datos' }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith(
    'MacBook Pro M4 Pro 14" 24 GB RAM Wifi Celular\n1 TB SSD',
  ));
});

test('copia Wifi o GPS aunque el producto no tenga conexion celular', async () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  api.get.mockResolvedValue([{
    ...entry,
    producto: {
      ...entry.producto,
      tipo: 'ipad',
      detalle: { gama: 'Pro', procesador: 'M4', tamano: '13', almacenamiento: '256', conexion: 'Wifi' },
    },
  }]);
  render(<Inventario setVista={jest.fn()} />);

  expect(await screen.findByText('iPad Pro M4 13')).toBeInTheDocument();
  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  fireEvent.click(screen.getByRole('button', { name: 'Copiar datos' }));

  await waitFor(() => expect(writeText).toHaveBeenCalledWith(
    'iPad Pro M4 13" Wifi\n256 GB',
  ));
});

test('guarda y muestra el último precio en la vista rápida', async () => {
  api.get.mockResolvedValue([{
    ...entry,
    ficha: { primerPrecioSoles: 125.5, ultimoPrecioSoles: 99.9 },
  }]);
  api.patch.mockResolvedValue({ ultimoPrecioSoles: 89.5 });
  render(<Inventario setVista={jest.fn()} />);

  const prices = await screen.findByLabelText('Precios del producto');
  expect(within(prices).getByText('P')).toBeInTheDocument();
  expect(within(prices).getByText('S/ 125.50')).toBeInTheDocument();
  expect(within(prices).getByText('PU')).toBeInTheDocument();
  expect(within(prices).getByText('S/ 99.90')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Completar ficha' }));
  const lastPriceInput = screen.getByLabelText('Último precio (S/)');
  expect(lastPriceInput).toHaveValue(99.9);
  fireEvent.change(lastPriceInput, { target: { value: '89.50' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));

  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/inventario/42',
    expect.objectContaining({ ultimoPrecioSoles: 89.5 }),
  ));
});

test('solicita fecha solo cuando la garantía es limitada', async () => {
  render(<Inventario setVista={jest.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));

  fireEvent.click(screen.getByLabelText('¿Tiene garantía?'));
  fireEvent.change(screen.getByLabelText('Tipo de garantía'), { target: { value: 'applecare' } });
  expect(screen.getByLabelText('Garantía hasta (opcional)')).not.toBeRequired();
  expect(screen.getByText('La fecha de AppleCare es opcional.')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Tipo de garantía'), { target: { value: 'limitada' } });
  expect(screen.getByLabelText('Garantía hasta')).toBeRequired();
  expect(screen.queryByLabelText('Detalle de garantía')).not.toBeInTheDocument();
});

test('para un producto nuevo oculta batería y garantía y limpia esos datos al guardar', async () => {
  const newEntry = {
    ...entry,
    producto: { ...entry.producto, estado: 'Nuevo' },
    ficha: {
      ciclosBateria: 12,
      saludBateria: 98,
      tieneGarantia: true,
      tipoGarantia: 'limitada',
      garantiaHasta: '2027-01-01',
    },
  };
  api.get.mockResolvedValue([newEntry]);
  api.patch.mockResolvedValue({});
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));

  expect(screen.getByLabelText('Color')).toBeInTheDocument();
  expect(screen.getByLabelText('Serial')).toBeInTheDocument();
  expect(screen.getByLabelText('IMEI 1')).toBeInTheDocument();
  expect(screen.getByLabelText('IMEI 2')).toBeInTheDocument();
  expect(screen.queryByLabelText('Ciclos de batería')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Salud de batería (%)')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('¿Tiene garantía?')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Guardar ficha' }));
  await waitFor(() => expect(api.patch).toHaveBeenCalledWith(
    '/inventario/42',
    expect.objectContaining({
      ciclosBateria: null,
      saludBateria: null,
      tieneGarantia: false,
      tipoGarantia: null,
      garantiaHasta: null,
    }),
  ));
});

test('Factura US carga el producto por code y calcula 25 por ciento adicional', async () => {
  const invoiceEntry = {
    ...entry,
    producto: { ...entry.producto, id: 266, valor: { valorProducto: 100, fechaCompra: '2026-06-10' } },
    ficha: { serial: 'SN123', imei: '111111111111111', imei2: '222222222222222' },
  };
  api.get.mockImplementation((path) => {
    if (path === '/inventario') return Promise.resolve([entry]);
    if (path === '/inventario/producto/266') return Promise.resolve(invoiceEntry);
    return Promise.resolve({});
  });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Factura US' }));
  fireEvent.change(await screen.findByPlaceholderText('MS-123'), { target: { value: 'MS-266' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cargar producto' }));

  await waitFor(() => expect(screen.getByLabelText('Valor DEC (USD)')).toHaveValue(125));
  expect(api.get).toHaveBeenCalledWith('/inventario/producto/266');
  expect(screen.getByLabelText('Item name')).toHaveValue('iPhone 15 Pro');
  expect(screen.getByLabelText('SN')).toHaveValue('SN123');
  expect(screen.getByLabelText('Imei 1')).toHaveValue('111111111111111');
  expect(screen.getByLabelText('Imei 2')).toHaveValue('222222222222222');
});

test('detecta todos los identificadores y mantiene la lupa mientras se corrigen', async () => {
  api.get.mockResolvedValue([entry]);
  api.post.mockResolvedValue({
    text: 'Serial Number: C02ABCDE1234\nIMEI 1: 490154203237518\nIMEI 2: 356938035643809',
  });
  render(<Inventario setVista={jest.fn()} />);

  fireEvent.click(await screen.findByRole('button', { name: 'Completar ficha' }));
  const scanFile = new File(['imagen temporal'], 'identificadores.jpg', { type: 'image/jpeg' });
  fireEvent.change(screen.getByLabelText('Imagen temporal para escanear'), { target: { files: [scanFile] } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Detectar SN / IMEI' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Detectar SN / IMEI' }));

  expect(await screen.findByText('490154203237518')).toBeInTheDocument();
  expect(screen.getByText('356938035643809')).toBeInTheDocument();
  expect(screen.getByLabelText('IMEI 1')).toHaveValue('490154203237518');
  expect(screen.getByLabelText('IMEI 2')).toHaveValue('356938035643809');
  fireEvent.click(screen.getByRole('button', { name: 'Ampliar foto' }));
  expect(screen.getByText('Lupa · 150%')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('IMEI 1'), { target: { value: '490154203237519' } });
  expect(screen.getByText('Lupa · 150%')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar imagen temporal' }));
  expect(screen.queryByRole('img', { name: 'Revisión ampliada para SN e IMEI' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Detectar SN / IMEI' })).toBeDisabled();
});
