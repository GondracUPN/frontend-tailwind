jest.mock('pdfjs-dist/webpack', () => ({}));

import { compareBulkExpenses, parseBulkRows, pdfLinesToBulkText } from './ModalGastoCreditoMasivo';

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
  expect(text).toContain('gusto | PEN | 10.14 | 25/07/2026');
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
