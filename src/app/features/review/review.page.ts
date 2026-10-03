import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ExpenseStore } from '../../core/expense.store';
import {
  CATEGORIES, CATEGORY_LABELS, PAYMENT_LABELS, PAYMENT_METHODS, ReceiptDraft, ReceiptItem,
} from '../../core/models';
import { parseAmount, round2 } from '../../core/parse';
import { checkTotals } from '../../core/receipt-parser';
import { Review, ScanStore } from '../../core/scan.store';
import { CURRENCIES } from '../../core/settings.store';
import { MoneyPipe } from '../../shared/money.pipe';

type MoneyField = 'subtotal' | 'tax' | 'tip' | 'total';

@Component({
  selector: 'app-review',
  imports: [RouterLink, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './review.page.html',
  styleUrl: './review.page.scss',
})
export class ReviewPage {
  /** Route param for /edit/:id. */
  readonly id = input<string>();

  private readonly scan = inject(ScanStore);
  private readonly store = inject(ExpenseStore);
  private readonly router = inject(Router);

  protected readonly categories = CATEGORIES;
  protected readonly categoryLabels = CATEGORY_LABELS;
  protected readonly payments = PAYMENT_METHODS;
  protected readonly paymentLabels = PAYMENT_LABELS;

  protected readonly review = signal<Review | null>(null);
  protected readonly draft = signal<ReceiptDraft | null>(null);
  protected readonly zoom = signal(false);
  protected readonly submitted = signal(false);

  protected readonly currencies = computed(() => {
    const c = this.draft()?.currency;
    return c && !CURRENCIES.includes(c) ? [c, ...CURRENCIES] : CURRENCIES;
  });
  protected readonly totals = computed(() => {
    const d = this.draft();
    return d ? checkTotals(d) : null;
  });
  /** Total implied by the parts, offered as a one-click fix when the numbers disagree. */
  protected readonly suggestedTotal = computed(() => {
    const d = this.draft();
    if (!d) return null;
    const base = d.subtotal ?? (d.items.length ? this.totals()!.itemsSum : null);
    if (base === null) return null;
    const value = round2(base + (d.tax ?? 0) + (d.tip ?? 0));
    return value > 0 && Math.abs(value - d.total) > 0.009 ? value : null;
  });
  protected readonly errors = computed(() => {
    const d = this.draft();
    if (!d) return {};
    return {
      total: !(d.total > 0) ? 'Enter the total paid.' : '',
      date: !/^\d{4}-\d{2}-\d{2}$/.test(d.date) ? 'Pick a date.' : '',
    };
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private load(id: string | undefined): void {
    if (id) {
      const expense = this.store.get(id);
      if (!expense) {
        this.router.navigate(['/expenses']);
        return;
      }
      this.scan.edit(expense);
    }
    const review = this.scan.review();
    if (!review || (!id && review.editingId)) {
      this.router.navigate(['/scan']);
      return;
    }
    this.review.set(review);
    this.draft.set(structuredClone(review.draft));
  }

  protected patch(p: Partial<ReceiptDraft>): void {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  protected setMoney(field: MoneyField, value: string): void {
    const n = parseAmount(value);
    if (field === 'total') this.patch({ total: n === null ? 0 : Math.abs(n) });
    else this.patch({ [field]: n } as Partial<ReceiptDraft>);
  }

  protected setItem(index: number, p: Partial<ReceiptItem>): void {
    this.draft.update((d) => d && { ...d, items: d.items.map((it, i) => (i === index ? { ...it, ...p } : it)) });
  }

  protected setItemPrice(index: number, value: string): void {
    this.setItem(index, { price: parseAmount(value) ?? 0 });
  }

  protected setItemQty(index: number, value: string): void {
    const q = parseAmount(value);
    this.setItem(index, { qty: q && q > 0 ? q : 1 });
  }

  protected addItem(): void {
    this.draft.update((d) => d && { ...d, items: [...d.items, { name: '', qty: 1, price: 0 }] });
    queueMicrotask(() => document.querySelector<HTMLInputElement>('.items tr:last-child input')?.focus());
  }

  protected removeItem(index: number): void {
    this.draft.update((d) => d && { ...d, items: d.items.filter((_, i) => i !== index) });
  }

  protected useSuggested(): void {
    const t = this.suggestedTotal();
    if (t !== null) this.patch({ total: t });
  }

  protected save(): void {
    this.submitted.set(true);
    const d = this.draft();
    const r = this.review();
    const e = this.errors();
    if (!d || !r || e.total || e.date) {
      queueMicrotask(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    if (r.editingId) this.store.update(r.editingId, d);
    else this.store.add(d, { source: r.source, thumbnail: r.thumbnail });
    this.scan.clear();
    this.router.navigate([r.editingId ? '/expenses' : '/'], { state: { saved: true } });
  }

  protected remove(): void {
    const r = this.review();
    if (!r?.editingId) return;
    this.store.remove(r.editingId);
    this.scan.clear();
    this.router.navigate(['/expenses']);
  }

  protected discard(): void {
    const editing = this.review()?.editingId;
    this.scan.clear();
    this.router.navigate([editing ? '/expenses' : '/scan']);
  }

  protected value(n: number | null): string {
    return n === null ? '' : n.toFixed(2);
  }
}
