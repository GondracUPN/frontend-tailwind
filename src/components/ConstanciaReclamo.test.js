import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ConstanciaReclamo from './ConstanciaReclamo';
import api from '../api';

jest.mock('../api', () => ({ __esModule: true, default: { get: jest.fn(), del: jest.fn() } }));
jest.mock('../services/finanzas', () => ({ sesionFinanciera: () => ({ esAdmin: true }) }));
jest.mock('./finanzas/ReembolsosProducto', () => () => null);

const venta = id => ({ id, vendedor: 'Gonzalo (Jorge)', tipoCambio: '3.4012', precioVenta: '2140.00',
  pagado: '2140.00', saldoGenerado: '2140.00', saldoDisponible: '2140.00', pagos: [], fechaVenta: '2026-10-17' });
const producto = { id: 454 };
beforeEach(() => { jest.clearAllMocks(); window.confirm = jest.fn(() => true); });

test('elimina solo la fila seleccionada y sigue ausente al volver a abrir la constancia', async () => {
  let ocultada = false;
  api.get.mockImplementation(async () => ({ ventas: ocultada ? [venta(2)] : [venta(2), venta(1)] }));
  api.del.mockImplementation(async () => { ocultada = true; return { oculta: true }; });
  const view = render(<ConstanciaReclamo producto={producto} />);
  await screen.findByText('Venta #1 · Gonzalo (Jorge)');
  expect(screen.getAllByText('S/ 3.4012 por US$ 1')).toHaveLength(2);
  fireEvent.click(screen.getAllByRole('button', { name: 'Eliminar de constancia' })[1]);
  await waitFor(() => expect(screen.queryByText('Venta #1 · Gonzalo (Jorge)')).not.toBeInTheDocument());
  expect(screen.getByText('Venta #2 · Gonzalo (Jorge)')).toBeInTheDocument();
  expect(api.del).toHaveBeenCalledWith('/ventas/producto/454/constancia/1');
  view.unmount();
  render(<ConstanciaReclamo producto={producto} />);
  await screen.findByText('Venta #2 · Gonzalo (Jorge)');
  expect(screen.queryByText('Venta #1 · Gonzalo (Jorge)')).not.toBeInTheDocument();
});

test('conserva la constancia si falla la eliminación o se cancela', async () => {
  api.get.mockResolvedValue({ ventas: [venta(1)] });
  api.del.mockRejectedValue(new Error('No se pudo quitar'));
  render(<ConstanciaReclamo producto={producto} />);
  const boton = await screen.findByRole('button', { name: 'Eliminar de constancia' });
  window.confirm.mockReturnValueOnce(false);
  fireEvent.click(boton);
  expect(api.del).not.toHaveBeenCalled();
  fireEvent.click(boton);
  await screen.findByRole('alert');
  expect(screen.getByText('Venta #1 · Gonzalo (Jorge)')).toBeInTheDocument();
});
