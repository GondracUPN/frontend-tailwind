import { normalizeProductLookupUrl } from './productUrl';

test.each([
  ['407005447316', 'https://www.ebay.com/itm/407005447316'],
  ['www.ebay.com/itm/407005447316', 'https://www.ebay.com/itm/407005447316'],
  ['ebay.com/itm/407005447316', 'https://ebay.com/itm/407005447316'],
  ['//www.ebay.com/itm/407005447316', 'https://www.ebay.com/itm/407005447316'],
  ['https://www.ebay.com/itm/407005447316', 'https://www.ebay.com/itm/407005447316'],
])('normaliza el enlace de producto %s', (input, expected) => {
  expect(normalizeProductLookupUrl(input)).toBe(expected);
});
