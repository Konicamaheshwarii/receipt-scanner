export const CATEGORIES = [
  'groceries', 'dining', 'transport', 'shopping', 'bills', 'health', 'travel', 'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  groceries: 'Groceries',
  dining: 'Dining',
  transport: 'Transport',
  shopping: 'Shopping',
  bills: 'Bills',
  health: 'Health',
  travel: 'Travel',
  other: 'Other',
};

export const PAYMENT_METHODS = ['card', 'cash', 'mobile', 'bank', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  card: 'Card',
  cash: 'Cash',
  mobile: 'Mobile wallet',
  bank: 'Bank transfer',
  other: 'Other',
};

export interface ReceiptItem {
  name: string;
  qty: number;
  /** Line total (qty x unit price), in the receipt currency. Negative for discounts. */
  price: number;
}

/** What the extractor produces and the review screen edits. */
export interface ReceiptDraft {
  merchant: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** ISO 4217 code, e.g. USD. */
  currency: string;
  items: ReceiptItem[];
  subtotal: number | null;
  tax: number | null;
  /** Tip or service charge, when printed separately. */
  tip: number | null;
  total: number;
  category: Category;
  payment: PaymentMethod;
  notes: string;
}

export interface Expense extends ReceiptDraft {
  id: string;
  /** Small JPEG data URL. Full images are never stored. */
  thumbnail?: string;
  source: 'scan' | 'manual' | 'demo';
  createdAt: string;
}

export type Budgets = Partial<Record<Category, number>>;

export function emptyDraft(today: string, currency: string): ReceiptDraft {
  return {
    merchant: '', date: today, currency, items: [], subtotal: null, tax: null, tip: null, total: 0,
    category: 'other', payment: 'card', notes: '',
  };
}
