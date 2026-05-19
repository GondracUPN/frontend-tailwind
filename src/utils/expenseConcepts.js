export const EXPENSE_CATEGORY_OPTIONS = [
  { value: 'life', label: 'Gasto de vida' },
  { value: 'income', label: 'Ingreso' },
  { value: 'investment', label: 'Inversion / bolsa' },
  { value: 'shipping', label: 'Envios' },
  { value: 'debt', label: 'Deuda / cuotas' },
  { value: 'card_payment', label: 'Pago de tarjeta' },
  { value: 'other', label: 'Otro' },
];

export const normalizeExpenseConcept = (concept) =>
  String(concept || '').trim().toLowerCase().replace(/\s+/g, '_');

export const normalizeExpenseCategory = (category) => {
  const value = String(category || '').trim().toLowerCase();
  return EXPENSE_CATEGORY_OPTIONS.some((item) => item.value === value) ? value : 'life';
};

export const buildExpenseConceptCategoryMap = (items) => {
  const map = {};
  (Array.isArray(items) ? items : []).forEach((item) => {
    const key = normalizeExpenseConcept(item?.value);
    if (!key) return;
    map[key] = normalizeExpenseCategory(item?.metadata?.category);
  });
  return map;
};

export const getExpenseConceptCategory = (concept, categories = {}) => {
  const n = normalizeExpenseConcept(concept);
  if (!n) return 'life';
  if (categories[n]) return normalizeExpenseCategory(categories[n]);
  if (n === 'ingreso' || n === 'cashback') return 'income';
  if (n === 'inversion' || n === 'bolsa') return 'investment';
  if (n === 'pago_envios') return 'shipping';
  if (n === 'deuda_cuotas') return 'debt';
  if (n === 'pago_tarjeta') return 'card_payment';
  return 'life';
};

export const isIncomeExpenseConcept = (concept, categories = {}) =>
  getExpenseConceptCategory(concept, categories) === 'income';

export const isLifeExpenseConcept = (concept, categories = {}) =>
  getExpenseConceptCategory(concept, categories) === 'life';

export const isInvestmentExpenseConcept = (concept, categories = {}) =>
  getExpenseConceptCategory(concept, categories) === 'investment';

export const isCardPaymentExpenseConcept = (concept, categories = {}) =>
  getExpenseConceptCategory(concept, categories) === 'card_payment';
