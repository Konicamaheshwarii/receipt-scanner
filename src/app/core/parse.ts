import { CATEGORIES, Category, PAYMENT_METHODS, PaymentMethod } from './models';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Reads a money amount the way it is printed on receipts:
 * "$1,234.56", "1.234,56 €", "4,50", "(5.00)" or "-5.00" (discounts), "12.00-".
 * Returns null when there is no number in it.
 */
export function parseAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? round2(value) : null;
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /^[^\d]*-/.test(s) || /-\s*$/.test(s) || /\bCR\b/i.test(s);
  let digits = s.replace(/[^\d.,]/g, '').replace(/^[.,]+|[.,]+$/g, '');
  if (!/\d/.test(digits)) return null;

  const lastComma = digits.lastIndexOf(',');
  const lastDot = digits.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: whichever comes last is the decimal separator.
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousands = decimal === ',' ? '.' : ',';
    digits = digits.split(thousands).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    // "4,50" is a decimal comma; "1,234" and "1,234,567" are thousands.
    digits = /,\d{1,2}$/.test(digits) && digits.split(',').length === 2
      ? digits.replace(',', '.')
      : digits.split(',').join('');
  } else if (digits.split('.').length > 2) {
    digits = digits.split('.').join(''); // "1.234.567"
  }
  const n = Number.parseFloat(digits);
  if (!Number.isFinite(n)) return null;
  return round2(negative ? -n : n);
}

const SYMBOLS: [RegExp, string][] = [
  [/US\$/i, 'USD'], [/C\$|CA\$/i, 'CAD'], [/A\$|AU\$/i, 'AUD'], [/NZ\$/i, 'NZD'], [/R\$/i, 'BRL'],
  [/S\$/i, 'SGD'], [/HK\$/i, 'HKD'], [/€/, 'EUR'], [/£/, 'GBP'], [/₹|\bRs\.?(?=[\s\d]|$)/i, 'INR'],
  [/¥|円/, 'JPY'], [/₩/, 'KRW'], [/₺/, 'TRY'], [/₱/, 'PHP'], [/zł/i, 'PLN'], [/\$/, 'USD'],
];

/** "€", "eur", "US$", "Rs." or a printed amount like "4,50 €" -> ISO 4217 code. */
export function parseCurrency(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  const code = s.match(/\b([A-Za-z]{3})\b/);
  if (code && /^[A-Za-z]{3}$/.test(s)) return code[1].toUpperCase();
  for (const [re, iso] of SYMBOLS) if (re.test(s)) return iso;
  if (code && !/^(rs|tax|vat|tip)$/i.test(code[1])) return code[1].toUpperCase();
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function build(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null; // e.g. 31 Feb
  return isoDate(date);
}

/**
 * Reads the date formats seen on receipts and returns YYYY-MM-DD, or null.
 * Ambiguous numeric dates (03/04/2026) use `order`; a "." separator or a first
 * number above 12 means day-first.
 */
export function parseDate(value: unknown, order: 'mdy' | 'dmy' = 'mdy'): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim().toLowerCase();
  if (!s) return null;

  let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return build(+m[1], +m[2], +m[3]);

  m = s.match(/(\d{1,2})([-/.])(\d{1,2})\2(\d{2,4})/);
  if (m) {
    const a = +m[1], b = +m[3], y = +m[4];
    const dayFirst = a > 12 || (b <= 12 && (m[2] === '.' || order === 'dmy'));
    return dayFirst ? build(y, b, a) : build(y, a, b);
  }

  // "Sep 28, 2026", "September 28 2026"
  m = s.match(/([a-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{2,4})/);
  if (m && MONTHS.includes(m[1].slice(0, 3))) return build(+m[3], MONTHS.indexOf(m[1].slice(0, 3)) + 1, +m[2]);

  // "28 Sep 2026", "28-Sep-26"
  m = s.match(/(\d{1,2})(?:st|nd|rd|th)?[\s-]+([a-z]{3,})\.?[\s,-]+(\d{2,4})/);
  if (m && MONTHS.includes(m[2].slice(0, 3))) return build(+m[3], MONTHS.indexOf(m[2].slice(0, 3)) + 1, +m[1]);

  return null;
}

const CATEGORY_WORDS: [Category, RegExp][] = [
  ['groceries', /grocer|supermarket|market|food ?store|mart\b|produce|bakery|butcher/],
  ['dining', /dining|restaurant|food|caf[eé]|coffee|bar\b|pub|takeaway|takeout|pizza|bistro|trattoria|diner|meal|lunch|dinner/],
  ['transport', /transport|fuel|gas\b|gasoline|petrol|taxi|uber|lyft|parking|transit|metro|bus\b|toll|car ?wash/],
  ['health', /health|pharma|drug|medic|doctor|dental|clinic|hospital|optic|wellness/],
  ['travel', /travel|hotel|motel|airline|flight|airbnb|lodging|resort|hostel|rail|train/],
  ['bills', /bill|utilit|electric|water|internet|phone|mobile plan|rent|insurance|subscription|telecom/],
  ['shopping', /shop|retail|electronic|cloth|apparel|fashion|home|hardware|book|department|store/],
];

/** Maps whatever label the model used ("Food & Drink", "Restaurants") to a known category. */
export function normalizeCategory(value: unknown, hint = ''): Category {
  const s = String(value ?? '').trim().toLowerCase();
  if ((CATEGORIES as readonly string[]).includes(s)) return s as Category;
  for (const text of [s, hint.toLowerCase()]) {
    if (!text) continue;
    for (const [cat, re] of CATEGORY_WORDS) if (re.test(text)) return cat;
  }
  return 'other';
}

export function normalizePayment(value: unknown): PaymentMethod {
  const s = String(value ?? '').trim().toLowerCase();
  if ((PAYMENT_METHODS as readonly string[]).includes(s)) return s as PaymentMethod;
  if (/apple ?pay|google ?pay|g ?pay|paypal|venmo|upi|wallet|mobile|contactless phone|samsung pay/.test(s)) return 'mobile';
  if (/direct debit|transfer|\bbank\b|\bach\b|sepa|wire|cheque/.test(s)) return 'bank';
  if (/visa|master|amex|american express|discover|debit|credit|card|\*{2,}|x{4}\d{4}|chip|maestro/.test(s)) return 'card';
  if (/cash|change due/.test(s)) return 'cash';
  return 'other';
}

/** Formats an amount in its currency, falling back gracefully for unknown codes. */
export function formatMoney(amount: number, currency: string, compact = false): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency, notation: compact ? 'compact' : 'standard',
      maximumFractionDigits: compact ? 1 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}
