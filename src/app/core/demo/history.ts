import { Budgets, Category, Expense, PaymentMethod, ReceiptItem } from '../models';
import { isoDate, round2 } from '../parse';

/** Small seeded PRNG so the demo history is the same on every visit for a given day. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Template {
  merchant: string;
  category: Category;
  payment: PaymentMethod;
  taxRate: number;
  items: [string, number][];
  /** How many items to pick: [min, max]. */
  pick: [number, number];
}

const T = (merchant: string, category: Category, payment: PaymentMethod, taxRate: number, pick: [number, number], items: [string, number][]): Template =>
  ({ merchant, category, payment, taxRate, pick, items });

const GROCERS = [
  T('Green Basket Market', 'groceries', 'card', 0, [4, 9], [['Bananas', 1.59], ['Whole Milk', 4.29], ['Sourdough Loaf', 5.49], ['Eggs 12ct', 4.99], ['Baby Spinach', 3.99], ['Greek Yogurt', 3.58], ['Chicken Thighs', 9.87], ['Cheddar', 6.49], ['Apples 3lb', 5.99], ['Coffee Beans', 12.99], ['Olive Oil', 10.49], ['Tomatoes', 3.29]]),
  T('FreshCo', 'groceries', 'mobile', 0, [3, 7], [['Salmon Fillet', 13.48], ['Rice 5lb', 7.99], ['Avocados', 4.5], ['Oat Milk', 4.79], ['Pasta', 1.99], ['Berries', 5.99], ['Broccoli', 2.89], ['Granola', 6.49]]),
  T('Corner Grocer', 'groceries', 'cash', 0, [1, 3], [['Bread', 3.49], ['Milk', 2.99], ['Bananas', 1.29], ['Butter', 4.49], ['Snacks', 3.99]]),
];
const DINING = [
  T('Brew & Bean', 'dining', 'mobile', 0.08875, [1, 2], [['Flat White', 4.75], ['Croissant', 3.95], ['Cold Brew', 4.5], ['Bagel', 3.25]]),
  T('Trattoria Bella', 'dining', 'card', 0.08875, [2, 4], [['Burrata', 14], ['Pizza Margherita', 16.5], ['Tagliatelle', 19], ['Tiramisù', 9], ['House Wine', 11]]),
  T('Sushi Koi', 'dining', 'card', 0.08875, [2, 4], [['Salmon Roll', 9.5], ['Miso Soup', 3.5], ['Chef Nigiri Set', 26], ['Edamame', 5], ['Green Tea', 3]]),
  T('Taco Loco', 'dining', 'card', 0.08875, [1, 3], [['Carnitas Tacos', 11.5], ['Burrito Bowl', 12.75], ['Chips & Salsa', 4.25], ['Horchata', 3.5]]),
];
const TRANSPORT = [
  T('Metro Fuel #212', 'transport', 'card', 0, [1, 1], [['Unleaded Regular', 42.18], ['Unleaded Regular', 38.4], ['Unleaded Regular', 46.95]]),
  T('CityRide', 'transport', 'mobile', 0, [1, 1], [['Ride downtown', 14.6], ['Ride to airport', 27.9], ['Ride home', 18.25]]),
  T('Park & Go Garage', 'transport', 'card', 0, [1, 1], [['Parking 3h', 12], ['Parking 2h', 8]]),
];
const SHOPPING = [
  T('Volt Electronics', 'shopping', 'card', 0.0825, [1, 2], [['USB-C Cable', 14.99], ['Power Bank', 39.99], ['Mouse', 24.99], ['HDMI Adapter', 19.99]]),
  T('Northwind Apparel', 'shopping', 'card', 0.0825, [1, 2], [['Cotton T-Shirt', 18], ['Running Socks 3pk', 14], ['Chinos', 49], ['Hoodie', 54]]),
  T('HomeNest', 'shopping', 'card', 0.0825, [1, 3], [['Bath Towel', 16.99], ['Candle', 12.5], ['Storage Box', 9.99], ['Plant Pot', 14.99]]),
];
const HEALTH = [
  T('CityCare Pharmacy', 'health', 'mobile', 0.065, [1, 3], [['Ibuprofen', 8.99], ['Vitamin D3', 11.49], ['Allergy Relief', 14.99], ['Bandages', 4.79], ['Sunscreen', 12.99]]),
];
const OTHER = [
  T('PostBox Shipping', 'other', 'card', 0, [1, 1], [['Parcel, ground', 11.4], ['Envelope, priority', 8.95]]),
  T('Paws & Claws', 'other', 'card', 0.0825, [1, 2], [['Dog Food 15lb', 32.99], ['Chew Toy', 7.99]]),
];

interface Recurring { day: number; merchant: string; category: Category; item: string; amount: () => number; payment: PaymentMethod }

/**
 * Realistic-looking history: recurring bills, a weekly grocery shop, fuel every ten days
 * and random everyday spending. Each day has its own seeded generator, so past days look
 * the same on every visit no matter when the demo is opened.
 */
export function generateHistory(today: Date, seed = 2026): Expense[] {
  let rand = mulberry32(seed);
  const between = (min: number, max: number) => min + rand() * (max - min);
  const chance = (p: number) => rand() < p;
  const pickOne = <X>(list: X[]) => list[Math.floor(rand() * list.length)];

  const recurring: Recurring[] = [
    { day: 1, merchant: 'Metro Transit', category: 'transport', item: 'Monthly pass', amount: () => 86, payment: 'card' },
    { day: 3, merchant: 'Peak Fitness', category: 'health', item: 'Membership', amount: () => 39, payment: 'card' },
    { day: 5, merchant: 'Brightline Energy', category: 'bills', item: 'Electricity', amount: () => round2(between(78, 124)), payment: 'bank' },
    { day: 12, merchant: 'Nimbus Mobile', category: 'bills', item: 'Phone plan', amount: () => 45, payment: 'card' },
    { day: 18, merchant: 'FiberNet', category: 'bills', item: 'Internet 500 Mbps', amount: () => 60, payment: 'bank' },
    { day: 22, merchant: 'StreamBox', category: 'bills', item: 'Streaming subscription', amount: () => 15.99, payment: 'card' },
  ];

  const start = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const out: Expense[] = [];
  let n = 0;

  const add = (date: Date, t: Template, items: ReceiptItem[], tip = 0) => {
    const subtotal = round2(items.reduce((s, i) => s + i.price, 0));
    const tax = round2(subtotal * t.taxRate);
    out.push({
      id: `demo-${isoDate(date)}-${n++}`,
      merchant: t.merchant,
      date: isoDate(date),
      currency: 'USD',
      items,
      subtotal,
      tax: t.taxRate ? tax : null,
      tip: tip ? tip : null,
      total: round2(subtotal + tax + tip),
      category: t.category,
      payment: t.payment,
      notes: '',
      source: 'demo',
      createdAt: date.toISOString(),
    });
  };

  const fromTemplate = (date: Date, t: Template, tipRate = 0, pick = t.pick) => {
    const count = Math.round(between(pick[0], pick[1]));
    const pool = [...t.items];
    const items: ReceiptItem[] = [];
    for (let i = 0; i < count && pool.length; i++) {
      const [name, price] = pool.splice(Math.floor(rand() * pool.length), 1)[0];
      const qty = t.category === 'dining' && chance(0.25) ? 2 : 1;
      items.push({ name, qty, price: round2(price * qty) });
    }
    const subtotal = items.reduce((s, i) => s + i.price, 0);
    add(date, t, items, tipRate ? round2(subtotal * tipRate) : 0);
  };

  for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    rand = mulberry32(seed + date.getFullYear() * 400 + date.getMonth() * 31 + date.getDate());
    const dow = date.getDay();
    const weekend = dow === 0 || dow === 6;
    for (const r of recurring) {
      if (date.getDate() === r.day) {
        add(date, T(r.merchant, r.category, r.payment, 0, [1, 1], []), [{ name: r.item, qty: 1, price: r.amount() }]);
      }
    }
    if (dow === 6) fromTemplate(date, pickOne(GROCERS.slice(0, 2)), 0, [6, 9]); // weekly shop
    if (dow === 3 && chance(0.6)) fromTemplate(date, GROCERS[2]); // midweek top-up
    if (date.getDate() % 10 === 8) fromTemplate(date, TRANSPORT[0]); // fuel
    if (!weekend && chance(0.35)) fromTemplate(date, DINING[0]);
    if ((dow === 5 || dow === 6) && chance(0.55)) fromTemplate(date, pickOne(DINING.slice(1)), 0.18);
    if (chance(0.06)) fromTemplate(date, pickOne(TRANSPORT.slice(1)));
    if (chance(weekend ? 0.18 : 0.04)) fromTemplate(date, pickOne(SHOPPING));
    if (chance(0.04)) fromTemplate(date, HEALTH[0]);
    if (chance(0.03)) fromTemplate(date, pickOne(OTHER));
  }

  // One weekend trip, two months ago.
  const trip = new Date(today.getFullYear(), today.getMonth() - 2, 14);
  add(trip, T('Skyway Airlines', 'travel', 'card', 0, [1, 1], []), [{ name: 'Round trip SFO-SEA', qty: 1, price: 289.4 }]);
  add(new Date(trip.getFullYear(), trip.getMonth(), 16), T('Harbor View Hotel', 'travel', 'card', 0.1, [1, 1], []),
    [{ name: 'Room, 2 nights', qty: 1, price: 358 }]);

  return out.sort((a, b) => b.date.localeCompare(a.date));
}

export const DEMO_BUDGETS: Budgets = {
  groceries: 280, dining: 300, transport: 240, shopping: 150, bills: 240, health: 80, travel: 300, other: 40,
};
