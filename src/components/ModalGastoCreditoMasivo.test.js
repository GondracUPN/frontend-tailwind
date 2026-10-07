jest.mock('pdfjs-dist/webpack', () => ({ getDocument: jest.fn() }));
jest.mock('../utils/createExpense', () => ({
  createExpenseWithDuplicateCheck: jest.fn(),
  ExpenseDuplicateCancelledError: class ExpenseDuplicateCancelledError extends Error {},
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as pdfjsLib from 'pdfjs-dist/webpack';
import { createExpenseWithDuplicateCheck } from '../utils/createExpense';
import ModalGastoCreditoMasivo, { compareBulkExpenses, debitPaymentBody, parseBulkRows, pdfLinesToBulkText, pdfTextItemsToLines, spreadsheetToBulkLines } from './ModalGastoCreditoMasivo';

test('separa las columnas Cargos/Debe y Abonos/Haber de un estado de débito', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const lines = pdfTextItemsToLines([
    item('2026', 40, 640),
    item('CARGOS / DEBE', 425, 610), item('ABONOS / HABER', 620, 610),
    item('01AGO', 20, 580), item('01AGO', 80, 580), item('PAGO TARJETA BCP', 145, 580), item('3,900.86', 470, 580),
    item('01AGO', 20, 560), item('01AGO', 80, 560), item('ABON PLIN-Kenny', 145, 560), item('25.00', 660, 560),
    item('02AGO', 20, 540), item('02AGO', 80, 540), item('IMPUESTO ITF', 145, 540), item('0.35', 470, 540),
    item('03AGO', 20, 520), item('03AGO', 80, 520), item('DEPOSITO EFECTIVO', 145, 520), item('4,100.00', 660, 520),
  ]);
  expect(lines).toContain('01AGO 01AGO PAGO TARJETA BCP 3,900.86 [CARGO]');
  expect(lines).toContain('01AGO 01AGO ABON PLIN-Kenny 25.00 [ABONO]');
  const pagos = pdfLinesToBulkText(lines, 'debito');
  expect(pagos).toContain('pago_tarjeta | PEN | 3900.86 | 01/08/2026');
  expect(pagos).not.toContain('25');
  const gastos = pdfLinesToBulkText(lines, 'debito_gastos');
  expect(gastos).toContain('pago_tarjeta | PEN | 3900.86 | 01/08/2026');
  expect(gastos).toContain('itf | PEN | 0.35 | 02/08/2026');
  expect(gastos).not.toContain('25');
  const abonos = pdfLinesToBulkText(lines, 'debito_abonos');
  expect(abonos).toContain('ingreso | PEN | 25 | 01/08/2026 | ABON PLIN-Kenny');
  expect(abonos).toContain('ingreso | PEN | 4100 | 03/08/2026 | DEPOSITO EFECTIVO');
  expect(abonos).not.toContain('3900.86');
  expect(parseBulkRows(abonos, 'debito_abonos').rows).toHaveLength(2);
});

test('conserva cargos IO con códigos y nombres del estado BCP', () => {
  const lines = [
    '2026',
    '02AGO 02AGO IO D000075135395 1,774.24 [CARGO]',
    '02AGO 02AGO IO D000075135395 2,217.80 [CARGO]',
    '03AGO 03AGO YC-IO*WALTER GONZA 85.00 [CARGO]',
    '03AGO 03AGO DEPOSITO EFECTIVO 4,100.00 [ABONO]',
  ];
  const parsed = parseBulkRows(pdfLinesToBulkText(lines, 'debito_gastos'), 'debito_gastos');
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => [row.body.monto, row.body.notas])).toEqual([
    [1774.24, 'IO D000075135395'],
    [2217.8, 'IO D000075135395'],
    [85, 'YC-IO*WALTER GONZA'],
  ]);
});

test('el formato BCP de ahorros conserva todos los cargos con importe, incluidos pagos a tarjeta y Yape', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const lines = pdfTextItemsToLines([
    item('01/08/26', 399, 666),
    item('CARGOS / DEBE', 343, 630), item('ABONOS / HABER', 485, 630),
    item('02AGO', 37, 543), item('02AGO', 80, 543), item('IO D000075135395', 123, 543), item('1,774.24', 368, 543),
    item('07AGO', 37, 387), item('07AGO', 80, 387), item('PAG.T.PROP.AMEX.BM', 123, 387), item('3,635.15', 368, 387),
    item('19AGO', 37, 431), item('19AGO', 80, 431), item('Pago YAPE a 000000', 123, 431), item('17.25', 390, 431),
    item('20AGO', 37, 522), item('20AGO', 80, 522), item('IMPUESTO ITF', 123, 522), item('0.60', 397, 522),
    item('20AGO', 37, 510), item('20AGO', 80, 510), item('DEPOSITO EFECTIVO', 123, 510), item('4,100.00', 505, 510),
    item('31AGO', 37, 477), item('31AGO', 80, 477), item('MANT. CUENTA AGO26', 123, 477), item('0.00', 397, 477),
  ]);
  const parsed = parseBulkRows(pdfLinesToBulkText(lines, 'debito_gastos'), 'debito_gastos');
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => [row.body.fecha, row.body.concepto, row.body.monto]).sort((a, b) => a[0].localeCompare(b[0]))).toEqual([
    ['2026-08-02', 'gusto', 1774.24],
    ['2026-08-07', 'pago_tarjeta', 3635.15],
    ['2026-08-19', 'gusto', 17.25],
    ['2026-08-20', 'itf', 0.6],
  ]);
  const payment = { id: 44, fecha: '2026-08-07', moneda: 'PEN', monto: 3635.15, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bbva', tarjetaPago: 'bcp_amex' };
  expect(compareBulkExpenses(parsed.rows, [payment], 'bcp', 'debito_gastos').pairs.find((pair) => pair.source.concepto === 'pago_tarjeta')?.target?.id).toBe(44);
});

test('en CSV cada vista usa exclusivamente su columna', () => {
  const csv = [
    'Fecha Proc.,Fecha Valor,Descripcion,Cargos/Debe,Abonos/Haber',
    '01/08/2026,01/08/2026,PAGO TARJETA,3900.86,',
    '01/08/2026,01/08/2026,ABON PLIN,,25.00',
    '02/08/2026,02/08/2026,DEPOSITO EFECTIVO,,4100.00',
  ].join('\n');
  const data = Buffer.from(csv, 'utf8');
  expect(spreadsheetToBulkLines(data, 'cuenta.csv', 'debito')).toEqual(['pago_tarjeta | PEN | 3900.86 | 01/08/2026 | PAGO TARJETA']);
  expect(spreadsheetToBulkLines(data, 'cuenta.csv', 'debito_gastos')).toEqual(['pago_tarjeta | PEN | 3900.86 | 01/08/2026 | PAGO TARJETA']);
  expect(spreadsheetToBulkLines(data, 'cuenta.csv', 'debito_abonos')).toEqual([
    'ingreso | PEN | 25 | 01/08/2026 | ABON PLIN',
    'ingreso | PEN | 4100 | 02/08/2026 | DEPOSITO EFECTIVO',
  ]);
});

test('un pago en Abonos se compara solo con pagos a tarjeta en soles', () => {
  const lines = [
    '2026',
    '04AGO 04AGO PAGO TARJETA AMEX 500.00 [ABONO]',
    '04AGO 04AGO ABON PLIN-Kenny 25.00 [ABONO]',
  ];
  const imported = parseBulkRows(pdfLinesToBulkText(lines, 'debito_abonos'), 'debito_abonos').rows;
  expect(imported.map((row) => row.body.concepto)).toEqual(['pago_tarjeta', 'ingreso']);
  const saved = [
    { id: 1, fecha: '2026-08-04', moneda: 'PEN', monto: 500, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bbva', tarjetaPago: 'bcp_amex' },
    { id: 2, fecha: '2026-08-04', moneda: 'USD', monto: 500, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp', tarjetaPago: 'bcp_amex' },
    { id: 3, fecha: '2026-08-04', moneda: 'PEN', monto: 25, concepto: 'ingreso', metodoPago: 'debito', tarjeta: 'bcp' },
  ];
  const comparison = compareBulkExpenses(imported, saved, 'bcp', 'debito_abonos');
  expect(comparison.matched).toBe(2);
  expect(comparison.pairs.map((pair) => pair.target?.id)).toEqual([3, 1]);
  expect(compareBulkExpenses(imported, saved.filter((row) => row.id !== 1), 'bcp', 'debito_abonos').matched).toBe(1);
  expect(compareBulkExpenses([{ ...imported[1], body: { ...imported[1].body, monto: 500 } }], [saved[0]], 'bcp', 'debito_abonos').matched).toBe(0);
});

test('muestra todos los pagos a tarjeta del sistema aunque estén fuera del período del archivo', () => {
  const imported = parseBulkRows('ingreso | PEN | 25 | 01/08/2026 | ABON PLIN', 'debito_abonos').rows;
  const payment = {
    id: 81, fecha: '2026-07-10', moneda: 'PEN', monto: 1774.24, montoUsdAplicado: 520,
    concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp', tarjetaPago: 'io',
  };
  const comparison = compareBulkExpenses(imported, [payment], 'bcp', 'debito_abonos');
  expect(comparison.candidates).toContainEqual(payment);
  expect(comparison.displayRows).toEqual(expect.arrayContaining([expect.objectContaining({ imported: null, saved: payment })]));
  expect(comparison.matched).toBe(0);
  const matchingFile = parseBulkRows('pago_tarjeta | PEN | 1774.24 | 11/07/2026 | TRAN.CTAS.TERC.BM', 'debito_abonos').rows;
  expect(compareBulkExpenses(matchingFile, [payment], 'bcp', 'debito_abonos').pairs[0].target.id).toBe(81);
});

test('permite marcar una transferencia genérica del abono como pago antes de comparar', async () => {
  const originalFetch = global.fetch;
  const saved = { id: 22, fecha: '2026-08-04', moneda: 'PEN', monto: 500, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bbva', tarjetaPago: 'bcp_amex' };
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'bcp_amex', label: 'BCP Amex' }] : [saved] }));
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abonos' }));
    await waitFor(() => expect(screen.queryByText('Cargando abonos existentes para comparar...')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Líneas de abonos'), { target: { value: 'ingreso | PEN | 500 | 04/08/2026 | TRAN.CTAS.TERC.BM' } });
    expect(screen.getByText(/Coinciden por fecha y monto: 0\/1/)).toBeInTheDocument();
    expect(screen.getByText(/Pago a tarjeta BCP_AMEX · Banco BBVA/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tipo de abono línea 1'), { target: { value: 'pago_tarjeta' } });
    expect(screen.getByText(/Coinciden por fecha y monto: 1\/1/)).toBeInTheDocument();
  } finally {
    global.fetch = originalFetch;
  }
});

test('guarda un pago nuevo de Abonos como pago a tarjeta en PEN', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'bcp_amex', label: 'BCP Amex' }] : [] }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 44 });
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abonos' }));
    fireEvent.change(screen.getByLabelText('Líneas de abonos'), { target: { value: 'pago_tarjeta | PEN | 500 | 04/08/2026 | PAGO TARJETA AMEX' } });
    await screen.findByRole('option', { name: 'BCP Amex' });
    await waitFor(() => expect(screen.queryByText('Cargando abonos existentes para comparar...')).not.toBeInTheDocument());
    expect(screen.getByLabelText('Tarjeta pagada en abonos nuevos')).toHaveValue('bcp_amex');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith(expect.objectContaining({
      concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: 'PEN', monto: 500,
      tarjeta: 'bcp', tarjetaPago: 'bcp_amex', pagoObjetivo: 'PEN',
    }), { userId: 1, notify: false }));
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
    createExpenseWithDuplicateCheck.mockReset();
  }
});

test('la vista Abonos compara ingresos del banco y guarda solo los nuevos', async () => {
  const originalFetch = global.fetch;
  const saved = { id: 12, fecha: '2026-08-01', moneda: 'PEN', monto: 25, concepto: 'ingreso', metodoPago: 'debito', tarjeta: 'bcp', notas: 'ABON PLIN' };
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [] : [saved] }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 13 });
  try {
    const onSaved = jest.fn();
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abonos' }));
    expect(screen.getByLabelText('Banco del abono')).toBeInTheDocument();
    expect(screen.queryByText('Tarjeta pagada en todas las líneas')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Cargando abonos existentes para comparar...')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Líneas de abonos'), { target: { value: 'ingreso | PEN | 25 | 01/08/2026 | ABON PLIN\ningreso | PEN | 4100 | 03/08/2026 | DEPOSITO EFECTIVO' } });
    expect(screen.getByText(/Coinciden por fecha y monto: 1\/2/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledTimes(1));
    expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith(expect.objectContaining({
      concepto: 'ingreso', metodoPago: 'debito', tarjeta: 'bcp', moneda: 'PEN', monto: 4100,
    }), { userId: 1, notify: false });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
    createExpenseWithDuplicateCheck.mockReset();
  }
});

test('lee la columna Dólares del PDF Amex aunque el pago termine en signo menos', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  const lines = pdfTextItemsToLines([
    item('2026', 45, 620), item('Soles', 471, 603), item('Dólares', 524, 603),
    item('24Ago', 47, 561), item('23Ago', 92, 561), item('PAGO BANCA MOVIL', 136, 561), item('PAGO', 410, 561), item('564.97-', 485, 561),
    item('24Ago', 47, 534), item('23Ago', 92, 534), item('PAGO BANCA MOVIL', 136, 534), item('PAGO', 410, 534), item('700.00-', 545, 534),
    item('25Ago', 47, 501), item('23Ago', 92, 501), item('PAYPAL *EBAY US', 136, 501), item('840', 321, 501), item('CONSUMO', 410, 501), item('850.00', 545, 501),
  ]);
  expect(lines).toContain('24Ago 23Ago PAGO BANCA MOVIL PAGO 564.97- [PEN]');
  expect(lines).toContain('24Ago 23Ago PAGO BANCA MOVIL PAGO 700.00- [USD]');
  const payments = pdfLinesToBulkText(lines, 'debito');
  expect(payments).toContain('pago_tarjeta | PEN | 564.97 | 23/08/2026');
  expect(payments).toContain('pago_tarjeta | USD | 700 | 23/08/2026');
  expect(pdfLinesToBulkText(lines)).toContain('inversion | USD | 850 | 23/08/2026');
});

test('Mercado Pago positivo es un consumo y PAGO BANCA MOVIL sigue siendo pago', () => {
  const lines = [
    '2026',
    '25Ago 23Ago MERCADO PAGO 604 CONSUMO 45.00 [PEN]',
    '25Ago 23Ago MERCADOPAGO 840 CONSUMO 12.50 [USD]',
    '25Ago 23Ago PAGO BANCA MOVIL PAGO 700.00 [USD]',
  ];
  const gastos = pdfLinesToBulkText(lines, 'credito');
  expect(gastos).toContain('gusto | PEN | 45 | 23/08/2026');
  expect(gastos).toContain('gusto | USD | 12.5 | 23/08/2026');
  expect(gastos).not.toContain('700');
  const pagos = pdfLinesToBulkText(lines, 'debito');
  expect(pagos).toContain('pago_tarjeta | USD | 700 | 23/08/2026');
  expect(pagos).not.toContain('MERCADO PAGO');
  const csv = [
    'Fecha,Descripcion,Monto,Moneda',
    '23/08/2026,OTRO COMERCIO,-30.00,PEN',
    '23/08/2026,MERCADO PAGO,45.00,PEN',
  ].join('\n');
  expect(spreadsheetToBulkLines(Buffer.from(csv, 'utf8'), 'movimientos.csv')).toContain('gusto | PEN | 45 | 23/08/2026 | MERCADO PAGO');
});

test('gastos de débito incluye ITF y compara cargos con egresos de todos los bancos', () => {
  const pdf = pdfLinesToBulkText([
    '2026',
    '25Ago 23Ago MERCADO PAGO 604 CONSUMO 45.00 [PEN]',
    '25Ago 23Ago ITF POR PAGO TARJETA 0.20 [PEN]',
    '25Ago 23Ago PAGO BANCA MOVIL PAGO 700.00 [USD]',
    '25Ago 23Ago DEVOLUCION COMPRA DEVOLUCION 12.00- [PEN]',
  ], 'debito_gastos');
  expect(pdf).toContain('gusto | PEN | 45 | 23/08/2026');
  expect(pdf).toContain('itf | PEN | 0.2 | 23/08/2026');
  expect(pdf).not.toContain('700');
  expect(pdf).not.toContain('DEVOLUCION');
  const parsed = parseBulkRows(pdf, 'debito_gastos');
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => row.body.metodoPago)).toEqual(['debito', 'debito']);
  expect(parseBulkRows('pago_tarjeta | PEN | 700 | 23/08/2026', 'debito_gastos').rows).toHaveLength(1);
  const imported = [
    { lineNumber: 1, body: { fecha: '2026-08-23', moneda: 'PEN', monto: 45, concepto: 'gusto' } },
    { lineNumber: 2, body: { fecha: '2026-08-23', moneda: 'USD', monto: 12.5, concepto: 'gusto' } },
  ];
  const saved = [
    { id: 1, fecha: '2026-08-23', moneda: 'PEN', monto: 45, concepto: 'gusto', metodoPago: 'debito', tarjeta: 'bcp' },
    { id: 2, fecha: '2026-08-23', moneda: 'USD', monto: 12.5, concepto: 'gusto', metodoPago: 'credito', tarjeta: 'bcp_amex' },
    { id: 3, fecha: '2026-08-23', moneda: 'PEN', monto: 700, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp' },
    { id: 4, fecha: '2026-08-23', moneda: 'PEN', monto: 45, concepto: 'ingresos', metodoPago: 'debito', tarjeta: 'bcp' },
    { id: 5, fecha: '2026-08-23', moneda: 'USD', monto: 12.5, concepto: 'itf', metodoPago: 'debito', tarjeta: 'interbank' },
  ];
  const comparison = compareBulkExpenses(imported, saved, 'bcp', 'debito_gastos');
  expect(comparison.matched).toBe(2);
  expect(comparison.candidates.map((row) => row.id)).toEqual([5, 1, 3]);
});

test('cargos IO se cotejan con pagos a tarjeta y otros gastos guardados del período', () => {
  const parsed = parseBulkRows(pdfLinesToBulkText([
    '2026',
    '02AGO 02AGO IO D000075135395 1,774.24 [CARGO]',
    '03AGO 03AGO YC-IO*WALTER GONZA 85.00 [CARGO]',
  ], 'debito_gastos'), 'debito_gastos');
  const saved = [
    { id: 81, fecha: '2026-08-02', moneda: 'PEN', monto: 1774.24, montoUsdAplicado: 520, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp', tarjetaPago: 'io' },
    { id: 82, fecha: '2026-08-03', moneda: 'PEN', monto: 85, concepto: 'gusto', metodoPago: 'debito', tarjeta: 'bcp' },
    { id: 83, fecha: '2026-08-03', moneda: 'PEN', monto: 85, concepto: 'gusto', metodoPago: 'debito', tarjeta: 'bbva' },
    { id: 84, fecha: '2026-07-01', moneda: 'PEN', monto: 100, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp', tarjetaPago: 'io' },
  ];
  const comparison = compareBulkExpenses(parsed.rows, saved, 'bcp', 'debito_gastos');
  expect(comparison.candidates.map((row) => row.id)).toEqual([81, 82, 83]);
  expect(comparison.pairs.map((pair) => pair.target?.id)).toEqual([81, 82]);
});

test('el botón junto a la contraseña permite comparar y guardar gastos de débito', async () => {
  const originalFetch = global.fetch;
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  pdfjsLib.getDocument.mockReturnValue({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: [
      item('2026', 45, 620), item('Soles', 471, 603), item('Dólares', 524, 603),
      item('25Ago', 47, 561), item('23Ago', 92, 561), item('MERCADO PAGO', 136, 561), item('604', 321, 561), item('CONSUMO', 410, 561), item('45.00', 490, 561),
      item('25Ago', 47, 545), item('23Ago', 92, 545), item('ITF POR PAGO TARJETA', 136, 545), item('0.20', 490, 545),
      item('25Ago', 47, 534), item('23Ago', 92, 534), item('PAGO BANCA MOVIL', 136, 534), item('PAGO', 410, 534), item('700.00-', 545, 534),
    ] }) }),
  }) });
  const saved = [
    { id: 1, fecha: '2026-08-23', moneda: 'PEN', monto: 45, concepto: 'gusto', metodoPago: 'debito', tarjeta: 'bcp' },
    { id: 3, fecha: '2026-08-23', moneda: 'PEN', monto: 45, concepto: 'gusto', metodoPago: 'credito', tarjeta: 'bcp_amex' },
    { id: 2, fecha: '2026-08-23', moneda: 'USD', monto: 700, concepto: 'pago_tarjeta', metodoPago: 'debito', tarjeta: 'bcp' },
  ];
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [] : saved }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 4 });
  try {
    const onSaved = jest.fn();
    const { container } = render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gastos (cargos)' }));
    expect(screen.getByText('Agregar gastos masivos (Débito)')).toBeInTheDocument();
    expect(screen.getByText('Tarjeta gasto')).toBeInTheDocument();
    expect(screen.queryByText('Tarjeta pagada en todas las líneas')).not.toBeInTheDocument();
    const pdfFile = new File(['pdf'], 'estado.pdf', { type: 'application/pdf' });
    Object.defineProperty(pdfFile, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [pdfFile] } });
    expect(await screen.findByText(/Coinciden por fecha y monto: 1\/2/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Tarjeta gasto/), { target: { value: 'bbva' } });
    expect(screen.getByText(/Coinciden por fecha y monto: 1\/2/)).toBeInTheDocument();
    expect(screen.getByText('Comparación con cargos de todos los bancos de débito')).toBeInTheDocument();
    expect(screen.getByLabelText('Líneas de gastos').value).toContain('itf | PEN | 0.2');
    expect(screen.getByLabelText('Líneas de gastos').value).not.toContain('pago_tarjeta');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledTimes(1));
    expect(createExpenseWithDuplicateCheck.mock.calls[0][0]).toMatchObject({ concepto: 'itf', metodoPago: 'debito', moneda: 'PEN', monto: 0.2, tarjeta: 'bbva' });
    expect(createExpenseWithDuplicateCheck.mock.calls[0][0]).not.toHaveProperty('tarjetaPago');
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  } finally {
    global.fetch = originalFetch;
    pdfjsLib.getDocument.mockReset();
    createExpenseWithDuplicateCheck.mockReset();
    localStorage.removeItem('token');
  }
});

test('guarda un cargo de pago a tarjeta con el banco de origen y la tarjeta pagada', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'bcp_amex', label: 'BCP Amex' }] : [] }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 98 });
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Gastos (cargos)' }));
    fireEvent.change(screen.getByLabelText(/^Tarjeta gasto/), { target: { value: 'bbva' } });
    fireEvent.change(screen.getByLabelText('Líneas de gastos'), { target: { value: 'pago_tarjeta | PEN | 3635.15 | 07/08/2026 | PAG.T.PROP.AMEX.BM' } });
    await waitFor(() => expect(screen.getByLabelText('Tarjeta pagada línea 1')).toHaveValue('bcp_amex'));
    await waitFor(() => expect(screen.queryByText('Cargando gastos existentes para comparar...')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith(expect.objectContaining({
      concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: 'PEN', monto: 3635.15,
      tarjeta: 'bbva', tarjetaPago: 'bcp_amex', pagoObjetivo: 'PEN',
    }), expect.anything()));
  } finally {
    global.fetch = originalFetch;
    createExpenseWithDuplicateCheck.mockReset();
    localStorage.removeItem('token');
  }
});

test('Guardar masivo envía el pago en soles y conserva monto USD y tipo de cambio', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'io', label: 'iO' }] : [] }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockResolvedValue({ id: 1 });
  const onSaved = jest.fn();
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={onSaved} />);
    await screen.findByRole('option', { name: 'iO' });
    await waitFor(() => expect(screen.queryByText('Cargando pagos existentes para comparar...')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Líneas de pagos'), { target: { value: 'pago_tarjeta | USD | 100 | 05/10/2026 | Banco' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Tipo de cambio línea 1' }));
    fireEvent.change(screen.getByLabelText('Tipo de cambio para línea 1'), { target: { value: '3.75' } });
    expect(screen.getByText('Equivale a S/ 375.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    await waitFor(() => expect(createExpenseWithDuplicateCheck).toHaveBeenCalledWith(expect.objectContaining({
      moneda: 'PEN', monto: 375, pagoObjetivo: 'USD', montoUsdAplicado: 100, tipoCambioDia: 3.75,
      tarjeta: 'bcp', tarjetaPago: 'io',
    }), { userId: 1, notify: false }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
    createExpenseWithDuplicateCheck.mockReset();
  }
});

test('un TC ingresado encuentra el pago en otro banco y evita duplicarlo', async () => {
  const originalFetch = global.fetch;
  const saved = { id: 9, fecha: '2026-10-05', moneda: 'PEN', monto: 375, metodoPago: 'debito', concepto: 'pago_tarjeta', tarjeta: 'bbva', tarjetaPago: 'io' };
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'io', label: 'iO' }] : [saved] }));
  localStorage.setItem('token', 'test-token');
  createExpenseWithDuplicateCheck.mockClear();
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    await screen.findByRole('option', { name: 'iO' });
    await waitFor(() => expect(screen.queryByText('Cargando pagos existentes para comparar...')).not.toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Líneas de pagos'), { target: { value: 'pago_tarjeta | USD | 100 | 05/10/2026 | Banco' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Tipo de cambio línea 1' }));
    fireEvent.change(screen.getByLabelText('Tipo de cambio para línea 1'), { target: { value: '3.75' } });
    await waitFor(() => expect(screen.getByText(/Coinciden por fecha y monto: 1\/1/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    expect(screen.getByText('No hay gastos pendientes sin marcar para guardar.')).toBeInTheDocument();
    expect(createExpenseWithDuplicateCheck).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
  }
});

test('guarda un pago importado en dólares como soles pagados con el tipo de cambio elegido', () => {
  expect(debitPaymentBody({ moneda: 'USD', monto: 100, fecha: '2026-10-05' }, '3.75')).toMatchObject({
    moneda: 'PEN', monto: 375, pagoObjetivo: 'USD', montoUsdAplicado: 100, tipoCambioDia: 3.75,
  });
  expect(debitPaymentBody({ moneda: 'PEN', monto: 375 }, '3.75')).toMatchObject({
    moneda: 'PEN', monto: 375, pagoObjetivo: 'USD', montoUsdAplicado: 100, tipoCambioDia: 3.75,
  });
});

test('compara pagos de débito entre dólares y soles solo cuando hay tipo de cambio', () => {
  const imported = [{ lineNumber: 1, body: { fecha: '2026-10-05', moneda: 'USD', monto: 100, metodoPago: 'debito', concepto: 'pago_tarjeta' } }];
  const saved = [{ id: 9, fecha: '2026-10-05', moneda: 'PEN', monto: 375, metodoPago: 'debito', concepto: 'pago_tarjeta', tarjeta: 'bcp', tarjetaPago: 'io' }];
  expect(compareBulkExpenses(imported, saved, 'io', 'debito').matched).toBe(0);
  expect(compareBulkExpenses(imported, saved, 'io', 'debito', { 1: '3.75' }).pairs[0].target.id).toBe(9);
  expect(compareBulkExpenses(imported, [{ ...saved[0], monto: 380, tasaUsdPen: '3.8', montoUsdAplicado: '100' }], 'io', 'debito').matched).toBe(1);
  expect(compareBulkExpenses(imported, [{ ...saved[0], tasaUsdPen: '3.75' }], 'io', 'debito').matched).toBe(1);
  expect(compareBulkExpenses(imported, [{ ...saved[0], tasaUsdPen: '3.8' }], 'io', 'debito', { 1: '3.75' }).matched).toBe(1);
  expect(compareBulkExpenses(imported, [{ ...saved[0], tasaUsdPen: '3.8', montoUsdAplicado: '100' }], 'io', 'debito').matched).toBe(0);
  const solesImported = [{ ...imported[0], body: { ...imported[0].body, moneda: 'PEN', monto: 375 } }];
  const dollarsSaved = [{ ...saved[0], moneda: 'USD', monto: 100 }];
  expect(compareBulkExpenses(solesImported, [{ ...dollarsSaved[0], tasaUsdPen: '3.75' }], 'io', 'debito').matched).toBe(1);
});

test('muestra el equivalente USD de un pago en soles del sistema y oculta TC si ya coincide', async () => {
  const originalFetch = global.fetch;
  const saved = { id: 9, fecha: '2026-10-05', moneda: 'PEN', monto: 375, tasaUsdPen: '3.75', metodoPago: 'debito', concepto: 'pago_tarjeta', tarjeta: 'bbva', tarjetaPago: 'io' };
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => String(url).includes('/cards') ? [{ type: 'io', label: 'iO' }] : [saved] }));
  try {
    render(<ModalGastoCreditoMasivo mode="debito" userId={1} onClose={jest.fn()} onSaved={jest.fn()} />);
    fireEvent.change(screen.getByLabelText('Líneas de pagos'), { target: { value: 'pago_tarjeta | USD | 100 | 05/10/2026 | Banco' } });
    expect(await screen.findByText(/Equivale a \$ 100\.00/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tipo de cambio línea 1' })).not.toBeInTheDocument();
    localStorage.setItem('token', 'test-token');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar masivo' }));
    expect(screen.getByText('No hay gastos pendientes sin marcar para guardar.')).toBeInTheDocument();
    expect(createExpenseWithDuplicateCheck).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
    localStorage.removeItem('token');
  }
});

test('lee consumos, omite pagos y conserva devoluciones del estado BCP', () => {
  const text = pdfLinesToBulkText([
    '24/07/26 23/08/26',
    '10Ago 07Ago PAYPAL *EBAY US 786762515 840 CONSUMO 22.60',
    '10Ago 07Ago PAGO BANCA MOVIL PAGO 1,072.00-',
    '31Jul 30Jul PAYPAL *EBAY US 786762515 840 DEVOLUCION 495.97-',
    '27Jul 25Jul CE / PEDIDOSYA PLUS MIRAFLORES 604 CONSUMO 10.14',
  ]);

  expect(text).toContain('inversion | USD | 22.6 | 07/08/2026');
  expect(text).toContain('cashback | USD | 495.97 | 30/07/2026');
  expect(text).toContain('comida | PEN | 10.14 | 25/07/2026');
  expect(text).not.toContain('1,072.00');
});

test('clasifica automáticamente comercios conocidos del PDF', () => {
  const text = pdfLinesToBulkText([
    '01/08/26 31/08/26',
    '05Ago 04Ago EVARISTO 604 CONSUMO 20.00',
    '06Ago 05Ago PVEA SUPERMERCADO 604 CONSUMO 30.00',
    '07Ago 06Ago AMAZON PRIME 840 CONSUMO 14.99',
    '08Ago 07Ago ALIGNET 604 CONSUMO 45.00',
    '09Ago 08Ago PAYPAL *EBAY US 840 CONSUMO 120.00',
    '10Ago 09Ago SP CENTEX LUXURY GOODS 840 CONSUMO 250.00',
    '11Ago 10Ago PAYPAL *EBAY US 840 DEVOLUCION 50.00-',
  ]);

  expect(text).toContain('comida | PEN | 20');
  expect(text).toContain('comida | PEN | 30');
  expect(text).toContain('gastos_recurrentes | USD | 14.99');
  expect(text).toContain('pago_envios | PEN | 45');
  expect(text).toContain('inversion | USD | 120');
  expect(text).toContain('inversion | USD | 250');
  expect(text).toContain('cashback | USD | 50');
});

test('clasifica Alignet y Eshopex como envíos, y cadenas de comida como comida', () => {
  const text = pdfLinesToBulkText([
    '01/09/26 30/09/26',
    '05Sep 04Sep ALIGNET*MALL ALIGNETPS LIMA PE 604 CONSUMO 42.00',
    '06Sep 05Sep Eshopex Peru Lince PE 604 CONSUMO 85.00',
    '07Sep 06Sep MCDONALDS MIRAFLORES 604 CONSUMO 28.00',
    '08Sep 07Sep OXXO SAN ISIDRO 604 CONSUMO 12.00',
    '09Sep 08Sep KFC LIMA 604 CONSUMO 35.00',
  ]);

  expect(text).toContain('pago_envios | PEN | 42 | 04/09/2026');
  expect(text).toContain('pago_envios | PEN | 85 | 05/09/2026');
  expect(text).toContain('comida | PEN | 28 | 06/09/2026');
  expect(text).toContain('comida | PEN | 12 | 07/09/2026');
  expect(text).toContain('comida | PEN | 35 | 08/09/2026');
});

test('clasifica plataformas de delivery como comida', () => {
  const text = pdfLinesToBulkText([
    '01/09/26 30/09/26',
    '05Sep 04Sep RAPPI PERU 604 CONSUMO 42.00',
    '06Sep 05Sep PEDIDOS YA PLUS 604 CONSUMO 18.90',
    '07Sep 06Sep UBER EATS 604 CONSUMO 31.50',
    '08Sep 07Sep DIDI FOOD 604 CONSUMO 22.00',
  ]);

  expect(text.split('\n')).toHaveLength(4);
  expect(text.split('\n').every((line) => line.startsWith('comida | PEN |'))).toBe(true);
});

test('clasifica RIDES y viajes Uber como transporte en PDF y texto masivo', () => {
  const text = pdfLinesToBulkText([
    'Ciclo de facturación: 26/08/2026 al 25/09/2026',
    'Consumos directos (Sin cuotas)',
    '27-AGO RIDES 12.90 [PEN]',
    '27-AGO UBER RIDES 19.70 [PEN]',
    '28-AGO UBER TRIP 8.50 [PEN]',
    '29-AGO UBER EATS 24.00 [PEN]',
  ]);
  const parsed = parseBulkRows([
    'gusto | PEN | 12.90 | 27/08/2026 | RIDES',
    'gusto | PEN | 19.70 | 27/08/2026 | UBER RIDES',
    'gusto | PEN | 8.50 | 28/08/2026 | UBER TRIP',
    'comida | PEN | 24.00 | 29/08/2026 | UBER EATS',
  ].join('\n'));

  expect(text.split('\n').map((line) => line.split(' | ')[0])).toEqual([
    'transporte', 'transporte', 'transporte', 'comida',
  ]);
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => row.body.concepto)).toEqual([
    'transporte', 'transporte', 'transporte', 'comida',
  ]);
});

test('prioriza la columna visual Dólares aunque el movimiento BCP no tenga código 840', () => {
  const text = pdfLinesToBulkText([
    '24/08/26 23/09/26',
    '14Set 11Set PAYPAL *IMEI CHECK 35314369001 GB CONSUMO 10.50 [USD]',
    '14Set 12Set Mol *SC CARBON PRO HQ S 40720659785 RO CONSUMO 5.25 [USD]',
    '13Set 13Set LARCO C4 LIMA PE CONSUMO 6.89 [PEN]',
  ]);

  expect(text).toContain('gusto | USD | 10.5 | 11/09/2026');
  expect(text).toContain('gusto | USD | 5.25 | 12/09/2026');
  expect(text).toContain('gusto | PEN | 6.89 | 13/09/2026');
});

test('ignora dirección, tarjeta enmascarada y periodo del encabezado', () => {
  const text = pdfLinesToBulkText([
    'AV.LOS GORRIONES N.288 MZ.B LT 377-89XX-XXXX-0962 24/07/26 23/08/26',
    '10Ago 07Ago PAYPAL *EBAY US 786762515 840 CONSUMO 22.60',
  ]);

  expect(text).not.toContain('GORRIONES');
  expect(text).not.toContain('962');
  expect(text.split('\n')).toHaveLength(1);
});

test('lee el CSV de Interbank, importa consumos negativos y omite pagos positivos', () => {
  const parsed = parseBulkRows([
    'Fecha,"Descripcion","Moneda","Monto"',
    '2026-09-25,"SEGURO DESGRAVAMEN","S/","-4.64"',
    '2026-09-24,"Vercel Pro","$","-20.00"',
    '2026-09-21,"PAGO TARJ WEB APP","$","57.86"',
  ].join('\n'));

  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0].body).toMatchObject({ fecha: '2026-09-25', moneda: 'PEN', monto: 4.64, concepto: 'desgravamen' });
  expect(parsed.rows[1].body).toMatchObject({ fecha: '2026-09-24', moneda: 'USD', monto: 20, notas: 'Vercel Pro' });
});

test('conserva fechas día/mes/año al cargar un CSV con movimientos de octubre', () => {
  const csv = [
    'Fecha,Descripción,Monto,Moneda,Estado',
    '03/10/2026,PEDIDOSYA FOOD,-87.2,PEN,EN PROCESO',
    '02/10/2026,PAGO DE TARJETA,140.0,USD,',
    '01/10/2026,UBER RIDES,-5.4,PEN,',
    '30/09/2026,UBER RIDES,-3.8,PEN,',
  ].join('\n');
  const lines = spreadsheetToBulkLines(Buffer.from(csv, 'utf8'), 'movimientos_sep_oct_2026_actualizado.csv');
  const parsed = parseBulkRows(lines.join('\n'));

  expect(parsed.errors).toEqual([]);
  expect(parsed.rows.map((row) => row.body.fecha)).toEqual([
    '2026-10-03', '2026-10-01', '2026-09-30',
  ]);
  expect(parsed.rows[1].body.concepto).toBe('transporte');
});

test('lee XLSX/CSV con columnas separadas de soles y dólares sin confundirlas', () => {
  const parsed = parseBulkRows([
    'Fecha,Descripcion,Soles,Dolares',
    '11/09/2026,PAYPAL IMEI CHECK,,10.50',
    '12/09/2026,LARCO C4,6.89,',
    '13/09/2026,PAGO TARJETA,-100.00,',
  ].join('\n'));

  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0].body).toMatchObject({ moneda: 'USD', monto: 10.5, notas: 'PAYPAL IMEI CHECK' });
  expect(parsed.rows[1].body).toMatchObject({ moneda: 'PEN', monto: 6.89, notas: 'LARCO C4' });
});

test('la marca de columna visual también corrige PDFs con fecha completa', () => {
  const text = pdfLinesToBulkText([
    '11/09/2026 PAYPAL IMEI CHECK US$ 10.50 [USD]',
    '12/09/2026 COMPRA LOCAL S/ 6.89 [PEN]',
  ]);

  expect(text).toContain('gusto | USD | 10.5 | 11/09/2026');
  expect(text).toContain('gusto | PEN | 6.89 | 12/09/2026');
});

test('lee Últimos movimientos, usa consumos positivos y omite pagos y exceso de línea', () => {
  const parsed = parseBulkRows([
    'Últimos movimientos\t\t',
    'FECHA\tDESCRIPCIÓN\tMONTO',
    '23/09/2026\tB81 TX VERIFY\tUS$ 2.50',
    '24/08/2026\tBM. PAGO TARJETA DE CRED.\tS/ -2.26',
    '07/08/2026\t*** EXCESO LINEA ***\tS/ -77.58',
    '06/08/2026\tOPENAI *CHATGPT SUBSCR\tUS$ 23.60',
  ].join('\n'));

  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows.map((row) => row.body.monto)).toEqual([2.5, 23.6]);
  expect(parsed.rows.every((row) => row.body.moneda === 'USD')).toBe(true);
});

test('compara tarjeta sin distinguir mayúsculas y montos guardados con signo', () => {
  const imported = [{ lineNumber: 1, body: { fecha: '2026-09-25', moneda: 'PEN', monto: 4.64, metodoPago: 'credito', notas: 'Seguro' } }];
  const saved = [{ id: 9, fecha: '2026-09-25', moneda: 'PEN', monto: '-4.64', metodoPago: 'credito', tarjeta: 'interbank', notas: 'Seguro' }];
  const comparison = compareBulkExpenses(imported, saved, 'Interbank');

  expect(comparison.matched).toBe(1);
  expect(comparison.missing).toEqual([]);
});

test('Interbank considera coincidencia si la fecha difiere hasta un día', () => {
  const imported = [
    { lineNumber: 1, body: { fecha: '2026-06-28', moneda: 'USD', monto: 35.68, metodoPago: 'credito', notas: 'Temu' } },
    { lineNumber: 2, body: { fecha: '2026-07-06', moneda: 'PEN', monto: 53.03, metodoPago: 'credito', notas: 'Eshopex' } },
  ];
  const saved = [
    { id: 10, fecha: '2026-06-29', moneda: 'USD', monto: '35.68', metodoPago: 'credito', tarjeta: 'interbank' },
    { id: 11, fecha: '2026-07-07', moneda: 'PEN', monto: '53.03', metodoPago: 'credito', tarjeta: 'interbank' },
  ];

  const comparison = compareBulkExpenses(imported, saved, 'interbank');
  expect(comparison.matched).toBe(2);
  expect(comparison.missing).toEqual([]);
});

test('prioriza fecha exacta sobre la coincidencia de un día contiguo', () => {
  const imported = [{ lineNumber: 1, body: { fecha: '2026-07-07', moneda: 'PEN', monto: 53.03, metodoPago: 'credito' } }];
  const saved = [
    { id: 10, fecha: '2026-07-06', moneda: 'PEN', monto: '53.03', metodoPago: 'credito', tarjeta: 'interbank' },
    { id: 11, fecha: '2026-07-07', moneda: 'PEN', monto: '53.03', metodoPago: 'credito', tarjeta: 'interbank' },
  ];

  expect(compareBulkExpenses(imported, saved, 'interbank').pairs[0].target.id).toBe(11);
});

test('omite cualquier fila BBVA que diga pago o exceso, pero conserva desgravamen', () => {
  const parsed = parseBulkRows([
    'FECHA\tDESCRIPCIÓN\tMONTO',
    '18/09/2026\tSEGURO DE DESGRAVAMEN\tS/ 0.11',
    '17/09/2026\tPAGO CUENTA\tS/ -100.00',
    '16/09/2026\tEXCESO LINEA\tS/ -20.00',
    '15/09/2026\tPHANTOM\tS/ 59.49',
  ].join('\n'));

  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows.map((row) => row.body.concepto)).toEqual(['desgravamen', 'gusto']);
});

test('lee consumos iO y registra devoluciones como cashback, omitiendo pagos', () => {
  const text = pdfLinesToBulkText([
    'Ciclo de facturación: 26/08/2026 al 25/09/2026',
    'Abonos',
    '30-AGO PAGO DE TARJETA iO - BANCA MÓVIL 324.59 [PEN]',
    '16-SEP DEVOLUCIÓN DE COMPRA -EBAY US 492.00 [USD]',
    'Consumos directos (Sin cuotas)',
    '26-AGO OXXO CRONOS 23.70 [PEN]',
    '17-SEP ELECTRONIC ARTS 16.99 [USD]',
  ]);

  expect(text).toContain('comida | PEN | 23.7 | 26/08/2026 | OXXO CRONOS');
  expect(text).toContain('gusto | USD | 16.99 | 17/09/2026 | ELECTRONIC ARTS');
  expect(text).toContain('cashback | USD | 492 | 16/09/2026');
  expect(text).not.toContain('PAGO DE TARJETA');
});

test('importa en débito solo pagos a tarjeta desde PDF y CSV', () => {
  const pdf = pdfLinesToBulkText([
    '24/07/26 23/08/26',
    '10Ago 07Ago PAGO BANCA MOVIL PAGO 1,072.00-',
    '10Ago 07Ago TIENDA CONSUMO 22.60',
    '31Jul 30Jul TIENDA DEVOLUCION 50.00-',
  ], 'debito');
  const csv = [
    'Fecha,Descripcion,Moneda,Monto',
    '03/10/2026,PAGO TARJ WEB APP,USD,57.86',
    '02/10/2026,TIENDA,PEN,-20.00',
    '01/10/2026,DEVOLUCION,PEN,10.00',
  ].join('\n');
  const parsed = parseBulkRows(csv, 'debito');

  expect(pdf).toContain('pago_tarjeta | PEN | 1072 | 07/08/2026');
  expect(pdf).not.toContain('22.6');
  expect(pdf).not.toContain('50');
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0].body).toMatchObject({ concepto: 'pago_tarjeta', metodoPago: 'debito', moneda: 'USD', monto: 57.86 });
});

test('fuerza las devoluciones de crédito a cashback aunque la línea diga gusto', () => {
  const parsed = parseBulkRows('gusto | PEN | 35 | 04/10/2026 | Devolución compra', 'credito');
  expect(parsed.errors).toEqual([]);
  expect(parsed.rows[0].body.concepto).toBe('cashback');
});

test('incluye pagos iO en débito y busca la tarjeta pagada en todos los bancos', () => {
  const text = pdfLinesToBulkText([
    'Ciclo: 26/08/2026 al 25/09/2026',
    'Abonos',
    '30-AGO PAGO DE TARJETA iO - BANCA MOVIL 324.59 [PEN]',
    '16-SEP DEVOLUCION DE COMPRA -EBAY US 492.00 [USD]',
  ], 'debito');
  const imported = parseBulkRows(text, 'debito').rows;
  const saved = [
    { id: 1, fecha: '2026-08-30', moneda: 'PEN', monto: 324.59, metodoPago: 'debito', concepto: 'pago_tarjeta', tarjeta: 'bcp', tarjetaPago: 'io' },
    { id: 2, fecha: '2026-08-30', moneda: 'PEN', monto: 324.59, metodoPago: 'debito', concepto: 'pago_tarjeta', tarjeta: 'bbva', tarjetaPago: 'io' },
  ];

  expect(imported).toHaveLength(1);
  expect(imported[0].body.concepto).toBe('pago_tarjeta');
  expect(compareBulkExpenses(imported, saved, 'io', 'debito').candidates).toHaveLength(2);
  expect(compareBulkExpenses(imported, [saved[1]], 'io', 'debito').pairs[0].target.id).toBe(2);
});

test('lee Banco Falabella y omite pagos aunque su monto sea negativo', () => {
  const text = pdfLinesToBulkText([
    'Último día de pago 15/10/2026',
    '19/08/2026 20/08/2026 Compra El Brasero Peru 44.00',
    '21/08/2026 21/08/2026 Pago Mobile Peru -100.00',
    '20/08/2026 21/08/2026 Compra Eshopex Peru Peru 133.59',
    '19/09/2026 19/09/2026 Seguro Desgravamen 13.90',
  ]);

  expect(text).toContain('gusto | PEN | 44 | 19/08/2026 | Compra El Brasero Peru');
  expect(text).toContain('pago_envios | PEN | 133.59 | 20/08/2026');
  expect(text).toContain('desgravamen | PEN | 13.9 | 19/09/2026');
  expect(text).not.toContain('Pago Mobile');
});

test('no repite en la tabla un gasto del sistema emparejado con el día anterior', () => {
  const imported = [
    { lineNumber: 1, body: { fecha: '2026-07-12', moneda: 'PEN', monto: 11.90, metodoPago: 'credito', notas: 'Spotify' } },
    { lineNumber: 2, body: { fecha: '2026-07-13', moneda: 'USD', monto: 20.84, metodoPago: 'credito', notas: 'Disney Plus' } },
  ];
  const spotify = { id: 20, fecha: '2026-07-13', moneda: 'PEN', monto: '11.90', metodoPago: 'credito', tarjeta: 'interbank', notas: 'Spotify' };
  const disney = { id: 21, fecha: '2026-07-14', moneda: 'USD', monto: '20.84', metodoPago: 'credito', tarjeta: 'interbank', notas: 'Disney Plus' };

  const comparison = compareBulkExpenses(imported, [spotify, disney], 'interbank');
  const spotifyAppearances = comparison.displayRows.filter((row) => row.saved?.id === spotify.id);

  expect(comparison.matched).toBe(2);
  expect(spotifyAppearances).toHaveLength(1);
  expect(spotifyAppearances[0].matched).toBe(true);
});
