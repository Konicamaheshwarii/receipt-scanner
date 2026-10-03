import { Injectable, computed, effect, signal } from '@angular/core';
import { readJson, writeJson } from './storage';

export type ProviderId = 'demo' | 'gemini' | 'groq';

export type Theme = 'system' | 'light' | 'dark';

export interface Settings {
  provider: ProviderId;
  theme: Theme;
  apiKeys: Partial<Record<Exclude<ProviderId, 'demo'>, string>>;
  models: Record<Exclude<ProviderId, 'demo'>, string>;
  /** Currency the dashboard and budgets are in. */
  currency: string;
  /** How to read ambiguous numeric dates like 03/04/2026. */
  dateOrder: 'mdy' | 'dmy';
}

export const PROVIDERS: { id: ProviderId; label: string; keyUrl?: string }[] = [
  { id: 'demo', label: 'Demo (no key, offline)' },
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey' },
  { id: 'groq', label: 'Groq', keyUrl: 'https://console.groq.com/keys' },
];

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'CAD', 'AUD', 'JPY', 'CHF', 'SGD', 'AED'];

export const DEFAULT_SETTINGS: Settings = {
  provider: 'demo',
  theme: 'system',
  apiKeys: {},
  models: { gemini: 'gemini-2.5-flash', groq: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  currency: 'USD',
  dateOrder: 'mdy',
};

const KEY = 'receipto.settings';

function load(): Settings {
  const saved = readJson<Partial<Settings>>(KEY, {});
  return { ...DEFAULT_SETTINGS, ...saved, models: { ...DEFAULT_SETTINGS.models, ...saved.models } };
}

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly state = signal<Settings>(load());

  readonly settings = this.state.asReadonly();
  readonly provider = computed(() => this.state().provider);
  readonly currency = computed(() => this.state().currency);
  readonly isDemo = computed(() => this.state().provider === 'demo');
  /** A real provider is selected but has no key yet. */
  readonly needsKey = computed(() => {
    const s = this.state();
    return s.provider !== 'demo' && !s.apiKeys[s.provider]?.trim();
  });

  constructor() {
    effect(() => writeJson(KEY, this.state()));
    effect(() => {
      const theme = this.state().theme;
      if (theme === 'system') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', theme);
    });
  }

  update(patch: Partial<Settings>): void {
    this.state.update((s) => ({ ...s, ...patch }));
  }

  setKey(provider: Exclude<ProviderId, 'demo'>, key: string): void {
    this.state.update((s) => ({ ...s, apiKeys: { ...s.apiKeys, [provider]: key } }));
  }

  setModel(provider: Exclude<ProviderId, 'demo'>, model: string): void {
    this.state.update((s) => ({ ...s, models: { ...s.models, [provider]: model } }));
  }
}
