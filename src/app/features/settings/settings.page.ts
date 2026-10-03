import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { totalBudget } from '../../core/budget';
import { Clock } from '../../core/clock';
import { ExpenseStore } from '../../core/expense.store';
import { download, makeBackup, parseBackup, toCsv } from '../../core/export';
import { LlmService } from '../../core/llm/llm.service';
import { CATEGORIES, CATEGORY_LABELS, Category } from '../../core/models';
import { parseAmount } from '../../core/parse';
import { CURRENCIES, PROVIDERS, ProviderId, SettingsStore, Theme } from '../../core/settings.store';
import { MoneyPipe } from '../../shared/money.pipe';

type RealProvider = Exclude<ProviderId, 'demo'>;

@Component({
  selector: 'app-settings',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
})
export class SettingsPage {
  protected readonly store = inject(SettingsStore);
  protected readonly expenses = inject(ExpenseStore);
  private readonly llm = inject(LlmService);
  private readonly clock = inject(Clock);

  protected readonly providers = PROVIDERS;
  protected readonly currencies = CURRENCIES;
  protected readonly categories = CATEGORIES;
  protected readonly labels = CATEGORY_LABELS;
  protected readonly themes: Theme[] = ['system', 'light', 'dark'];
  protected readonly current = computed(() => PROVIDERS.find((p) => p.id === this.store.provider())!);
  protected readonly real = computed(() => (this.store.isDemo() ? null : (this.store.provider() as RealProvider)));
  protected readonly total = computed(() => totalBudget(this.expenses.budgets()));

  protected readonly test = signal<{ state: 'idle' | 'running' | 'ok' | 'fail'; message?: string }>({ state: 'idle' });
  protected readonly dataMessage = signal<{ ok: boolean; text: string } | null>(null);
  protected readonly confirmClear = signal(false);

  protected choose(id: ProviderId): void {
    this.store.update({ provider: id });
    this.test.set({ state: 'idle' });
  }

  protected setKey(value: string): void {
    this.store.setKey(this.real()!, value.trim());
    this.test.set({ state: 'idle' });
  }

  protected setModel(value: string): void {
    if (value.trim()) this.store.setModel(this.real()!, value.trim());
  }

  protected async testConnection(): Promise<void> {
    this.test.set({ state: 'running' });
    try {
      const reply = await this.llm.complete({
        task: 'ping', json: true, system: 'You are a health check.', prompt: 'Reply with JSON only: {"ok":true}',
      });
      this.test.set({ state: 'ok', message: reply ? 'Connected. The provider answered.' : 'Connected, but the reply was empty.' });
    } catch (e) {
      this.test.set({ state: 'fail', message: (e as Error).message });
    }
  }

  protected clearKey(): void {
    this.store.setKey(this.real()!, '');
  }

  protected setBudget(category: Category, value: string): void {
    const n = parseAmount(value);
    this.expenses.setBudget(category, n !== null && n > 0 ? n : null);
  }

  protected exportCsv(): void {
    download(`receipto-expenses-${this.clock.today()}.csv`, toCsv(this.expenses.expenses()), 'text/csv;charset=utf-8');
  }

  protected backup(): void {
    const data = makeBackup(this.expenses.expenses(), this.expenses.budgets(), this.clock.now());
    download(`receipto-backup-${this.clock.today()}.json`, JSON.stringify(data, null, 2), 'application/json');
  }

  protected async restore(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      const result = parseBackup(await file.text());
      const { added, replaced } = this.expenses.restore(result);
      this.dataMessage.set({
        ok: true,
        text: `Restored: ${added} added, ${replaced} updated${result.skipped ? `, ${result.skipped} invalid skipped` : ''}.`,
      });
    } catch (e) {
      this.dataMessage.set({ ok: false, text: (e as Error).message });
    }
  }

  protected loadDemo(): void {
    this.expenses.loadDemo();
    this.dataMessage.set({ ok: true, text: 'Demo history for the last 3 months loaded.' });
  }

  protected clearAll(): void {
    if (!this.confirmClear()) {
      this.confirmClear.set(true);
      return;
    }
    this.expenses.clearAll();
    this.confirmClear.set(false);
    this.dataMessage.set({ ok: true, text: 'All expenses and budgets were deleted.' });
  }
}
