import { render, screen } from '@testing-library/react';
import { IdentificacionFields, fieldVisible, inventoryColor } from './Inventario';

// Reglas tal como las entrega el backend en entry.reglas (catálogo Apple).
const rule = (visible, requiredForComplete = false, source) => ({ visible, requiredForComplete, ...(source ? { source } : {}) });
const base = { resolution: 'exact', candidates: [], legacyInvalid: [], imeiStatus: 'confirmed' };
const macRules = { ...base, tipo: 'macbook', serial: rule(true, true), imei: rule(false), imei2: rule(false), saludBateria: rule(true, false, 'native'), ciclosBateria: rule(true, false, 'native'), color: { ...rule(true), options: [{ value: 'Silver', label: 'Silver', aliases: ['Plata'] }, { value: 'Space Gray', label: 'Space Gray', aliases: ['Gris espacial'] }], status: 'confirmed' } };
const iphoneRules = { ...macRules, tipo: 'iphone', imei: rule(true, true), imei2: rule(true, true), ciclosBateria: rule(true, false, 'manual') };
const imacRules = { ...macRules, tipo: 'imac', saludBateria: rule(false), ciclosBateria: rule(false) };
const emptyForm = { color: '', serial: '', imei: '', imei2: '', saludBateria: '', ciclosBateria: '' };
const renderFields = (reglas, ficha = {}, form = emptyForm, productoNuevo = false) =>
  render(<IdentificacionFields reglas={reglas} ficha={ficha} form={form} setForm={jest.fn()} productoNuevo={productoNuevo} />);

test('Mac: serial sin IMEI; color como selector del modelo', () => {
  renderFields(macRules);
  expect(screen.getByText(/Serial/)).toBeInTheDocument();
  expect(screen.queryByText(/IMEI/)).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Space Gray' })).toBeInTheDocument();
});

test('iPhone: IMEI 1 e IMEI 2 marcados como requeridos para ficha completa; ciclos con procedencia manual', () => {
  renderFields(iphoneRules);
  expect(screen.getByText('IMEI 1 *')).toBeInTheDocument();
  expect(screen.getByText('IMEI 2 *')).toBeInTheDocument();
  expect(screen.getByText(/Ciclos de batería · diagnóstico manual/)).toBeInTheDocument();
});

test('sobremesa sin salud/ciclos y el IMEI legado se muestra para revisión sin borrarse', () => {
  renderFields(imacRules, { imei: '490154203237518', saludBateria: 88 });
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.getByText(/Salud de batería: 88/)).toBeInTheDocument();
  expect(screen.getByText(/IMEI 1: 490154203237518/)).toBeInTheDocument();
});

test('sin reglas del backend se mantiene el comportamiento previo', () => {
  expect(fieldVisible(null, 'imei')).toBe(true);
  expect(fieldVisible(macRules, 'imei')).toBe(false);
});


test('muestra colores anteriores en inglés sin perder la selección guardada', () => {
  renderFields(macRules, { color: 'Plata' }, { ...emptyForm, color: 'Plata' });
  expect(screen.getByRole('combobox')).toHaveValue('Silver');
  expect(screen.queryByRole('option', { name: /valor guardado/ })).not.toBeInTheDocument();
  expect(inventoryColor('gris espacial', macRules)).toBe('Space Gray');
  expect(inventoryColor('Acabado personalizado', macRules)).toBe('Acabado personalizado');
});
