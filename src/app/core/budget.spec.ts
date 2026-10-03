import { expense } from './testing';
import { budgetStatus, categoryBudgets, monthProgress, sanitizeBudgets, totalBudget } from './budget';

describe('budgets', () => {
  it('measures progress through the month', () => {
    expect(monthProgress('2026-09', '2026-10-02')).toBe(1);
    expect(monthProgress('2026-11', '2026-10-02')).toBe(0);
    expect(monthProgress('2026-09', '2026-09-15')).toBe(0.5);
  });

  it('classifies spend as ok, warn (85% or bad pace) and over', () => {
    expect(budgetStatus(100, 400, 0.5)).toEqual(jasmine.objectContaining({ state: 'ok', remaining: 300, projected: 200, ratio: 0.25 }));
    expect(budgetStatus(250, 400, 0.5).state).toBe('warn'); // on pace for 500
    expect(budgetStatus(60, 400, 0.1).state).toBe('ok'); // pace ignored in the first days of a month
    expect(budgetStatus(345, 400, 1).state).toBe('warn'); // 86% used
    expect(budgetStatus(401, 400, 1)).toEqual(jasmine.objectContaining({ state: 'over', remaining: -1 }));
    expect(budgetStatus(50, undefined, 0.5)).toEqual(jasmine.objectContaining({ state: 'none', budget: 0, ratio: 0 }));
    expect(budgetStatus(50, 100, 0).projected).toBe(50); // future month: no extrapolation
  });

  it('builds per-category rows for budgeted or spent categories only', () => {
    const list = [expense('2026-09-03', 120, 'dining'), expense('2026-09-10', 30, 'health'), expense('2026-08-10', 999, 'travel')];
    const rows = categoryBudgets(list, { groceries: 400, dining: 100 }, '2026-09', '2026-09-30');
    expect(rows.map((r) => [r.category, r.state])).toEqual([['groceries', 'ok'], ['dining', 'over'], ['health', 'none']]);
    expect(rows[1].spent).toBe(120);
  });

  it('sums and sanitises budgets', () => {
    expect(totalBudget({ groceries: 400.5, dining: 99.5 })).toBe(500);
    expect(sanitizeBudgets({ groceries: '300', dining: -5, unknown: 50, health: 'abc', bills: 120.456 }))
      .toEqual({ groceries: 300, bills: 120.46 });
    expect(sanitizeBudgets(null)).toEqual({});
  });
});
