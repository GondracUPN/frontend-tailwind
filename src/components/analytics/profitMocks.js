export function mockRows(groupBy) {
  if (groupBy === 'day') {
    return [
      { period: '2025-11-01', income: 1200, cost: 900, profit: 300, margin: 25 },
      { period: '2025-11-02', income: 0, cost: 0, profit: 0, margin: 0 },
      { period: '2025-11-03', income: 800, cost: 500, profit: 300, margin: 37.5 },
    ];
  }
  if (groupBy === 'year') {
    return [
      { period: '2024', income: 52000, cost: 39000, profit: 13000, margin: 25 },
      { period: '2025', income: 68000, cost: 51000, profit: 17000, margin: 25 },
    ];
  }
  return [
    { period: '2025-09', income: 9000, cost: 7100, profit: 1900, margin: 21.11 },
    { period: '2025-10', income: 12000, cost: 8600, profit: 3400, margin: 28.33 },
    { period: '2025-11', income: 15000, cost: 10800, profit: 4200, margin: 28 },
  ];
}
