jest.mock('pdfjs-dist/webpack', () => ({}));

import { pdfLinesToBulkText } from './ModalGastoCreditoMasivo';

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

test('ignora dirección, tarjeta enmascarada y periodo del encabezado', () => {
  const text = pdfLinesToBulkText([
    'AV.LOS GORRIONES N.288 MZ.B LT 377-89XX-XXXX-0962 24/07/26 23/08/26',
    '10Ago 07Ago PAYPAL *EBAY US 786762515 840 CONSUMO 22.60',
  ]);

  expect(text).not.toContain('GORRIONES');
  expect(text).not.toContain('962');
  expect(text.split('\n')).toHaveLength(1);
});
