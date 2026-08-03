import { getProgressiveAuctionVisibleCount } from './Ebay';

test('no publica subastas hasta poder garantizar el orden global', () => {
  expect(getProgressiveAuctionVisibleCount(0, false)).toBe(0);
  expect(getProgressiveAuctionVisibleCount(13, false)).toBe(0);
  expect(getProgressiveAuctionVisibleCount(14, false)).toBe(0);
  expect(getProgressiveAuctionVisibleCount(28, false)).toBe(0);
  expect(getProgressiveAuctionVisibleCount(57, false)).toBe(0);
});

test('al terminar muestra el remanente y respeta el limite original', () => {
  expect(getProgressiveAuctionVisibleCount(13, true)).toBe(13);
  expect(getProgressiveAuctionVisibleCount(57, true)).toBe(57);
  expect(getProgressiveAuctionVisibleCount(180, true)).toBe(140);
});
