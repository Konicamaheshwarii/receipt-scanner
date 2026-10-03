import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ExpenseStore } from './core/expense.store';
import { PROVIDERS, SettingsStore } from './core/settings.store';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="skip" href="#main" (click)="focusMain($event)">Skip to content</a>
    <header class="top">
      <a routerLink="/" class="brand" aria-label="Receipto home">
        <svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><path d="M10 6h12v20l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" fill="var(--surface)"/><path d="M13 11h6M13 15h6M13 19h4" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round"/></svg>
        Receipto
      </a>
      <nav aria-label="Main">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Dashboard</a>
        <a routerLink="/expenses" routerLinkActive="active">Expenses</a>
        <a routerLink="/settings" routerLinkActive="active">Settings</a>
      </nav>
      <a routerLink="/settings" class="chip provider" [title]="'AI provider: ' + providerLabel()">{{ providerLabel() }}</a>
      <a routerLink="/scan" class="btn primary scan">+ Scan</a>
    </header>
    @if (expenses.saveError()) {
      <p class="alert storage" role="alert">This browser refused to save your data (storage is full or blocked). Export a backup from Settings.</p>
    }
    <main id="main" tabindex="-1"><router-outlet /></main>
    @if (expenses.lastDeleted(); as gone) {
      <div class="toast" role="status">
        <span>Deleted {{ gone.merchant }}</span>
        <button class="btn sm" type="button" (click)="expenses.undoDelete()">Undo</button>
        <button class="btn sm ghost" type="button" aria-label="Dismiss" (click)="expenses.dismissUndo()">✕</button>
      </div>
    }
  `,
  styleUrl: './app.scss',
})
export class App {
  private readonly settings = inject(SettingsStore);
  protected readonly expenses = inject(ExpenseStore);
  protected readonly providerLabel = computed(
    () => PROVIDERS.find((p) => p.id === this.settings.provider())?.label.split(' (')[0] ?? '');

  protected focusMain(e: Event): void {
    e.preventDefault();
    document.getElementById('main')?.focus();
  }
}
