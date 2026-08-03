import { cardTypeFromProduct, parseBankAmount, parseBankOperation } from './bankOperationParser';

const SAMPLE = `Realizaste un pago a tu tarjeta de **S/ 400.00** desde tu **Cuenta digital**.

Monto pagado **S/ 400.00**
Operación realizada **Pago de tarjeta propia BCP**
Fecha y hora **30 de Julio de 2026 - 09:22 PM**
Pagado a **AMEX Black LATAM Pass**
**** 0962
Tipo de pago **Otro**
Desde **Cuenta digital**
**** 5091
Moneda **Soles**
Canal **Banca Móvil BCP**
Número de operación **06912552**`;

test('parses a BCP own-card payment email', () => {
  expect(parseBankOperation(SAMPLE)).toEqual({
    ok: true,
    operation: {
      kind: 'card_payment',
      amount: 400,
      currency: 'PEN',
      chargedAmount: 400,
      chargedCurrency: 'PEN',
      exchangeRate: null,
      date: '2026-07-30',
      cardType: 'bcp_amex',
      productName: 'AMEX Black LATAM Pass',
      cardLast4: '0962',
      sourceBank: 'bcp',
      sourceLast4: '5091',
      operationNumber: '06912552',
    },
  });
});

test('separates USD paid, PEN charged and the bank exchange rate', () => {
  const email = `Realizaste un pago a tu tarjeta de **$ 280.00** desde tu **Cuenta digital**.
Monto pagado **$ 280.00**
Tipo de cambio **S/ 3.4220**
**Total cobrado al tipo de cambio** **S/ 958.16**
Operación realizada **Pago de tarjeta propia BCP**
Fecha y hora **27 de Julio de 2026 - 06:55 PM**
Pagado a **AMEX Black LATAM Pass**
**** 0962
Desde **Cuenta digital**
**** 5091
Moneda **Soles**
Número de operación [**05301023**](https://mail.google.com/example)`;

  const result = parseBankOperation(email);
  expect(result.ok).toBe(true);
  expect(result.operation).toMatchObject({
    amount: 280,
    currency: 'USD',
    chargedAmount: 958.16,
    chargedCurrency: 'PEN',
    exchangeRate: 3.422,
    date: '2026-07-27',
    cardType: 'bcp_amex',
    operationNumber: '05301023',
  });
});

test('maps the two similar Visa products to different cards', () => {
  expect(cardTypeFromProduct('Visa Qore')).toBe('visa_qore');
  expect(cardTypeFromProduct('Visa Sapphire')).toBe('bcp_visa');
});

test('supports bank amount separators', () => {
  expect(parseBankAmount('1,234.56')).toBe(1234.56);
  expect(parseBankAmount('1.234,56')).toBe(1234.56);
});
