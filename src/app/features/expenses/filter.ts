import { Category, Expense } from '../../core/models';
import { monthOf } from '../../core/aggregate';

export type SortKey = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'merchant';

export interface ExpenseQuery {
  search: string;
  category: Category | '';
  month: string;
  sort: SortKey;
}

/** Search matches merchant, item names and notes; all words must match. */
export function filterExpenses(list: Expense[], q: ExpenseQuery): Expense[] {
  const words = q.search.toLowerCase().split(/\s+/).filter(Boolean);
  const out = list.filter((e) => {
    if (q.category && e.category !== q.category) return false;
    if (q.month && monthOf(e.date) !== q.month) return false;
    if (!words.length) return true;
    const hay = `${e.merchant} ${e.notes} ${e.items.map((i) => i.name).join(' ')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
  const cmp: Record<SortKey, (a: Expense, b: Expense) => number> = {
    'date-desc': (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    'date-asc': (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
    'amount-desc': (a, b) => b.total - a.total,
    'amount-asc': (a, b) => a.total - b.total,
    merchant: (a, b) => a.merchant.localeCompare(b.merchant) || b.date.localeCompare(a.date),
  };
  return out.sort(cmp[q.sort]);
}
