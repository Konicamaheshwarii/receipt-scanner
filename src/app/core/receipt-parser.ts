import { ReceiptDraft, ReceiptItem } from './models';
import {
  normalizeCategory, normalizePayment, parseAmount, parseCurrency, parseDate, round2,
} from './parse';

/** Models sometimes wrap JSON in prose, code fences or <think> blocks. */
export function extractJson(text: string): any {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new Error('The AI reply was not valid JSON. Please try again.');
  }
}

export interface NormalizeOptions {
  /** YYYY-MM-DD used when the date is missing, and to flag future dates. */
  today: string;
  defaultCurrency: string;
  dateOrder?: 'mdy' | 'dmy';
}

export interface NormalizeResult {
  draft: ReceiptDraft;
  /** Things the user should double-check on the review screen. */
  warnings: string[];
}

const first = (o: any, keys: string[]) => keys.map((k) => o?.[k]).find((v) => v !== undefined && v !== null && v !== '');
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Tolerance for rounding on printed receipts: 2 cents, a little more for long receipts. */
export const tolerance = (itemCount: number) => Math.max(0.02, itemCount * 0.005);

function normalizeItems(list: unknown, warnings: string[]): ReceiptItem[] {
  if (!Array.isArray(list)) return [];
  let dropped = 0;
  const items: ReceiptItem[] = [];
  for (const raw of list) {
    const name = clean(first(raw, ['name', 'description', 'item', 'title']), 80);
    let qty = parseAmount(first(raw, ['qty', 'quantity', 'count']));
    if (qty === null || qty <= 0) qty = 1;
    let price = parseAmount(first(raw, ['price', 'amount', 'total', 'line_total', 'lineTotal']));
    const unit = parseAmount(first(raw, ['unit_price', 'unitPrice']));
    if (price === null && unit !== null) price = round2(unit * qty);
    if (!name && price === null) continue;
    if (price === null) { dropped++; continue; }
    items.push({ name: name || 'Item', qty, price });
  }
  if (dropped) warnings.push(`${dropped} line item${dropped > 1 ? 's' : ''} had no readable price and ${dropped > 1 ? 'were' : 'was'} skipped.`);
  return items;
}

/** Turns loosely-typed model output into a valid draft, repairing what it safely can. */
export function normalizeReceipt(input: unknown, opts: NormalizeOptions): NormalizeResult {
  const warnings: string[] = [];
  let raw: any = input;
  if (Array.isArray(raw)) raw = raw[0];
  if (raw && typeof raw === 'object' && raw.receipt && typeof raw.receipt === 'object') raw = raw.receipt;
  if (!raw || typeof raw !== 'object') throw new Error('The AI did not return receipt data. Please try again.');
  if (raw.error && raw.total === undefined && !Array.isArray(raw.items)) {
    throw new Error('That image does not look like a receipt. Try a clearer, flatter photo.');
  }

  const merchant = clean(first(raw, ['merchant', 'store', 'vendor', 'merchant_name']), 80);
  if (!merchant) warnings.push('Merchant name was not found.');

  const totalRaw = first(raw, ['total', 'grand_total', 'amount', 'total_amount']);
  const currency = parseCurrency(first(raw, ['currency', 'currency_code']))
    ?? parseCurrency(typeof totalRaw === 'string' ? totalRaw : '')
    ?? opts.defaultCurrency;

  let date = parseDate(first(raw, ['date', 'purchase_date', 'transaction_date']), opts.dateOrder);
  if (!date) {
    date = opts.today;
    warnings.push('Date was not readable, so today was used.');
  } else if (date > opts.today) {
    warnings.push('The date is in the future. Check the day and month are not swapped.');
  }

  const items = normalizeItems(first(raw, ['items', 'line_items', 'lineItems']), warnings);
  const itemsSum = round2(items.reduce((s, i) => s + i.price, 0));
  let subtotal = parseAmount(first(raw, ['subtotal', 'sub_total', 'subTotal']));
  const tax = parseAmount(first(raw, ['tax', 'vat', 'tax_amount', 'gst']));
  const tip = parseAmount(first(raw, ['tip', 'gratuity', 'service_charge']));
  let total = parseAmount(totalRaw);

  if (total === null) {
    const base = subtotal ?? (items.length ? itemsSum : null);
    if (base !== null) {
      total = round2(base + (tax ?? 0) + (tip ?? 0));
      warnings.push('Total was missing, so it was calculated from the items and tax.');
    } else {
      total = 0;
      warnings.push('Total was not found. Enter it before saving.');
    }
  }
  if (total < 0) {
    warnings.push('Total was negative (a refund?). It was saved as a positive amount.');
    total = Math.abs(total);
  }
  if (subtotal === null && items.length && tax !== null && Math.abs(itemsSum + tax + (tip ?? 0) - total) <= tolerance(items.length)) {
    subtotal = itemsSum;
  }

  const hint = `${merchant} ${items.map((i) => i.name).join(' ')}`;
  return {
    draft: {
      merchant,
      date,
      currency,
      items,
      subtotal,
      tax,
      tip,
      total,
      category: normalizeCategory(raw.category, hint),
      payment: normalizePayment(first(raw, ['payment', 'payment_method', 'paymentMethod'])),
      notes: '',
    },
    warnings,
  };
}

export function parseReceiptReply(text: string, opts: NormalizeOptions): NormalizeResult {
  return normalizeReceipt(extractJson(text), opts);
}

export interface TotalsCheck {
  itemsSum: number;
  ok: boolean;
  /** Human explanation when the numbers do not add up. */
  message: string;
}

/**
 * Checks the printed numbers agree: items vs subtotal, and subtotal + tax vs total.
 * Tax-inclusive receipts (VAT already in the prices) are accepted too.
 */
export function checkTotals(d: Pick<ReceiptDraft, 'items' | 'subtotal' | 'tax' | 'tip' | 'total'>): TotalsCheck {
  const itemsSum = round2(d.items.reduce((s, i) => s + (Number.isFinite(i.price) ? i.price : 0), 0));
  const tol = tolerance(d.items.length);
  const near = (a: number, b: number) => Math.abs(a - b) <= tol;
  const tax = d.tax ?? 0;
  const tip = d.tip ?? 0;
  const f = (n: number) => n.toFixed(2);
  const extras = [d.tax !== null ? 'tax' : '', d.tip !== null ? 'tip' : ''].filter(Boolean).join(' + ');
  const problems: string[] = [];

  if (d.subtotal !== null) {
    if (d.items.length && !near(itemsSum, d.subtotal)) {
      problems.push(`Items add up to ${f(itemsSum)} but the subtotal is ${f(d.subtotal)} (off by ${f(Math.abs(itemsSum - d.subtotal))}).`);
    }
    const expected = d.subtotal + tax + tip;
    // Tax-inclusive receipts print the tax but it is already part of the subtotal.
    if (!near(expected, d.total) && !near(d.subtotal + tip, d.total)) {
      problems.push(`Subtotal${extras ? ' + ' + extras : ''} is ${f(expected)} but the total is ${f(d.total)} (off by ${f(Math.abs(expected - d.total))}).`);
    }
  } else if (d.items.length) {
    const expected = itemsSum + tax + tip;
    if (!near(expected, d.total) && !near(itemsSum + tip, d.total)) {
      problems.push(`Items${extras ? ' + ' + extras : ''} add up to ${f(expected)} but the total is ${f(d.total)} (off by ${f(Math.abs(expected - d.total))}).`);
    }
  }
  return { itemsSum, ok: problems.length === 0, message: problems.join(' ') };
}
