import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ProductosPedidoPendientes from './ProductosPedidoPendientes';

test('excluye reembolsos y permite ordenar códigos e importes en ambos sentidos', () => {
  const rows = [
    { id: 1, codigoProducto: 'MS-20', fecha: '2026-10-20', saldo: 1000 },
    { id: 2, codigoProducto: 'MS-3', fecha: '2026-10-21', saldo: 200 },
    { id: 3, codigoProducto: 'MS-454', tieneReembolso: true },
    { id: 4, codigoProducto: 'MS-455', tieneReembolso: true },
    { id: 5, codigoProducto: 'MS-500', estadoPago: 'pagado' },
  ];
  render(<ProductosPedidoPendientes rows={rows} fmtDate={v => v} renderEstado={() => ({ label: 'Pendiente', cls: '' })} renderMoney={(r, c) => r[c]} />);
  const codigos = () => screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell')[2].textContent);
  expect(codigos()).toEqual(['MS-3', 'MS-20']);
  expect(screen.queryByText('MS-454')).not.toBeInTheDocument();
  expect(screen.queryByText('MS-500')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Código/ }));
  expect(codigos()).toEqual(['MS-3', 'MS-20']);
  fireEvent.click(screen.getByRole('button', { name: /Código/ }));
  expect(codigos()).toEqual(['MS-20', 'MS-3']);
  fireEvent.click(screen.getByRole('button', { name: /Saldo/ }));
  expect(codigos()).toEqual(['MS-3', 'MS-20']);
  expect(screen.getByRole('columnheader', { name: /Saldo/ })).toHaveAttribute('aria-sort', 'ascending');
});
