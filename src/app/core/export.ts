import { Budgets, CATEGORIES, Expense, PAYMENT_METHODS } from './models';
import { sanitizeBudgets } from './budget';
import { parseAmount, parseDate, round2 } from './parse';

/**
 * One CSV cell. Quotes when needed, and neutralises text that a spreadsheet
 * would run as a formula (=, +, -, @ at the start).
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  let s = value;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_HEADER = ['date', 'merchant', 'category', 'payment', 'currency', 'subtotal', 'tax', 'tip', 'total', 'items', 'notes'];

export function toCsv(expenses: Expense[]): string {
  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date, e.merchant, e.category, e.payment, e.currency, e.subtotal, e.tax, e.tip, e.total,
      e.items.map((i) => `${i.qty !== 1 ? `${i.qty} x ` : ''}${i.name} ${i.price.toFixed(2)}`).join('; '),
      e.notes,
    ].map(csvCell).join(','));
  return [CSV_HEADER.join(','), ...rows].join('\r\n') + '\r\n';
}

export interface Backup {
  app: 'receipto';
  version: 1;
  exportedAt: string;
  expenses: Expense[];
  budgets: Budgets;
}

export function makeBackup(expenses: Expense[], budgets: Budgets, now = new Date()): Backup {
  return { app: 'receipto', version: 1, exportedAt: now.toISOString(), expenses, budgets };
}

/** Validates one stored expense; returns null if it cannot be trusted. */
export function sanitizeExpense(raw: any): Expense | null {
  if (!raw || typeof raw !== 'object') return null;
  const date = parseDate(String(raw.date ?? ''));
  const total = parseAmount(raw.total);
  if (!date || total === null || typeof raw.id !== 'string' || !raw.id) return null;
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : parseAmount(v));
  const thumbnail = typeof raw.thumbnail === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(raw.thumbnail) ? raw.thumbnail : null;
  return {
    ...(thumbnail ? { thumbnail } : {}),
    id: raw.id.slice(0, 64),
    merchant: String(raw.merchant ?? '').slice(0, 80),
    date,
    currency: /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : 'USD',
    items: Array.isArray(raw.items)
      ? raw.items
          .filter((i: any) => i && typeof i === 'object' && parseAmount(i.price) !== null)
          .map((i: any) => ({ name: String(i.name ?? 'Item').slice(0, 80), qty: Number(i.qty) > 0 ? Number(i.qty) : 1, price: parseAmount(i.price)! }))
      : [],
    subtotal: num(raw.subtotal),
    tax: num(raw.tax),
    tip: num(raw.tip),
    total: round2(Math.abs(total)),
    category: CATEGORIES.includes(raw.category) ? raw.category : 'other',
    payment: PAYMENT_METHODS.includes(raw.payment) ? raw.payment : 'other',
    notes: String(raw.notes ?? '').slice(0, 500),
    source: raw.source === 'scan' || raw.source === 'demo' ? raw.source : 'manual',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
  };
}

export interface RestoreResult { expenses: Expense[]; budgets: Budgets; skipped: number }

export function parseBackup(text: string): RestoreResult {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (data?.app !== 'receipto' || !Array.isArray(data.expenses)) {
    throw new Error('This is not a Receipto backup file.');
  }
  const expenses = data.expenses.map(sanitizeExpense).filter((e: Expense | null): e is Expense => !!e);
  return { expenses, budgets: sanitizeBudgets(data.budgets), skipped: data.expenses.length - expenses.length };
}

/** Triggers a browser download of text content. */
export function download(filename: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
