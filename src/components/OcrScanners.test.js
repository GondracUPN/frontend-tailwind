import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import api from '../api';
import ModalSnImeiScanner from './ModalSnImeiScanner';
import OcrCandidateReview from './OcrCandidateReview';
import OcrCropSelector from './OcrCropSelector';
import parseSnImeiIds, { planAutofill } from '../utils/snImeiOcr';
import fixtures from '../utils/snImeiOcr.fixtures.json';

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));

const rule = (visible) => ({ visible, requiredForComplete: visible });
const iphoneRules = { tipo: 'iphone', serial: rule(true), imei: rule(true), imei2: rule(true) };
const macRules = { tipo: 'macbook', serial: rule(true), imei: rule(false), imei2: rule(false) };

beforeEach(() => {
  api.get.mockResolvedValue({ items: [], total: 0 });
  api.post.mockReset();
  global.URL.createObjectURL = jest.fn(() => 'blob:ocr-test');
  global.URL.revokeObjectURL = jest.fn();
});

const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const upload = (name) => {
  const input = document.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } });
};
const echo = (fixture) => (path, body) => Promise.resolve({ ...fixture, requestToken: body.requestToken });

test('escáner de Productos: mismo resultado que Inventario, sin consultar SICKW ni iFreeiCloud', async () => {
  api.post.mockImplementation(echo(fixtures.iphone));
  render(<ModalSnImeiScanner onClose={jest.fn()} />);
  upload('caja.jpg');
  await screen.findByLabelText('Revisión de SN / IMEI detectados');

  // Inventario (iPhone) autocompletaría exactamente lo mismo que el modal selecciona.
  const inventario = planAutofill(parseSnImeiIds(fixtures.iphone), { serial: '', imei: '', imei2: '' }, iphoneRules).patch;
  expect(screen.getByRole('button', { name: `SN ${inventario.serial}` })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: `IMEI 1 ${inventario.imei}` })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: `IMEI 2 ${inventario.imei2}` })).toBeInTheDocument();
  expect(screen.getByText(/no se guarda en el producto/)).toBeInTheDocument();

  expect(api.post).toHaveBeenCalledTimes(1);
  expect(api.post.mock.calls[0][0]).toBe('/ocr/vision');
  expect(api.post.mock.calls.some(([path]) => /sickw|ifree/i.test(path))).toBe(false);
});

test('escáner de Productos: una respuesta antigua no rellena la imagen nueva', async () => {
  const first = deferred();
  api.post
    .mockImplementationOnce((path, body) => first.promise.then(() => ({ ...fixtures.airpods, requestToken: body.requestToken })))
    .mockImplementationOnce(echo(fixtures.imei2Only));
  render(<ModalSnImeiScanner onClose={jest.fn()} />);
  upload('vieja.jpg');
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
  expect(api.post.mock.calls[0][2].signal).toBeDefined();
  upload('nueva.jpg');
  await screen.findByRole('button', { name: 'SN GXQTQJCTWH' });
  await screen.findByRole('button', { name: /IMEI 2 353915112345675/ });
  expect(api.post.mock.calls[0][2].signal.aborted).toBe(true);
  await act(async () => { first.resolve(); await first.promise; });
  expect(screen.queryByText('HKLMNPQRST')).not.toBeInTheDocument();
});

test('revisión: Mac no ofrece IMEI y no pisa un serial escrito sin confirmar', () => {
  const onAssign = jest.fn();
  render(<OcrCandidateReview parsed={parseSnImeiIds(fixtures.iphone)} values={{ serial: 'C02XG2JHJGH5', imei: '', imei2: '' }} reglas={macRules} onAssign={onAssign} />);
  expect(screen.queryByRole('button', { name: /Usar como IMEI/ })).not.toBeInTheDocument();
  expect(screen.getByText(/este modelo no admite IMEI/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Usar como serial' }));
  expect(onAssign).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Serial ya tiene C02XG2JHJGH5. ¿Reemplazar por FGHJKLMPQR?');
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar' }));
  expect(onAssign).toHaveBeenCalledWith('serial', 'FGHJKLMPQR');
});

test('revisión: iPhone ofrece IMEI 1 e IMEI 2 y muestra Luhn inválido y conflictos', () => {
  const onAssign = jest.fn();
  const parsed = parseSnImeiIds({
    candidates: [
      { kind: 'imei', value: '352099001761482', rawValue: '352099001761482', slot: 'imei1', labelEvidence: 'same_line', confidence: 0.35, validation: { status: 'invalid', rule: 'luhn', message: 'No supera la comprobación Luhn: revisar antes de usar.' }, warnings: ['luhn_invalid'], autofill: false },
    ],
    conflicts: [{ type: 'slot_conflict', slot: 'imei1', values: ['352099001761481', '353915112345675'] }],
  });
  render(<OcrCandidateReview parsed={parsed} values={{ serial: '', imei: '', imei2: '' }} reglas={iphoneRules} onAssign={onAssign} />);
  expect(screen.getByText(/No supera la comprobación Luhn/)).toBeInTheDocument();
  expect(screen.getByText(/valores distintos para IMEI 1/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Usar como IMEI 2' }));
  expect(onAssign).toHaveBeenCalledWith('imei2', '352099001761482');
});

test('«Volver a leer esa zona» envía fracciones de la imagen original', () => {
  // jsdom no implementa PointerEvent: sin esto las coordenadas del puntero se pierden.
  if (!window.PointerEvent) window.PointerEvent = class extends MouseEvent {};
  const onCrop = jest.fn();
  render(<OcrCropSelector src="data:image/png;base64,AA" alt="foto" onCrop={onCrop} />);
  const img = screen.getByAltText('foto');
  Object.defineProperty(img, 'naturalWidth', { value: 4000 });
  Object.defineProperty(img, 'naturalHeight', { value: 3000 });
  img.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 });
  const area = screen.getByTestId('ocr-crop-area');
  area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  fireEvent.click(screen.getByRole('button', { name: 'Seleccionar zona' }));
  fireEvent.pointerDown(area, { clientX: 100, clientY: 150 });
  fireEvent.pointerMove(area, { clientX: 300, clientY: 180 });
  fireEvent.pointerUp(area, { clientX: 300, clientY: 180 });
  fireEvent.click(screen.getByRole('button', { name: 'Volver a leer esa zona' }));
  expect(onCrop).toHaveBeenCalledWith({ x: 0.25, y: 0.5, width: 0.5, height: 0.1 });
});

test('revisión: una confirmación pendiente de la lectura anterior no sobrevive a una lectura nueva', () => {
  const onAssign = jest.fn();
  const values = { serial: 'C02XG2JHJGH5', imei: '', imei2: '' };
  const { rerender } = render(<OcrCandidateReview parsed={parseSnImeiIds(fixtures.iphone)} values={values} reglas={iphoneRules} onAssign={onAssign} />);
  fireEvent.click(screen.getByRole('button', { name: 'Usar como serial' }));
  expect(screen.getByRole('button', { name: 'Reemplazar' })).toBeInTheDocument();
  rerender(<OcrCandidateReview parsed={parseSnImeiIds(fixtures.airpods)} values={values} reglas={iphoneRules} onAssign={onAssign} />);
  expect(screen.queryByRole('button', { name: 'Reemplazar' })).not.toBeInTheDocument();
  expect(onAssign).not.toHaveBeenCalled();
});

test('revisión: si el campo cambió tras abrir la confirmación, vuelve a preguntar con el valor actual', () => {
  const onAssign = jest.fn();
  const parsed = parseSnImeiIds(fixtures.iphone);
  const { rerender } = render(<OcrCandidateReview parsed={parsed} values={{ serial: 'AAAA11112222', imei: '', imei2: '' }} reglas={iphoneRules} onAssign={onAssign} />);
  fireEvent.click(screen.getByRole('button', { name: 'Usar como serial' }));
  rerender(<OcrCandidateReview parsed={parsed} values={{ serial: 'BBBB33334444', imei: '', imei2: '' }} reglas={iphoneRules} onAssign={onAssign} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reemplazar' }));
  expect(onAssign).not.toHaveBeenCalled();
  expect(screen.getByRole('alert')).toHaveTextContent('Serial ya tiene BBBB33334444');
});
