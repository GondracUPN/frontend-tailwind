const pad2 = (value) => String(value).padStart(2, '0');

export const localDateInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const localMonthInputValue = (date = new Date()) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

export const parseDateInputValue = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
};

export const addMonthsToDateInput = (value, months) => {
  const date = parseDateInputValue(value);
  if (!date) return '';
  const day = date.getDate();
  const result = new Date(date.getFullYear(), date.getMonth() + months, day);
  return localDateInputValue(result);
};
