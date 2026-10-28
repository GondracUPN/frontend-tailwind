import parseSnImeiIds, {
  assignCandidate,
  candidateTargets,
  createScanSession,
  mapSelectionToImage,
  planAutofill,
} from './snImeiOcr';
// Respuestas sintéticas generadas con el reconocedor real del backend (identifier-recognizer.ts).
import fixtures from './snImeiOcr.fixtures.json';

const rule = (visible) => ({ visible, requiredForComplete: visible });
const rules = {
  mac: { tipo: 'macbook', serial: rule(true), imei: rule(false), imei2: rule(false) },
  airpods: { tipo: 'airpods', serial: rule(true), imei: rule(false), imei2: rule(false) },
  ipadWifi: { tipo: 'ipad', serial: rule(true), imei: rule(false), imei2: rule(false) },
  watchGps: { tipo: 'watch', serial: rule(true), imei: rule(false), imei2: rule(false) },
  ipadCellular: { tipo: 'ipad', serial: rule(true), imei: rule(true), imei2: rule(false) },
  iphone: { tipo: 'iphone', serial: rule(true), imei: rule(true), imei2: rule(true) },
};
const empty = { serial: '', imei: '', imei2: '' };

test('mantiene los campos antiguos derivados y los candidatos tipados', () => {
  const parsed = parseSnImeiIds(fixtures.iphone);
  expect(parsed).toMatchObject({
    serial: 'FGHJKLMPQR',
    imei1: '352099001761481',
    imei2: '353915112345675',
    serials: ['FGHJKLMPQR'],
    imeis: ['352099001761481', '353915112345675'],
  });
  expect(parsed.text).toContain('EID');
  for (const candidate of parsed.candidates) {
    expect(Object.keys(candidate)).toEqual(expect.arrayContaining([
      'kind', 'value', 'rawValue', 'label', 'confidence', 'confidenceSource', 'validation', 'warnings', 'sourcePass', 'boundingBox', 'corrections',
    ]));
  }
  // El texto suelto ya no se interpreta en el navegador: el reconocimiento es único y está en el backend.
  expect(parseSnImeiIds('Serial Number: FGHJKLMPQR').candidates).toEqual([]);
});

test('campos aplicables por tipo: Mac/AirPods/iPad Wi-Fi/Watch GPS sin IMEI, cellular uno, iPhone dos', () => {
  const parsed = parseSnImeiIds(fixtures.iphone);
  for (const key of ['mac', 'airpods', 'ipadWifi', 'watchGps']) {
    const plan = planAutofill(parsed, empty, rules[key]);
    expect(plan.patch).toEqual({ serial: 'FGHJKLMPQR' });
    expect(plan.notApplicable.map((item) => item.field).sort()).toEqual(['imei', 'imei2']);
  }
  expect(planAutofill(parsed, empty, rules.ipadCellular).patch).toEqual({ serial: 'FGHJKLMPQR', imei: '352099001761481' });
  expect(planAutofill(parsed, empty, rules.iphone).patch).toEqual({ serial: 'FGHJKLMPQR', imei: '352099001761481', imei2: '353915112345675' });
  const imeiCandidate = parsed.candidates.find((c) => c.kind === 'imei');
  expect(candidateTargets(imeiCandidate, rules.ipadCellular)).toEqual(['imei']);
  expect(candidateTargets(imeiCandidate, rules.mac)).toEqual([]);
});

test('solo IMEI2: nunca se mueve a IMEI 1, ni siquiera en un iPad cellular con un solo campo', () => {
  const parsed = parseSnImeiIds(fixtures.imei2Only);
  expect(planAutofill(parsed, empty, rules.iphone).patch).toEqual({ serial: 'GXQTQJCTWH', imei2: '353915112345675' });
  expect(planAutofill(parsed, empty, rules.ipadCellular).patch).toEqual({ serial: 'GXQTQJCTWH' });
});

test('AirPods: se autocompleta el serial del estuche, no el de los auriculares', () => {
  const parsed = parseSnImeiIds(fixtures.airpods);
  expect(planAutofill(parsed, empty, rules.airpods).patch).toEqual({ serial: 'GXQTQJCTWH' });
  expect(parsed.candidates.map((c) => c.component).sort()).toEqual(['case', 'left']);
});

test('no pisa valores confirmados y deja constancia', () => {
  const parsed = parseSnImeiIds(fixtures.iphone);
  const plan = planAutofill(parsed, { serial: 'C02XG2JHJGH5', imei: '', imei2: '' }, rules.iphone);
  expect(plan.patch.serial).toBeUndefined();
  expect(plan.kept).toEqual([{ field: 'serial', current: 'C02XG2JHJGH5', proposed: 'FGHJKLMPQR' }]);
});

test('asignación manual: conflicto al reemplazar y prohibición de IMEI repetido', () => {
  expect(assignCandidate(empty, 'serial', 'FGHJKLMPQR')).toEqual({ patch: { serial: 'FGHJKLMPQR' }, conflict: null });
  expect(assignCandidate({ ...empty, serial: 'X1' }, 'serial', 'FGHJKLMPQR').conflict).toMatchObject({ type: 'replace', current: 'X1' });
  expect(assignCandidate({ ...empty, imei: '352099001761481' }, 'imei2', '352099001761481').conflict).toMatchObject({ type: 'duplicate', other: 'imei' });
});

test('respuesta obsoleta: una lectura nueva invalida y aborta la anterior', () => {
  const session = createScanSession();
  const first = session.begin();
  const second = session.begin();
  expect(first.signal.aborted).toBe(true);
  expect(first.isCurrent({ requestToken: first.token })).toBe(false);
  expect(second.isCurrent({ requestToken: second.token })).toBe(true);
  expect(second.isCurrent({ requestToken: first.token })).toBe(false);
  session.cancel();
  expect(second.isCurrent({ requestToken: second.token })).toBe(false);
  expect(second.signal.aborted).toBe(true);
});

describe('recorte escalado', () => {
  test('vista reducida al 25 %: las fracciones corresponden al tamaño original', () => {
    const rect = { left: 10, top: 20, width: 1000, height: 750 };
    const crop = mapSelectionToImage({ x1: 260, y1: 395, x2: 510, y2: 470 }, rect, { width: 4000, height: 3000 });
    expect(crop).toMatchObject({ x: 0.25, y: 0.5, width: 0.25, height: 0.1, pixels: { left: 1000, top: 1500, width: 1000, height: 300 } });
  });

  test('object-fit: contain descuenta las bandas y recorta la selección al borde', () => {
    const rect = { left: 0, top: 0, width: 800, height: 400 }; // imagen vertical 1000x2000 mostrada a 200x400
    const crop = mapSelectionToImage({ x1: 250, y1: -50, x2: 900, y2: 200 }, rect, { width: 1000, height: 2000 }, 'contain');
    expect(crop).toMatchObject({ x: 0, y: 0, width: 1, height: 0.5 });
    expect(mapSelectionToImage({ x1: 10, y1: 10, x2: 12, y2: 12 }, rect, { width: 1000, height: 2000 }, 'contain')).toBeNull();
  });
});
