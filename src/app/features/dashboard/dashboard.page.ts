import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  byCategory, dailySeries, daysInMonth, inMonth, monthLabel, monthOf, monthTotal, monthTotalUntil, monthlySeries, shiftMonth, topMerchants,
} from '../../core/aggregate';
import { budgetStatus, categoryBudgets, monthProgress, totalBudget } from '../../core/budget';
import { Clock } from '../../core/clock';
import { ExpenseStore } from '../../core/expense.store';
import { LlmService } from '../../core/llm/llm.service';
import { CATEGORY_LABELS } from '../../core/models';
import { formatMoney, round2 } from '../../core/parse';
import { insightsRequest } from '../../core/prompts';
import { SettingsStore } from '../../core/settings.store';
import { BarChart, BarDatum } from '../../shared/charts/bar-chart';
import { DonutChart, Slice } from '../../shared/charts/donut-chart';
import { LineChart } from '../../shared/charts/line-chart';
import { MoneyPipe } from '../../shared/money.pipe';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MoneyPipe, DonutChart, BarChart, LineChart],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage implements OnDestroy {
  private readonly store = inject(ExpenseStore);
  private readonly settings = inject(SettingsStore);
  private readonly llm = inject(LlmService);
  private readonly clock = inject(Clock);
  private insightsAbort?: AbortController;

  protected readonly labels = CATEGORY_LABELS;
  protected readonly today = this.clock.today();
  protected readonly currentMonth = monthOf(this.today);
  protected readonly dayOfMonth = Number(this.today.slice(8, 10));
  protected readonly month = signal(this.currentMonth);
  protected readonly currency = this.settings.currency;
  protected readonly monthName = computed(() => monthLabel(this.month()));

  protected readonly money = (n: number) => formatMoney(n, this.currency());
  protected readonly compact = (n: number) => formatMoney(n, this.currency(), true);

  /** Only expenses in the home currency are charted; others are counted separately. */
  private readonly expenses = computed(() => this.store.expenses().filter((e) => e.currency === this.currency()));
  protected readonly hasAny = computed(() => this.store.expenses().length > 0);
  protected readonly otherCurrency = computed(() => {
    const list = inMonth(this.store.expenses(), this.month()).filter((e) => e.currency !== this.currency());
    return { count: list.length, currencies: [...new Set(list.map((e) => e.currency))].join(', ') };
  });

  protected readonly monthList = computed(() => inMonth(this.expenses(), this.month()));
  protected readonly progress = computed(() => monthProgress(this.month(), this.today));
  protected readonly spent = computed(() => monthTotal(this.expenses(), this.month()));
  protected readonly previous = computed(() => monthTotal(this.expenses(), shiftMonth(this.month(), -1)));
  protected readonly budget = computed(() => totalBudget(this.store.budgets()));
  protected readonly status = computed(() => budgetStatus(this.spent(), this.budget(), this.progress()));
  /** Mid-month, compare with the same point of last month rather than its full total. */
  protected readonly partial = computed(() => this.month() === this.currentMonth && this.progress() < 1);
  protected readonly previousComparable = computed(() => this.partial()
    ? monthTotalUntil(this.expenses(), shiftMonth(this.month(), -1), this.dayOfMonth)
    : this.previous());
  protected readonly change = computed(() => {
    const prev = this.previousComparable();
    return prev ? (this.spent() - prev) / prev : null;
  });
  protected readonly dailyAverage = computed(() => {
    const p = this.progress();
    if (p === 0) return 0;
    const days = Math.max(1, Math.round(p * daysInMonth(this.month())));
    return round2(this.spent() / days);
  });

  protected readonly categories = computed(() => byCategory(this.monthList()));
  protected readonly slices = computed<Slice[]>(() => {
    // Segments stay in the fixed category order so colours and neighbours never shuffle.
    const totals = new Map(this.categories().map((c) => [c.category, c.total]));
    return (Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[])
      .filter((c) => totals.has(c))
      .map((c) => ({ key: c, label: CATEGORY_LABELS[c], value: totals.get(c)!, color: `var(--c-${c})` }));
  });
  protected readonly budgets = computed(() => categoryBudgets(this.expenses(), this.store.budgets(), this.month(), this.today));
  protected readonly daily = computed(() => dailySeries(this.expenses(), this.month()));
  /** Last 6 months, without the empty months before the first expense. */
  protected readonly monthly = computed(() => {
    const series = monthlySeries(this.expenses(), this.month(), 6);
    const first = series.findIndex((p) => p.total > 0);
    return first < 0 ? series : series.slice(Math.min(first, series.length - 2));
  });
  protected readonly merchants = computed(() => topMerchants(this.monthList(), 5));
  protected readonly merchantMax = computed(() => Math.max(1, ...this.merchants().map((m) => m.total)));

  protected readonly dayTitle = (d: BarDatum) => {
    const [y, m, day] = d.key.split('-').map(Number);
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };
  protected readonly monthTitle = (d: { key: string }) => monthLabel(d.key);

  protected readonly insights = signal('');
  protected readonly insightsState = signal<'idle' | 'loading' | 'error'>('idle');
  protected readonly insightsError = signal('');

  protected go(delta: number): void {
    const next = shiftMonth(this.month(), delta);
    if (next > this.currentMonth) return;
    this.month.set(next);
    this.stopInsights();
    this.insights.set('');
  }

  protected async askInsights(): Promise<void> {
    this.stopInsights();
    const controller = (this.insightsAbort = new AbortController());
    this.insights.set('');
    this.insightsError.set('');
    this.insightsState.set('loading');
    const budgets = this.store.budgets();
    try {
      const req = insightsRequest({
        month: this.month(), monthLabel: this.monthName(), currency: this.currency(),
        total: this.spent(), budget: this.budget(), previousTotal: this.previous(), progress: this.progress(),
        categories: this.categories().map((c) => ({ category: c.category, total: c.total, budget: budgets[c.category] ?? 0 })),
        merchants: topMerchants(this.monthList(), 8),
      });
      for await (const chunk of this.llm.stream(req, controller.signal)) {
        if (controller.signal.aborted) return;
        this.insights.update((t) => t + chunk);
      }
      this.insightsState.set('idle');
    } catch (e) {
      if (controller.signal.aborted) return;
      this.insightsError.set((e as Error).message);
      this.insightsState.set('error');
    }
  }

  protected bullets(text: string): string[] {
    return text.split('\n').map((l) => l.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
  }

  private stopInsights(): void {
    this.insightsAbort?.abort();
    this.insightsAbort = undefined;
    this.insightsState.set('idle');
  }

  ngOnDestroy(): void {
    this.insightsAbort?.abort();
  }
}
