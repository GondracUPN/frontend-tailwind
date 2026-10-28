import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../../api';
import CatalogModelFields from './CatalogModelFields';
import { findCatalogModel } from '../../services/appleCatalog';
import catalogForms from '../../__fixtures__/appleCatalogForms.json';

// Contrato real de /apple-catalog/forms (AppleDB + fichas EveryMac + dataset propio), subconjunto congelado.
jest.mock('../../api', () => ({ __esModule: true, default: { get: jest.fn() } }));

beforeEach(() => {
  api.get.mockReset();
  api.get.mockResolvedValue(catalogForms);
});

function Harness({ tipo, initial = {} }) {
  const [detalle, setDetalle] = useState(initial);
  return (
    <>
      <CatalogModelFields tipo={tipo} detalle={detalle} onChange={(field, value) => setDetalle((current) => ({ ...current, [field]: value }))} />
      <output data-testid="detalle">{JSON.stringify(detalle)}</output>
    </>
  );
}
const detalle = () => JSON.parse(screen.getByTestId('detalle').textContent);
const byId = (id) => document.getElementById(id);

// Cascada: primer nivel (Air/Pro/Neo · iPad/mini/Air/Pro · número de iPhone · serie del Watch) y luego el modelo.
const chooseModel = async (title) => {
  const model = catalogForms.models.find((m) => m.title === title);
  if (!model) throw new Error(`Fixture sin ${title}`);
  const [firstField, secondField] = Object.keys(model.detalle);
  const prefix = `catalogo-${model.tipo}`;
  await waitFor(() => expect(byId(`${prefix}-${firstField}`)).not.toBeNull());
  fireEvent.change(byId(`${prefix}-${firstField}`), { target: { value: model.detalle[firstField] } });
  if (!secondField) return;
  await waitFor(() => expect(byId(`${prefix}-${secondField}`)).not.toBeNull());
  if (byId(`${prefix}-${secondField}`).value !== model.id) fireEvent.change(byId(`${prefix}-${secondField}`), { target: { value: model.id } });
  await waitFor(() => expect(byId(`${prefix}-${secondField}`).value).toBe(model.id));
};

test('MacBook: primero Air/Pro/Neo, debajo el procesador y luego pantalla, RAM y almacenamiento', async () => {
  render(<Harness tipo="macbook" />);
  const first = await screen.findByLabelText('Modelo');
  expect([...first.options].map((o) => o.textContent)).toEqual(['Selecciona', 'MacBook Air', 'MacBook Pro', 'MacBook Neo']);
  fireEvent.change(first, { target: { value: 'Pro' } });
  const chip = await screen.findByLabelText('Procesador');
  expect([...chip.options].map((o) => o.textContent)).toEqual(['Selecciona', 'M1', 'M4 Pro', 'M5']);
  fireEvent.change(chip, { target: { value: 'macbook-pro-m4-pro' } });
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Pro', procesador: 'M4 Pro' }));
  const labels = screen.getAllByText(/Pantalla|Memoria unificada|Almacenamiento/).map((n) => n.textContent);
  expect(labels).toEqual(['Pantalla', 'Memoria unificada (RAM)', 'Almacenamiento']);
  expect(screen.getByRole('option', { name: '16″' })).toBeInTheDocument();
});

test('MacBook Neo tiene un solo procesador: se completa solo', async () => {
  render(<Harness tipo="macbook" />);
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'Neo' } });
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Neo', procesador: 'A18 Pro', tamano: '13', ram: '8' }));
});

test('MacBook Air M5 solo ofrece combinaciones vendidas (sin 256 GB)', async () => {
  render(<Harness tipo="macbook" />);
  await chooseModel('MacBook Air (M5)');
  expect(screen.getByLabelText('Pantalla')).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: '256 GB' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: '4 TB' })).toBeInTheDocument();
});

test('iPad: mini 6 y Air M1 guardan su pantalla única; la generación 11 (A16) no se usa como diagonal', async () => {
  render(<Harness tipo="ipad" />);
  await chooseModel('iPad mini (6.ª generación)');
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Mini', generacion: '6', tamano: '8.3' }));
  expect(screen.getByLabelText('Pantalla')).toBeDisabled();
  await chooseModel('iPad Air (M1)');
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Air', procesador: 'M1', tamano: '10.9' }));
  await chooseModel('iPad (A16)');
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Normal', generacion: '11', tamano: '11' }));
  expect(screen.getByRole('option', { name: 'Wi-Fi + Cellular' })).toBeInTheDocument();
  expect(screen.queryByLabelText(/RAM/)).not.toBeInTheDocument();
});

test('solo se ofrecen modelos del alcance comercial, pero un producto guardado fuera de él se conserva', async () => {
  const { unmount } = render(<Harness tipo="ipad" />);
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'Mini' } });
  const gen = await screen.findByLabelText('Generación');
  expect([...gen.options].map((o) => o.textContent)).not.toContain('iPad mini (5.ª generación)');
  unmount();
  render(<Harness tipo="ipad" initial={{ gama: 'Mini', generacion: '5', tamano: '7.9', almacenamiento: '64', conexion: 'Wifi' }} />);
  await waitFor(() => expect(byId('catalogo-ipad-generacion').value).toBe('ipad-mini-5'));
});

test('iPhone: número → modelo → solo almacenamiento (sin RAM ni pantalla)', async () => {
  render(<Harness tipo="iphone" />);
  await chooseModel('iPhone 15 Pro');
  expect(detalle()).toMatchObject({ numero: '15', modelo: 'Pro' });
  expect(screen.getByLabelText('Número')).toBeInTheDocument();
  expect(screen.getByLabelText('Almacenamiento')).toBeInTheDocument();
  expect(screen.queryByLabelText(/RAM|Pantalla/)).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: '1 TB' })).toBeInTheDocument();
});

test('Watch: serie → caja en mm y GPS/GPS + Cellular; Ultra 3 se autocompleta', async () => {
  render(<Harness tipo="watch" />);
  await chooseModel('Apple Watch Series 10');
  expect(screen.getByLabelText('Tamaño de caja')).toBeInTheDocument();
  expect(screen.getByRole('option', { name: '46 mm (caja)' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'GPS + Cellular' })).toBeInTheDocument();
  await chooseModel('Apple Watch Ultra 3');
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Ultra', generacion: '3', tamano: '49 mm', conexion: 'GPS + Cel' }));
  expect(screen.queryByLabelText(/Almacenamiento|RAM/)).not.toBeInTheDocument();
});

test('Mac mini: procesador → RAM y almacenamiento, sin pantalla', async () => {
  render(<Harness tipo="macmini" />);
  await chooseModel('Mac mini (M4)');
  expect(screen.queryByLabelText('Pantalla')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Memoria unificada (RAM)')).toBeInTheDocument();
});

test('AirPods 4 elige con/sin ANC; AirPods 5 distingue el estuche sin ofrecer "sin ANC"', async () => {
  render(<Harness tipo="airpods" />);
  fireEvent.change(await screen.findByLabelText('Modelo de AirPods'), { target: { value: 'AirPods 4' } });
  fireEvent.change(screen.getByLabelText('Cancelación activa de ruido'), { target: { value: 'con' } });
  await waitFor(() => expect(detalle()).toEqual({ modelo: 'AirPods 4 con ANC' }));
  fireEvent.change(screen.getByLabelText('Cancelación activa de ruido'), { target: { value: 'sin' } });
  await waitFor(() => expect(detalle()).toEqual({ modelo: 'AirPods 4 sin ANC' }));

  fireEvent.change(screen.getByLabelText('Modelo de AirPods'), { target: { value: 'AirPods 5' } });
  expect(screen.queryByLabelText('Cancelación activa de ruido')).not.toBeInTheDocument();
  expect(screen.queryByRole('option', { name: /sin ANC/i })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Edición'), { target: { value: 'airpods-airpods-5-con-estuche-inalambrico' } });
  await waitFor(() => expect(detalle()).toEqual({ modelo: 'AirPods 5 con estuche inalámbrico' }));
  expect(screen.queryByRole('option', { name: 'AirPods Pro 1' })).not.toBeInTheDocument(); // fuera del alcance
  expect(screen.queryByLabelText(/Almacenamiento|RAM|Pantalla/)).not.toBeInTheDocument();
});

test('reabrir un producto conserva la versión exacta y muestra valores legados sin borrarlos', async () => {
  render(<Harness tipo="ipad" initial={{ gama: 'Mini', generacion: '6', tamano: '11', almacenamiento: '64', conexion: 'Wifi' }} />);
  expect(await screen.findByRole('option', { name: '11' })).toBeInTheDocument();
  expect(detalle().tamano).toBe('11');
  expect(screen.queryByText(/se conserva hasta que|sin coincidencia exacta|Dato en revisión/i)).not.toBeInTheDocument();
});

test('Productos e Inventario resuelven el mismo modelo, incluidos títulos legados', () => {
  expect(findCatalogModel(catalogForms.models, 'airpods', { modelo: 'AirPods 4 ANC' }).id).toBe('airpods-airpods-4-con-anc');
  expect(findCatalogModel(catalogForms.models, 'watch', { gama: 'Normal', generacion: '10' }).id).toBe('watch-series-10');
  expect(findCatalogModel(catalogForms.models, 'ipad', { gama: 'Normal', generacion: 'A16' }).id).toBe('ipad-a16');
  expect(findCatalogModel(catalogForms.models, 'ipad', { gama: 'Air', procesador: 'Gen 4' }).id).toBe('ipad-air-a14');
});

test('se pide el catálogo una sola vez por formulario (sin consultas por campo)', async () => {
  render(<Harness tipo="iphone" />);
  await chooseModel('iPhone 15 Pro');
  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith('/apple-catalog/forms', { maxAgeMs: 600000 });
});


test('cambiar de Air a Pro conserva 16 GB y 256 GB mientras se elige el procesador y si el modelo los admite', async () => {
  render(<Harness tipo="macbook" initial={{ gama: 'Air', procesador: 'M4', tamano: '13', ram: '16', almacenamiento: '256' }} />);
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'Pro' } });
  expect(detalle()).toMatchObject({ gama: 'Pro', ram: '16', almacenamiento: '256' });
  expect(screen.queryByText(/se quitaron valores no válidos/)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Procesador'), { target: { value: 'macbook-pro-m1' } });
  await waitFor(() => expect(detalle()).toMatchObject({ gama: 'Pro', procesador: 'M1', tamano: '13', ram: '16', almacenamiento: '256' }));
  expect(screen.queryByText(/se quitaron valores no válidos/)).not.toBeInTheDocument();
});

test('al pasar a una pantalla incompatible se recalcula antes de validar RAM y SSD compatibles', async () => {
  render(<Harness tipo="macbook" initial={{ gama: 'Air', procesador: 'M4', tamano: '15', ram: '16', almacenamiento: '512' }} />);
  fireEvent.change(await screen.findByLabelText('Modelo'), { target: { value: 'Pro' } });
  fireEvent.change(screen.getByLabelText('Procesador'), { target: { value: 'macbook-pro-m5' } });
  await waitFor(() => expect(detalle()).toMatchObject({ procesador: 'M5', tamano: '14', ram: '16', almacenamiento: '512' }));
  expect(screen.queryByText(/se quitaron valores no válidos/)).not.toBeInTheDocument();
});

test('una incompatibilidad real borra solo el almacenamiento y conserva la RAM válida', async () => {
  render(<Harness tipo="macbook" initial={{ gama: 'Air', procesador: 'M4', tamano: '13', ram: '16', almacenamiento: '256' }} />);
  fireEvent.change(await screen.findByLabelText('Procesador'), { target: { value: 'macbook-air-m5' } });
  await waitFor(() => expect(detalle()).toMatchObject({ procesador: 'M5', ram: '16', almacenamiento: '' }));
  expect(screen.queryByText(/se quitaron valores no válidos/)).not.toBeInTheDocument();
});


test('una selección parcial o anterior no muestra avisos de catálogo al cambiar de modelo', async () => {
  render(<Harness tipo="ipad" initial={{ gama: 'Mini', generacion: '99' }} />);
  await screen.findByLabelText('Modelo');
  expect(screen.queryByText(/Datos guardados|sin coincidencia|pendiente de revisión|Dato en revisión/i)).not.toBeInTheDocument();
  await chooseModel('iPad mini (6.ª generación)');
  await chooseModel('iPad Air (M1)');
  expect(screen.queryByText(/Datos guardados|sin coincidencia|pendiente de revisión|Dato en revisión|se quitaron valores/i)).not.toBeInTheDocument();
  expect(detalle()).toMatchObject({ gama: 'Air', procesador: 'M1', tamano: '10.9' });
});
