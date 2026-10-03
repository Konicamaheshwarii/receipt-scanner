import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { monthLabel, monthsWithData } from '../../core/aggregate';
import { ExpenseStore } from '../../core/expense.store';
import { download, toCsv } from '../../core/export';
import { CATEGORIES, CATEGORY_LABELS, Category, PAYMENT_LABELS } from '../../core/models';
import { round2 } from '../../core/parse';
import { MoneyPipe } from '../../shared/money.pipe';
import { ExpenseQuery, SortKey, filterExpenses } from './filter';

@Component({
  selector: 'app-expenses',
  imports: [RouterLink, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage {
  protected readonly store = inject(ExpenseStore);

  protected readonly categories = CATEGORIES;
  protected readonly labels = CATEGORY_LABELS;
  protected readonly paymentLabels = PAYMENT_LABELS;
  protected readonly monthLabel = monthLabel;
  protected readonly sorts: { id: SortKey; label: string }[] = [
    { id: 'date-desc', label: 'Newest first' },
    { id: 'date-asc', label: 'Oldest first' },
    { id: 'amount-desc', label: 'Highest amount' },
    { id: 'amount-asc', label: 'Lowest amount' },
    { id: 'merchant', label: 'Merchant A-Z' },
  ];

  protected readonly query = signal<ExpenseQuery>({ search: '', category: '', month: '', sort: 'date-desc' });
  protected readonly months = computed(() => monthsWithData(this.store.expenses()));
  protected readonly results = computed(() => filterExpenses(this.store.expenses(), this.query()));
  /** Totals per currency, since expenses in different currencies cannot be summed. */
  protected readonly sums = computed(() => {
    const map = new Map<string, number>();
    for (const e of this.results()) map.set(e.currency, round2((map.get(e.currency) ?? 0) + e.total));
    return [...map.entries()].map(([currency, total]) => ({ currency, total }));
  });
  protected readonly filtered = computed(() => {
    const q = this.query();
    return !!(q.search || q.category || q.month);
  });

  protected set(p: Partial<ExpenseQuery>): void {
    this.query.update((q) => ({ ...q, ...p }));
  }

  protected setCategory(value: string): void {
    this.set({ category: value as Category | '' });
  }

  protected reset(): void {
    this.query.set({ search: '', category: '', month: '', sort: this.query().sort });
  }

  protected exportCsv(): void {
    const q = this.query();
    const suffix = q.month || 'all';
    download(`receipto-expenses-${suffix}.csv`, toCsv(this.results()), 'text/csv;charset=utf-8');
  }

  protected formatDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
