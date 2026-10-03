import { CATEGORIES, Category, Expense } from './models';
import { round2 } from './parse';

/** 'YYYY-MM' of an ISO date. */
export const monthOf = (date: string) => date.slice(0, 7);

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', style === 'long'
    ? { month: 'long', year: 'numeric' } : { month: 'short' });
}

const sum = (list: Expense[]) => round2(list.reduce((s, e) => s + e.total, 0));

export function inMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((e) => monthOf(e.date) === month);
}

export function monthTotal(expenses: Expense[], month: string): number {
  return sum(inMonth(expenses, month));
}

/** Spend in `month` up to and including day `day` (for like-for-like month comparisons). */
export function monthTotalUntil(expenses: Expense[], month: string, day: number): number {
  return sum(inMonth(expenses, month).filter((e) => Number(e.date.slice(8, 10)) <= day));
}

export interface CategoryTotal { category: Category; total: number; count: number; share: number }

/** Spend per category, largest first, empty categories left out. Shares add up to 1. */
export function byCategory(expenses: Expense[]): CategoryTotal[] {
  const grand = sum(expenses);
  return CATEGORIES
    .map((category) => {
      const list = expenses.filter((e) => e.category === category);
      const total = sum(list);
      return { category, total, count: list.length, share: grand ? total / grand : 0 };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.total - a.total);
}

export interface Point { key: string; label: string; total: number }

/** One point per calendar day of the month, zero-filled. */
export function dailySeries(expenses: Expense[], month: string): Point[] {
  const totals = new Map<number, number>();
  for (const e of inMonth(expenses, month)) {
    const day = Number(e.date.slice(8, 10));
    totals.set(day, (totals.get(day) ?? 0) + e.total);
  }
  return Array.from({ length: daysInMonth(month) }, (_, i) => ({
    key: `${month}-${String(i + 1).padStart(2, '0')}`,
    label: String(i + 1),
    total: round2(totals.get(i + 1) ?? 0),
  }));
}

/** Totals for the `count` months ending with `endMonth`, oldest first. */
export function monthlySeries(expenses: Expense[], endMonth: string, count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const month = shiftMonth(endMonth, i - count + 1);
    return { key: month, label: monthLabel(month, 'short'), total: monthTotal(expenses, month) };
  });
}

export interface MerchantTotal { merchant: string; total: number; count: number }

/** Biggest merchants by spend. Names are grouped case- and whitespace-insensitively. */
export function topMerchants(expenses: Expense[], limit = 5): MerchantTotal[] {
  const groups = new Map<string, MerchantTotal>();
  for (const e of expenses) {
    const key = e.merchant.trim().toLowerCase().replace(/\s+/g, ' ') || '(unknown)';
    const g = groups.get(key) ?? { merchant: e.merchant.trim() || 'Unknown merchant', total: 0, count: 0 };
    g.total = round2(g.total + e.total);
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.total - a.total || a.merchant.localeCompare(b.merchant)).slice(0, limit);
}

/** Months that have at least one expense, newest first. */
export function monthsWithData(expenses: Expense[]): string[] {
  return [...new Set(expenses.map((e) => monthOf(e.date)))].sort().reverse();
}
