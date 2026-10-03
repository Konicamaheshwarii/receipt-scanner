import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Clock, newId } from './clock';
import { DEMO_BUDGETS, generateHistory } from './demo/history';
import { RestoreResult } from './export';
import { Budgets, Category, Expense, ReceiptDraft } from './models';
import { round2 } from './parse';
import { hasKey, readJson, writeJson } from './storage';

const EXPENSES = 'receipto.expenses';
const BUDGETS = 'receipto.budgets';

const byDateDesc = (a: Expense, b: Expense) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);

/** All saved expenses and budgets, persisted to localStorage. */
@Injectable({ providedIn: 'root' })
export class ExpenseStore {
  private readonly clock = inject(Clock);
  private readonly state = signal<Expense[]>([]);
  private readonly budgetState = signal<Budgets>({});
  private readonly deleted = signal<{ expense: Expense; index: number } | null>(null);

  readonly expenses = computed(() => [...this.state()].sort(byDateDesc));
  readonly budgets = this.budgetState.asReadonly();
  readonly lastDeleted = computed(() => this.deleted()?.expense ?? null);
  /** Set when the browser refused to save (storage full or blocked). */
  readonly saveError = signal(false);

  constructor() {
    if (!hasKey(EXPENSES)) {
      // First visit: show a lived-in dashboard straight away.
      this.state.set(generateHistory(this.clock.now()));
      this.budgetState.set(DEMO_BUDGETS);
    } else {
      this.state.set(readJson<Expense[]>(EXPENSES, []));
      this.budgetState.set(readJson<Budgets>(BUDGETS, {}));
    }
    effect(() => this.saveError.set(!writeJson(EXPENSES, this.state())));
    effect(() => writeJson(BUDGETS, this.budgetState()));
  }

  get(id: string): Expense | undefined {
    return this.state().find((e) => e.id === id);
  }

  add(draft: ReceiptDraft, meta: Pick<Expense, 'source'> & { thumbnail?: string }): Expense {
    const expense: Expense = { ...clean(draft), id: newId(), source: meta.source, thumbnail: meta.thumbnail, createdAt: this.clock.now().toISOString() };
    this.state.update((list) => [...list, expense]);
    return expense;
  }

  update(id: string, draft: ReceiptDraft): void {
    this.state.update((list) => list.map((e) => (e.id === id ? { ...e, ...clean(draft) } : e)));
  }

  remove(id: string): void {
    const list = this.state();
    const index = list.findIndex((e) => e.id === id);
    if (index < 0) return;
    this.deleted.set({ expense: list[index], index });
    this.state.set(list.filter((e) => e.id !== id));
  }

  undoDelete(): void {
    const d = this.deleted();
    if (!d) return;
    this.state.update((list) => [...list.slice(0, d.index), d.expense, ...list.slice(d.index)]);
    this.deleted.set(null);
  }

  dismissUndo(): void {
    this.deleted.set(null);
  }

  setBudget(category: Category, amount: number | null): void {
    this.budgetState.update((b) => {
      const next = { ...b };
      if (amount && amount > 0) next[category] = round2(amount);
      else delete next[category];
      return next;
    });
  }

  /** Merges a backup: entries with the same id are replaced, new ones added. */
  restore(backup: RestoreResult): { added: number; replaced: number } {
    const current = new Map(this.state().map((e) => [e.id, e]));
    let replaced = 0;
    for (const e of backup.expenses) {
      if (current.has(e.id)) replaced++;
      current.set(e.id, e);
    }
    this.state.set([...current.values()]);
    if (Object.keys(backup.budgets).length) this.budgetState.set(backup.budgets);
    return { added: backup.expenses.length - replaced, replaced };
  }

  loadDemo(): void {
    const keep = this.state().filter((e) => e.source !== 'demo');
    this.state.set([...keep, ...generateHistory(this.clock.now())]);
    this.budgetState.set({ ...DEMO_BUDGETS, ...this.budgetState() });
  }

  clearAll(): void {
    this.state.set([]);
    this.budgetState.set({});
    this.deleted.set(null);
  }
}

/** Trims text, drops blank item rows and rounds money before saving. */
function clean(d: ReceiptDraft): ReceiptDraft {
  const money = (n: number | null) => (n === null || !Number.isFinite(n) ? null : round2(n));
  return {
    ...d,
    merchant: d.merchant.trim() || 'Unknown merchant',
    notes: d.notes.trim(),
    items: d.items
      .filter((i) => i.name.trim() || i.price)
      .map((i) => ({ name: i.name.trim() || 'Item', qty: i.qty > 0 ? i.qty : 1, price: round2(i.price || 0) })),
    subtotal: money(d.subtotal),
    tax: money(d.tax),
    tip: money(d.tip),
    total: round2(Math.abs(d.total || 0)),
  };
}
