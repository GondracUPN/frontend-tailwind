import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReembolsosProducto from './ReembolsosProducto';
import { finanzasApi } from '../../services/finanzas';
jest.mock('../../services/finanzas', () => ({
  finanzasApi: {
    reembolsos: jest.fn(),
    cuentas: jest.fn(),
    crearReembolso: jest.fn(),
    eventoReembolso: jest.fn(),
    cerrarProducto: jest.fn(),
  },
  esErrorDePermiso: () => false,
  limpiarError: (e) => e.message,
  nuevaClave: () => 'reembolso-clave-test',
}));
const producto = {
  id: 476,
  codigoInventario: 476,
  valor: { monedaCompra: 'USD', valorProducto: '750.19' },
};
beforeEach(() => {
  jest.clearAllMocks();
  finanzasApi.reembolsos.mockResolvedValue([]);
  finanzasApi.cuentas.mockResolvedValue([
    { id: 1, nombre: 'Banco', activo: true, tipo: 'banco' },
  ]);
});
test('el reclamo solicita solo dos motivos y usa el importe original de compra sin campos financieros editables', async () => {
  render(<ReembolsosProducto producto={producto} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Reclamo no llegó' }),
  );
  const selector = screen.getByLabelText('Motivo del reclamo');
  expect([...selector.options].slice(1).map((o) => o.text)).toEqual([
    'No llegó a Eshopex.',
    'Llegó algo distinto al producto comprado.',
  ]);
  expect(screen.getByText(/USD 750.19/)).toBeInTheDocument();
  [
    'Estado inicial',
    'Moneda del reclamo',
    'Costo original S/ (opcional)',
    'Gastos adicionales S/',
    'Devolución a',
  ].forEach((label) =>
    expect(screen.queryByLabelText(label)).not.toBeInTheDocument(),
  );
  fireEvent.change(selector, { target: { value: 'No llegó a Eshopex.' } });
  fireEvent.change(screen.getByLabelText('Fecha del reclamo'), { target: { value: '2026-11-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar reclamo' }));
  await waitFor(() =>
    expect(finanzasApi.crearReembolso).toHaveBeenCalledWith({
      productoId: 476,
      motivo: 'No llegó a Eshopex.',
      fechaIncidencia: '2026-11-02',
    }),
  );
  expect(finanzasApi.eventoReembolso).not.toHaveBeenCalled();
});
test('el reembolso requiere confirmación explícita y guarda su propia fecha', async () => {
  finanzasApi.reembolsos.mockResolvedValue([
    {
      id: 9,
      estado: 'reclamo_abierto',
      motivo: 'No llegó a Eshopex.',
      moneda: 'USD',
      montoReclamado: '750.19',
      costoOriginal: '2550.65',
      tipoCambioCompra: '3.4000',
      fechaIncidencia: '2026-11-01',
      eventos: [],
    },
  ]);
  render(<ReembolsosProducto producto={producto} />);
  fireEvent.click(
    await screen.findByRole('button', { name: 'Registrar reembolso recibido' }),
  );
  expect(screen.getByRole('dialog')).toHaveTextContent('SKU 476');
  expect(finanzasApi.eventoReembolso).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Fecha del reembolso'), {
    target: { value: '2026-11-12' },
  });
  fireEvent.change(
    screen.getByLabelText('Cuenta o tarjeta que recibió el reembolso'),
    { target: { value: '1' } },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Confirmar reembolso recibido' }),
  );
  await waitFor(() =>
    expect(finanzasApi.eventoReembolso).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        tipo: 'recibido',
        monto: 750.19,
        fecha: '2026-11-12',
        cuentaId: 1,
      }),
    ),
  );
});

test('permite corregir la fecha y exige confirmar la anulación del reclamo', async () => {
  finanzasApi.reembolsos.mockResolvedValue([{ id: 9, estado: 'reclamo_abierto', fechaIncidencia: '2026-11-01', moneda: 'USD', montoReclamado: '750.19', eventos: [] }]);
  render(<ReembolsosProducto producto={producto} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Cambiar fecha del reclamo' }));
  fireEvent.change(screen.getByLabelText('Nueva fecha del reclamo'), { target: { value: '2026-11-02' } });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar fecha del reclamo' }));
  await waitFor(() => expect(finanzasApi.eventoReembolso).toHaveBeenCalledWith(9, expect.objectContaining({ tipo: 'fecha_reclamo', fecha: '2026-11-02' })));
  fireEvent.click(await screen.findByRole('button', { name: 'Anular reclamo' }));
  expect(finanzasApi.eventoReembolso).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar anulación' }));
  await waitFor(() => expect(finanzasApi.eventoReembolso).toHaveBeenCalledWith(9, expect.objectContaining({ tipo: 'anulacion' })));
});

test('los reclamos anulados quedan en historial cerrado y no aparecen como reclamos vigentes', async () => {
  finanzasApi.reembolsos.mockResolvedValue([{ id: 9, estado: 'anulado', fechaIncidencia: '2026-11-01', motivo: 'No llegó a Eshopex.', moneda: 'USD', montoReclamado: '750.19', eventos: [] }]);
  render(<ReembolsosProducto producto={producto} />);
  expect(await screen.findByText('Historial de reclamos anulados (1)')).toBeVisible();
  expect(document.querySelector('details')).not.toHaveAttribute('open');
  expect(screen.queryByText('Reclamado: USD 750.19')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Anular reclamo' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Reclamo no llegó' })).toBeVisible();
});

test('un reembolso recibido se puede quitar tras confirmar y muestra el historial retirado', async () => {
  finanzasApi.reembolsos.mockResolvedValue([{ id: 9, estado: 'recibido', fechaIncidencia: '2026-11-01', moneda: 'USD', montoReclamado: '750.19',
    eventos: [{ id: 1, tipo: 'recibido_anulado', fecha: '2026-11-02', moneda: 'USD', monto: '750.19' }] }]);
  render(<ReembolsosProducto producto={producto} />);
  expect(await screen.findByText(/Reembolso retirado/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Quitar reembolso' }));
  expect(finanzasApi.eventoReembolso).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar quitar reembolso' }));
  await waitFor(() => expect(finanzasApi.eventoReembolso).toHaveBeenCalledWith(9, expect.objectContaining({ tipo: 'anulacion' })));
});

test('un reembolso cerrado permite habilitar la venta conservando su historial', async () => {
  finanzasApi.reembolsos.mockResolvedValue([{ id: 9, estado: 'recibido', fechaIncidencia: '2026-11-01', moneda: 'USD', montoReclamado: '750.19', eventos: [] }]);
  render(<ReembolsosProducto producto={{ ...producto, cierreMotivo: 'no_comercializable' }} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Habilitar producto para vender' }));
  await waitFor(() => expect(finanzasApi.cerrarProducto).toHaveBeenCalledWith(476, 'reabrir'));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Habilitar producto para vender' })).not.toBeInTheDocument());
});
