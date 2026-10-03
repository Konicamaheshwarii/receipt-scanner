import { normalizeCategory, normalizePayment, parseAmount, parseCurrency, parseDate } from './parse';

describe('parseAmount', () => {
  it('reads US, European and symbol-decorated amounts', () => {
    expect(parseAmount('$1,234.56')).toBe(1234.56);
    expect(parseAmount('1.234,56 €')).toBe(1234.56);
    expect(parseAmount('4,50')).toBe(4.5);
    expect(parseAmount('1,234')).toBe(1234);
    expect(parseAmount('1.234.567')).toBe(1234567);
    expect(parseAmount('Rs. 450')).toBe(450);
    expect(parseAmount(12.346)).toBe(12.35);
  });

  it('treats parentheses, leading and trailing minus as negative (discounts)', () => {
    expect(parseAmount('(5.00)')).toBe(-5);
    expect(parseAmount('-10.00')).toBe(-10);
    expect(parseAmount('$-2.50')).toBe(-2.5);
    expect(parseAmount('12.00-')).toBe(-12);
  });

  it('returns null for anything without a number', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('n/a')).toBeNull();
    expect(parseAmount(null)).toBeNull();
    expect(parseAmount(Number.NaN)).toBeNull();
    expect(parseAmount({})).toBeNull();
  });
});

describe('parseCurrency', () => {
  it('maps symbols, prefixed dollars and codes to ISO 4217', () => {
    expect(parseCurrency('$')).toBe('USD');
    expect(parseCurrency('€')).toBe('EUR');
    expect(parseCurrency('14,70 €')).toBe('EUR');
    expect(parseCurrency('£')).toBe('GBP');
    expect(parseCurrency('₹')).toBe('INR');
    expect(parseCurrency('Rs.')).toBe('INR');
    expect(parseCurrency('C$')).toBe('CAD');
    expect(parseCurrency('A$12')).toBe('AUD');
    expect(parseCurrency('chf')).toBe('CHF');
    expect(parseCurrency('EUR 4,50')).toBe('EUR');
    expect(parseCurrency('')).toBeNull();
    expect(parseCurrency(42)).toBeNull();
  });
});

describe('parseDate', () => {
  it('reads ISO, numeric and month-name formats', () => {
    expect(parseDate('2026-09-27')).toBe('2026-09-27');
    expect(parseDate('2026-09-27T18:42:00Z')).toBe('2026-09-27');
    expect(parseDate('2026/9/7')).toBe('2026-09-07');
    expect(parseDate('09/27/2026 18:42')).toBe('2026-09-27');
    expect(parseDate('Sep 25, 2026')).toBe('2026-09-25');
    expect(parseDate('September 5th 2026')).toBe('2026-09-05');
    expect(parseDate('28 Sep 2026')).toBe('2026-09-28');
    expect(parseDate('28-Sep-26')).toBe('2026-09-28');
  });

  it('resolves day/month order from the values, the separator and the preference', () => {
    expect(parseDate('24/09/2026')).toBe('2026-09-24'); // 24 cannot be a month
    expect(parseDate('24.09.2026')).toBe('2026-09-24');
    expect(parseDate('03.04.2026')).toBe('2026-04-03'); // dots mean day-first
    expect(parseDate('03/04/2026')).toBe('2026-03-04'); // US default
    expect(parseDate('03/04/2026', 'dmy')).toBe('2026-04-03');
    expect(parseDate('03/04/26', 'dmy')).toBe('2026-04-03');
  });

  it('rejects impossible dates and non-dates', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('13/13/2026')).toBeNull();
    expect(parseDate('total 12.50')).toBeNull();
    expect(parseDate(undefined)).toBeNull();
  });
});

describe('normalizeCategory / normalizePayment', () => {
  it('maps free-text labels to known categories, using the merchant as a hint', () => {
    expect(normalizeCategory('groceries')).toBe('groceries');
    expect(normalizeCategory('Food & Drink')).toBe('dining');
    expect(normalizeCategory('Restaurant')).toBe('dining');
    expect(normalizeCategory('Gas/Fuel')).toBe('transport');
    expect(normalizeCategory('Pharmacy')).toBe('health');
    expect(normalizeCategory('Electronics')).toBe('shopping');
    expect(normalizeCategory('Utilities')).toBe('bills');
    expect(normalizeCategory('', 'Harbor View Hotel')).toBe('travel');
    expect(normalizeCategory('misc')).toBe('other');
  });

  it('recognises card, cash, wallets and transfers', () => {
    expect(normalizePayment('VISA ****4821')).toBe('card');
    expect(normalizePayment('Mastercard')).toBe('card');
    expect(normalizePayment('Apple Pay (Visa)')).toBe('mobile');
    expect(normalizePayment('UPI')).toBe('mobile');
    expect(normalizePayment('CASH')).toBe('cash');
    expect(normalizePayment('Direct debit')).toBe('bank');
    expect(normalizePayment(null)).toBe('other');
  });
});
