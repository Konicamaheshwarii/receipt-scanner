import { SAMPLES } from './demo/samples';
import { parseAmount } from './parse';
import { checkTotals, extractJson, normalizeReceipt, parseReceiptReply } from './receipt-parser';

const opts = { today: '2026-10-02', defaultCurrency: 'USD' };

describe('extractJson', () => {
  it('strips code fences, think blocks and surrounding prose', () => {
    expect(extractJson('```json\n{"total": 5}\n```')).toEqual({ total: 5 });
    expect(extractJson('<think>hmm</think>Here you go: {"merchant":"A"} hope it helps')).toEqual({ merchant: 'A' });
    expect(() => extractJson('no json here')).toThrowError(/not valid JSON/);
  });
});

describe('normalizeReceipt', () => {
  it('parses strings, symbols and local formats into a typed draft', () => {
    const { draft, warnings } = parseReceiptReply(JSON.stringify({
      merchant: '  Café   Lumière ', date: '24.09.2026', currency: '€',
      items: [{ name: 'Croissant', qty: '2', price: '5,20' }, { description: 'Café crème', amount: '4,50 €' }],
      tax: '1,34', total: '9,70 €', category: 'Food & Drink', payment_method: 'CB Visa',
    }), opts);
    expect(draft).toEqual(jasmine.objectContaining({
      merchant: 'Café Lumière', date: '2026-09-24', currency: 'EUR', subtotal: null, tax: 1.34, tip: null,
      total: 9.7, category: 'dining', payment: 'card',
    }));
    expect(draft.items).toEqual([{ name: 'Croissant', qty: 2, price: 5.2 }, { name: 'Café crème', qty: 1, price: 4.5 }]);
    expect(warnings).toEqual([]);
  });

  it('repairs a missing total and subtotal, computes line totals from unit prices', () => {
    const { draft, warnings } = normalizeReceipt({
      merchant: 'Shop', date: '2026-09-01',
      items: [{ name: 'Pens', qty: 3, unit_price: '1.25' }, { name: 'Pad', price: 2 }], tax: '0.46',
    }, opts);
    expect(draft.items[0].price).toBe(3.75);
    expect(draft.total).toBe(6.21);
    expect(draft.subtotal).toBe(5.75);
    expect(warnings.join(' ')).toContain('Total was missing');
  });

  it('warns about missing merchant, unreadable date, future dates and unpriced items', () => {
    const missing = normalizeReceipt({ total: 3, items: [{ name: 'Mystery' }] }, opts);
    expect(missing.draft.date).toBe('2026-10-02');
    expect(missing.draft.items).toEqual([]);
    expect(missing.warnings.length).toBe(3);

    const future = normalizeReceipt({ merchant: 'X', date: '11/12/2026', total: 1 }, opts);
    expect(future.warnings.join(' ')).toContain('future');
  });

  it('unwraps {receipt: ...} and arrays, and rejects non-receipts', () => {
    expect(normalizeReceipt({ receipt: { merchant: 'A', total: '1.00' } }, opts).draft.merchant).toBe('A');
    expect(normalizeReceipt([{ merchant: 'B', total: 2 }], opts).draft.total).toBe(2);
    expect(() => normalizeReceipt({ error: 'not a receipt' }, opts)).toThrowError(/does not look like a receipt/);
    expect(() => normalizeReceipt('text', opts)).toThrowError(/did not return receipt data/);
  });
});

describe('checkTotals', () => {
  const items = [{ name: 'A', qty: 1, price: 10 }, { name: 'B', qty: 2, price: 5.5 }];

  it('accepts receipts whose numbers add up, including tips and tax-inclusive totals', () => {
    expect(checkTotals({ items, subtotal: 15.5, tax: 1.24, tip: null, total: 16.74 }).ok).toBeTrue();
    expect(checkTotals({ items, subtotal: 15.5, tax: 1.24, tip: 3, total: 19.74 }).ok).toBeTrue();
    expect(checkTotals({ items, subtotal: null, tax: 1.41, tip: null, total: 15.5 }).ok).toBeTrue(); // VAT included
    expect(checkTotals({ items, subtotal: null, tax: null, tip: null, total: 15.51 }).ok).toBeTrue(); // rounding
    expect(checkTotals({ items: [], subtotal: null, tax: null, tip: null, total: 40 }).ok).toBeTrue();
  });

  it('explains which numbers disagree and by how much', () => {
    const items = checkTotals({ items: [{ name: 'A', qty: 1, price: 10 }], subtotal: 12, tax: 0, tip: null, total: 12 });
    expect(items.ok).toBeFalse();
    expect(items.itemsSum).toBe(10);
    expect(items.message).toContain('Items add up to 10.00 but the subtotal is 12.00 (off by 2.00)');

    const total = checkTotals({ items: [], subtotal: 20, tax: 1.6, tip: null, total: 25 });
    expect(total.message).toContain('Subtotal + tax is 21.60 but the total is 25.00');
  });

  it('runs every bundled sample through the validator with the expected result', () => {
    for (const s of SAMPLES) {
      const { draft } = normalizeReceipt(s.reply, opts);
      const printedTotal = s.printed.totals.find(([k]) => /^total/i.test(k))![1];
      expect(draft.total).withContext(s.id).toBe(parseAmount(printedTotal)!);
      // The electronics sample deliberately misses its discount line.
      expect(checkTotals(draft).ok).withContext(s.id).toBe(s.id !== 'volt-electronics');
    }
  });
});
