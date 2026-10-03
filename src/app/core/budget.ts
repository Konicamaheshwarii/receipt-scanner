import { CATEGORIES, Budgets, Category, Expense } from './models';
import { daysInMonth, inMonth } from './aggregate';
import { round2 } from './parse';

export type BudgetState = 'none' | 'ok' | 'warn' | 'over';

export interface BudgetStatus {
  spent: number;
  budget: number;
  remaining: number;
  /** spent / budget, 0 when there is no budget. */
  ratio: number;
  /** Month-end estimate at the current pace. */
  projected: number;
  state: BudgetState;
}

/** How far through `month` we are on `today`: 0 before it starts, 1 once it has ended. */
export function monthProgress(month: string, today: string): number {
  const current = today.slice(0, 7);
  if (month < current) return 1;
  if (month > current) return 0;
  return Number(today.slice(8, 10)) / daysInMonth(month);
}

/**
 * Compares spend with a budget. "warn" means either 85% is used or the current
 * pace will overshoot by month end; "over" means it already has.
 */
export function budgetStatus(spent: number, budget: number | undefined, progress: number): BudgetStatus {
  const b = budget && budget > 0 ? budget : 0;
  const projected = round2(progress > 0 && progress < 1 ? spent / progress : spent);
  const ratio = b ? spent / b : 0;
  const state: BudgetState = !b ? 'none' : spent > b ? 'over' : ratio >= 0.85 || projected > b ? 'warn' : 'ok';
  return { spent: round2(spent), budget: b, remaining: round2(b - spent), ratio, projected, state };
}

export interface CategoryBudget extends BudgetStatus { category: Category }

/** One row per category that has a budget or any spend this month, in the fixed category order. */
export function categoryBudgets(expenses: Expense[], budgets: Budgets, month: string, today: string): CategoryBudget[] {
  const progress = monthProgress(month, today);
  const list = inMonth(expenses, month);
  return CATEGORIES
    .map((category) => ({
      category,
      ...budgetStatus(list.filter((e) => e.category === category).reduce((s, e) => s + e.total, 0), budgets[category], progress),
    }))
    .filter((r) => r.budget > 0 || r.spent > 0);
}

export function totalBudget(budgets: Budgets): number {
  return round2(Object.values(budgets).reduce((s: number, v) => s + (v && v > 0 ? v : 0), 0));
}

/** Keeps only positive, finite budgets for known categories. */
export function sanitizeBudgets(input: unknown): Budgets {
  const out: Budgets = {};
  if (!input || typeof input !== 'object') return out;
  for (const c of CATEGORIES) {
    const v = Number((input as Record<string, unknown>)[c]);
    if (Number.isFinite(v) && v > 0) out[c] = round2(v);
  }
  return out;
}
