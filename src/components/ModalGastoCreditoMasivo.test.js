jest.mock('pdfjs-dist/webpack', () => ({}));

import { compareBulkExpenses, parseBulkRows, pdfLinesToBulkText, spreadsheetToBulkLines } from './ModalGastoCreditoMasivo';

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

test('lee consumos iO por sección y columna de moneda, y omite abonos', () => {
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
  expect(text).not.toContain('PAGO DE TARJETA');
  expect(text).not.toContain('492');
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
