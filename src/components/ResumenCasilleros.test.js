import { fireEvent, render, screen } from '@testing-library/react';
import ResumenCasilleros, { computeCasilleroStats, LIMITE_DEC_USD } from './ResumenCasilleros';

const pkg = (id, casillero, valorDec, extra = {}) => ({
  id,
  valor: { valorDec },
  tracking: [{ casillero, estado: 'en_eshopex' }],
  ...extra,
});

const byName = (stats) => Object.fromEntries(stats.map((c) => [c.nombre, c]));

test('calcula el saldo libre contra el límite de $200', () => {
  const stats = byName(computeCasilleroStats([pkg(1, 'Walter', 50), pkg(2, 'Walter', 30)]));
  expect(LIMITE_DEC_USD).toBe(200);
  expect(stats.Walter.decActualUSD).toBe(80);
  expect(stats.Walter.libreUSD).toBe(120);
  expect(stats.Walter.actuales).toBe(2);
  expect(stats.Walter.nivel).toBe('libre');
});

test('suma el DEC una sola vez por grupo de envío', () => {
  const stats = byName(computeCasilleroStats([
    pkg(1, 'Kenny', 90, { envioGrupoId: 'g1' }),
    pkg(2, 'Kenny', 90, { envioGrupoId: 'g1' }),
  ]));
  expect(stats.Kenny.decActualUSD).toBe(90);
  expect(stats.Kenny.actuales).toBe(2);
});

test('no cuenta paquetes recogidos ni despachados', () => {
  const stats = byName(computeCasilleroStats([
    { id: 1, valor: { valorDec: 150 }, tracking: [{ casillero: 'Alex', estado: 'recogido' }] },
    pkg(2, 'Alex', 150, { despacho: { id: 9 } }),
  ]));
  expect(stats.Alex.decActualUSD).toBe(0);
  expect(stats.Alex.total).toBe(2);
  expect(stats.Alex.libreUSD).toBe(200);
});

test('marca lleno desde $200 y casi lleno desde el 70 %', () => {
  const stats = byName(computeCasilleroStats([
    pkg(1, 'Jorge', 200), pkg(2, 'Renato', 199.99), pkg(3, 'Alex', 140), pkg(4, 'Kenny', 139),
  ]));
  expect(stats.Jorge.nivel).toBe('lleno');
  expect(stats.Jorge.puedeRecibir).toBe(false);
  expect(stats.Jorge.libreUSD).toBe(0);
  expect(stats.Renato.nivel).toBe('casi');
  expect(stats.Alex.nivel).toBe('casi');
  expect(stats.Kenny.nivel).toBe('libre');
});

test('ordena primero los que pueden recibir, por saldo libre', () => {
  const stats = computeCasilleroStats([pkg(1, 'Walter', 250), pkg(2, 'Renato', 10), pkg(3, 'Christian', 100)]);
  const names = stats.map((c) => c.nombre);
  expect(names[names.length - 1]).toBe('Walter');
  expect(names.indexOf('Renato')).toBeGreaterThan(names.indexOf('Alex'));
  expect(names.indexOf('Christian')).toBeGreaterThan(names.indexOf('Renato'));
});

test('resume cuántos pueden recibir y filtra por el monto de la compra', () => {
  const onClick = jest.fn();
  render(<ResumenCasilleros productos={[pkg(1, 'Walter', 190), pkg(2, 'Kenny', 200)]} onCasilleroClick={onClick} />);
  expect(screen.getByText('7 de 8 pueden recibir')).toBeInTheDocument();
  expect(screen.getByLabelText(/^Walter: Casi lleno\. \$ 10\.00 libres/)).toBeInTheDocument();

  expect(screen.getByLabelText(/^Walter:/)).toHaveTextContent('1 paquete');
  expect(screen.getByLabelText(/^Renato:/)).toHaveTextContent('0 paquetes');

  fireEvent.change(screen.getByLabelText(/Cuánto declara tu compra/), { target: { value: '50' } });
  expect(screen.getByText('6 aceptan $ 50.00')).toBeInTheDocument();

  fireEvent.keyDown(screen.getByLabelText(/^Walter:/), { key: 'Enter' });
  expect(onClick).toHaveBeenCalledWith('Walter');
});
