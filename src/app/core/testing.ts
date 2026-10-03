import { Category, Expense } from './models';

let n = 0;

/** Test fixture: a minimal valid expense. */
export function expense(date: string, total: number, category: Category = 'groceries', merchant = 'Shop'): Expense {
  return {
    id: `e${n++}`, merchant, date, currency: 'USD', items: [], subtotal: null, tax: null, tip: null, total,
    category, payment: 'card', notes: '', source: 'manual', createdAt: `${date}T12:00:00.000Z`,
  };
}
