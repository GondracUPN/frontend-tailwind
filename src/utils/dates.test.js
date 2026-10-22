import { addMonthsToDateInput } from './dates';

test('ajusta al fin de mes sin omitir febrero', () => {
  expect(addMonthsToDateInput('2026-01-31', 1)).toBe('2026-02-28');
  expect(addMonthsToDateInput('2026-01-31', 2)).toBe('2026-03-31');
  expect(addMonthsToDateInput('2028-01-31', 1)).toBe('2028-02-29');
});
