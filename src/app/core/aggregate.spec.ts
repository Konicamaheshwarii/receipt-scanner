import { byCategory, dailySeries, monthTotalUntil, monthlySeries, monthsWithData, shiftMonth, topMerchants } from './aggregate';
import { expense } from './testing';

describe('aggregations', () => {
  const list = [
    expense('2026-09-01', 40, 'groceries', 'Green Basket'),
    expense('2026-09-01', 4.5, 'dining', 'Brew & Bean'),
    expense('2026-09-15', 60, 'groceries', 'green  basket '),
    expense('2026-09-30', 15.5, 'dining', 'Taco Loco'),
    expense('2026-08-20', 100, 'bills', 'FiberNet'),
    expense('2025-12-31', 10, 'other'),
  ];

  it('shifts months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
    expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  });

  it('totals by category, biggest first, with shares that add up to 1', () => {
    const cats = byCategory(list.filter((e) => e.date.startsWith('2026-09')));
    expect(cats.map((c) => c.category)).toEqual(['groceries', 'dining']);
    expect(cats[0]).toEqual(jasmine.objectContaining({ total: 100, count: 2 }));
    expect(cats[1].total).toBe(20);
    expect(cats.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 10);
    expect(byCategory([])).toEqual([]);
  });

  it('builds a zero-filled daily series for every day of the month', () => {
    const days = dailySeries(list, '2026-09');
    expect(days.length).toBe(30);
    expect(days[0]).toEqual({ key: '2026-09-01', label: '1', total: 44.5 });
    expect(days[1].total).toBe(0);
    expect(days[29].total).toBe(15.5);
    expect(dailySeries([], '2028-02').length).toBe(29); // leap year
  });

  it('builds monthly totals oldest-first, including empty months', () => {
    const months = monthlySeries(list, '2026-09', 3);
    expect(months.map((m) => m.key)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months.map((m) => m.total)).toEqual([0, 100, 120]);
    expect(months[2].label).toBe('Sep');
  });

  it('groups merchants case- and space-insensitively and ranks by spend', () => {
    const top = topMerchants(list, 2);
    expect(top).toEqual([
      { merchant: 'FiberNet', total: 100, count: 1 },
      { merchant: 'Green Basket', total: 100, count: 2 },
    ]);
  });

  it('totals a month up to a given day for like-for-like comparisons', () => {
    expect(monthTotalUntil(list, '2026-09', 15)).toBe(104.5);
    expect(monthTotalUntil(list, '2026-09', 31)).toBe(120);
  });

  it('lists months that have data, newest first', () => {
    expect(monthsWithData(list)).toEqual(['2026-09', '2026-08', '2025-12']);
  });
});
