/**
 * Sample receipts for Demo mode. `printed` is what is on the paper (used by
 * scripts/render-samples.mts to draw the images in public/samples), and `reply`
 * is the kind of loosely-formatted JSON a vision model returns for that image.
 * The replies are deliberately messy (strings with symbols, local date formats,
 * free-text categories) so Demo mode exercises the same validator as real scans.
 * This file must stay free of runtime imports so the render script can load it.
 */

export interface PrintedLine { text: string; amount: string; detail?: string }

export interface SampleReceipt {
  id: string;
  /** Path under public/. */
  file: string;
  label: string;
  style: 'thermal' | 'bistro' | 'cafe';
  printed: {
    title: string;
    header: string[];
    meta: string[];
    lines: PrintedLine[];
    totals: [string, string][];
    footer: string[];
  };
  reply: Record<string, unknown>;
}

export const SAMPLES: SampleReceipt[] = [
  {
    id: 'green-basket',
    file: 'samples/green-basket.jpg',
    label: 'Grocery run',
    style: 'thermal',
    printed: {
      title: 'GREEN BASKET MARKET',
      header: ['1450 Elm Street', 'Portland, OR 97205', 'Tel (503) 555-0142'],
      meta: ['09/27/2026  18:42', 'Store 014  Reg 03  Trn 5521'],
      lines: [
        { text: 'ORGANIC BANANAS', detail: '2.30 lb @ 0.69/lb', amount: '1.59' },
        { text: 'WHOLE MILK 1 GAL', amount: '4.29' },
        { text: 'SOURDOUGH LOAF', amount: '5.49' },
        { text: 'FREE RANGE EGGS 12CT', amount: '4.99' },
        { text: 'BABY SPINACH 5OZ', amount: '3.99' },
        { text: 'GREEK YOGURT', detail: '2 @ 1.79', amount: '3.58' },
        { text: 'CHEDDAR BLOCK 8OZ', amount: '6.49' },
        { text: 'PENNE PASTA 1LB', detail: '3 @ 1.25', amount: '3.75' },
      ],
      totals: [['SUBTOTAL', '34.17'], ['TAX', '0.00'], ['TOTAL', '$34.17']],
      footer: ['VISA ************4821', 'APPROVED  AUTH 093114', '8 ITEMS', 'THANK YOU FOR SHOPPING LOCAL'],
    },
    reply: {
      merchant: 'Green Basket Market',
      date: '09/27/2026',
      currency: '$',
      items: [
        { name: 'Organic Bananas', qty: '1', price: '$1.59' },
        { name: 'Whole Milk 1 Gal', qty: 1, price: '$4.29' },
        { name: 'Sourdough Loaf', qty: 1, price: '$5.49' },
        { name: 'Free Range Eggs 12ct', qty: 1, price: '$4.99' },
        { name: 'Baby Spinach 5oz', qty: 1, price: '$3.99' },
        { name: 'Greek Yogurt', qty: '2', price: '$3.58' },
        { name: 'Cheddar Block 8oz', qty: 1, price: '$6.49' },
        { name: 'Penne Pasta 1lb', qty: 3, unit_price: '1.25' },
      ],
      subtotal: '34.17',
      tax: '0.00',
      total: '$34.17',
      category: 'Groceries',
      payment_method: 'VISA ****4821',
    },
  },
  {
    id: 'trattoria-bella',
    file: 'samples/trattoria-bella.jpg',
    label: 'Dinner with tip',
    style: 'bistro',
    printed: {
      title: 'Trattoria Bella',
      header: ['cucina italiana', '88 Mulberry Street, New York, NY'],
      meta: ['Sep 25, 2026   8:14 PM', 'Table 12   Guests 2   Server: Marco'],
      lines: [
        { text: 'Burrata', amount: '14.00' },
        { text: 'Pizza Margherita', amount: '16.50' },
        { text: 'Tagliatelle al Ragù', amount: '19.00' },
        { text: 'Tiramisù', amount: '9.00' },
        { text: 'Sparkling Water', detail: '2 x 3.00', amount: '6.00' },
      ],
      totals: [['Subtotal', '64.50'], ['Sales Tax 8.875%', '5.72'], ['Tip', '12.00'], ['Total', '$82.22']],
      footer: ['Mastercard ending 1093', 'Grazie e arrivederci!'],
    },
    reply: {
      merchant: 'Trattoria Bella',
      date: 'Sep 25, 2026',
      currency: 'USD',
      items: [
        { name: 'Burrata', qty: 1, price: 14 },
        { name: 'Pizza Margherita', qty: 1, price: 16.5 },
        { name: 'Tagliatelle al Ragù', qty: 1, price: 19 },
        { name: 'Tiramisù', qty: 1, price: 9 },
        { name: 'Sparkling Water', qty: 2, price: 6 },
      ],
      subtotal: 64.5,
      tax: 5.72,
      tip: 12,
      total: 82.22,
      category: 'Restaurant',
      payment_method: 'Mastercard',
    },
  },
  {
    id: 'metro-fuel',
    file: 'samples/metro-fuel.jpg',
    label: 'Fuel, paid cash',
    style: 'thermal',
    printed: {
      title: 'METRO FUEL #212',
      header: ['2200 Harbor Blvd', 'Oakland, CA 94607'],
      meta: ['DATE 09/29/2026   TIME 07:58', 'PUMP 04'],
      lines: [
        { text: 'UNLEADED REGULAR', detail: '11.482 GAL @ $3.599/GAL', amount: '41.32' },
      ],
      totals: [['TOTAL', '$41.32'], ['CASH', '$50.00'], ['CHANGE', '$8.68']],
      footer: ['TAXES INCLUDED IN PRICE', 'DRIVE SAFE'],
    },
    reply: {
      merchant: 'METRO FUEL #212',
      date: '2026-09-29',
      currency: 'USD',
      items: [{ name: 'Unleaded Regular 11.482 gal', qty: 1, price: '41.32' }],
      subtotal: null,
      tax: null,
      total: '41.32',
      category: 'Gas/Fuel',
      payment_method: 'CASH',
    },
  },
  {
    id: 'cafe-lumiere',
    file: 'samples/cafe-lumiere.jpg',
    label: 'Paris café (EUR)',
    style: 'cafe',
    printed: {
      title: 'Café Lumière',
      header: ['12 rue des Martyrs', '75009 Paris', 'SIRET 812 345 678 00019'],
      meta: ['24.09.2026   10:21', 'Ticket n° 0458   Caisse 1'],
      lines: [
        { text: 'Café crème', amount: '4,50 €' },
        { text: 'Croissant', detail: '2 x 2,60 €', amount: '5,20 €' },
        { text: "Jus d'orange pressé", amount: '5,00 €' },
      ],
      totals: [['TOTAL TTC', '14,70 €'], ['dont TVA 10 %', '1,34 €']],
      footer: ['CB VISA sans contact', 'Merci et à bientôt !'],
    },
    reply: {
      merchant: 'Café Lumière',
      date: '24.09.2026',
      currency: '€',
      items: [
        { name: 'Café crème', qty: 1, price: '4,50' },
        { name: 'Croissant', qty: 2, price: '5,20' },
        { name: "Jus d'orange pressé", qty: 1, price: '5,00' },
      ],
      subtotal: null,
      tax: '1,34',
      total: '14,70 €',
      category: 'Food & Drink',
      payment_method: 'CB Visa contactless',
    },
  },
  {
    id: 'citycare-pharmacy',
    file: 'samples/citycare-pharmacy.jpg',
    label: 'Pharmacy, Apple Pay',
    style: 'thermal',
    printed: {
      title: 'CITYCARE PHARMACY',
      header: ['501 Market St', 'San Francisco, CA 94105'],
      meta: ['09/30/2026 12:07 PM', 'Cashier: Dana'],
      lines: [
        { text: 'IBUPROFEN 200MG 100CT', amount: '8.99' },
        { text: 'VITAMIN D3 2000IU', amount: '11.49' },
        { text: 'BANDAGES ASSORTED', amount: '4.79' },
        { text: 'HAND SANITIZER 8OZ', detail: '2 @ 2.49', amount: '4.98' },
      ],
      totals: [['SUBTOTAL', '30.25'], ['TAX 6.5%', '1.97'], ['TOTAL', '$32.22']],
      footer: ['APPLE PAY  ****7730', 'REWARDS EARNED: 32 PTS', 'FEEL BETTER SOON'],
    },
    reply: {
      merchant: 'CityCare Pharmacy',
      date: '09/30/2026',
      currency: 'USD',
      items: [
        { name: 'Ibuprofen 200mg 100ct', qty: 1, price: '8.99' },
        { name: 'Vitamin D3 2000IU', qty: 1, price: '11.49' },
        { name: 'Bandages Assorted', qty: 1, price: '4.79' },
        { name: 'Hand Sanitizer 8oz', qty: 2, price: '4.98' },
      ],
      subtotal: '30.25',
      tax: '1.97',
      total: '32.22',
      category: 'Pharmacy',
      payment_method: 'Apple Pay',
    },
  },
  {
    id: 'volt-electronics',
    file: 'samples/volt-electronics.jpg',
    label: 'Electronics (missed line)',
    style: 'thermal',
    printed: {
      title: 'VOLT ELECTRONICS',
      header: ['Riverside Mall, Unit 42', 'Austin, TX 78701'],
      meta: ['10/01/2026  16:30', 'Order 7731-0042'],
      lines: [
        { text: 'USB-C CABLE 2M', amount: '14.99' },
        { text: 'WIRELESS EARBUDS PRO', amount: '59.99' },
        { text: 'PHONE CASE CLEAR', amount: '19.99' },
        { text: 'MEMBER DISCOUNT', amount: '-10.00' },
      ],
      totals: [['SUBTOTAL', '84.97'], ['TAX 8.25%', '7.01'], ['TOTAL', '$91.98']],
      footer: ['MASTERCARD ****1093', 'RETURNS WITHIN 30 DAYS WITH RECEIPT'],
    },
    // The model skipped the discount line, so the review screen flags a mismatch.
    reply: {
      merchant: 'Volt Electronics',
      date: '10/01/2026',
      currency: 'USD',
      items: [
        { name: 'USB-C Cable 2m', qty: 1, price: '14.99' },
        { name: 'Wireless Earbuds Pro', qty: 1, price: '59.99' },
        { name: 'Phone Case Clear', qty: 1, price: '19.99' },
      ],
      subtotal: '84.97',
      tax: '7.01',
      total: '$91.98',
      category: 'Electronics',
      payment_method: 'MASTERCARD ****1093',
    },
  },
];
