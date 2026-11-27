import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import ProductAnalysisPanel from './ProductAnalysisPanel';

const NOW = Date.parse('2026-11-26T12:00:00Z');
const iso = (d) => new Date(NOW - d * 86400000).toISOString();

const groups = [
  {
    tipo: 'macbook', gama: 'Air', proc: 'M2', pantalla: '13', ram: '8GB', ssd: '256GB', estado: 'usado', label: 'MacBook Air 13" M2',
    comprasDetalle: [1, 2, 3].map((id) => ({ productoId: id, precioUSD: 700, costoTotal: 2690, fechaCompra: iso(40), accesoriosCategoria: 'caja' })),
    ventasDetalle: [1, 2, 3].map((id) => ({ productoId: id, precioVenta: 3500, fechaVenta: iso(10), accesoriosCategoria: 'caja', dias: 15, ganancia: 810, porcentaje: 30 })),
  },
  {
    tipo: 'macbook', gama: 'Air', proc: 'M2', pantalla: '13', ram: '8GB', ssd: '256GB', estado: 'nuevo', label: 'MacBook Air 13" M2',
    comprasDetalle: [], ventasDetalle: [],
  },
];

test('muestra una ficha por modelo con las cuatro condiciones y la compra en soles y USD', () => {
  render(<ProductAnalysisPanel groups={groups} allGroups={groups} tc={3.7} now={NOW} />);
  expect(screen.getAllByText('MacBook Air 13" M2')).toHaveLength(1);
  const caja = screen.getByTestId('cond-usado_caja');
  expect(within(caja).getByText('Confianza media')).toBeInTheDocument();
  expect(within(caja).getByText('Si te lo ofrecen en soles')).toBeInTheDocument();
  expect(within(caja).getByText('Si lo compras en USD (eBay/USA)')).toBeInTheDocument();
  expect(within(caja).getByText('$700')).toBeInTheDocument();
  expect(within(screen.getByTestId('cond-usado_simple')).getByText(/estimado desde otras condiciones/)).toBeInTheDocument();
  expect(screen.getByTestId('cond-nuevo')).toBeInTheDocument();
});

test('el filtro de estado deja solo las condiciones de usado', () => {
  render(<ProductAnalysisPanel groups={groups} allGroups={groups} estadoFilter="usado" tc={3.7} now={NOW} />);
  expect(screen.queryByTestId('cond-nuevo')).not.toBeInTheDocument();
  expect(screen.getByTestId('cond-usado_accesorios')).toBeInTheDocument();
});

test('la calculadora evalúa una oferta en soles', () => {
  render(<ProductAnalysisPanel groups={groups} allGroups={groups} tc={3.7} now={NOW} />);
  fireEvent.change(screen.getByLabelText('Condición de la oferta'), { target: { value: 'usado_caja' } });
  fireEvent.change(screen.getByLabelText('Precio ofrecido'), { target: { value: '2400' } });
  expect(screen.getByRole('status')).toHaveTextContent('Muy buena compra');
});

test('sin datos muestra el estado vacío', () => {
  render(<ProductAnalysisPanel groups={[]} allGroups={[]} tc={3.7} now={NOW} />);
  expect(screen.getByText(/No hay productos para esta combinación/)).toBeInTheDocument();
});
