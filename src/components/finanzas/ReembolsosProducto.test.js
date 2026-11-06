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
  fireEvent.click(screen.getByRole('button', { name: 'Registrar reclamo' }));
  await waitFor(() =>
    expect(finanzasApi.crearReembolso).toHaveBeenCalledWith({
      productoId: 476,
      motivo: 'No llegó a Eshopex.',
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
