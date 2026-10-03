import { expense } from './testing';
import { CSV_HEADER, csvCell, makeBackup, parseBackup, toCsv } from './export';

describe('CSV export', () => {
  it('quotes cells with commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('Tom, Dick & Harry')).toBe('"Tom, Dick & Harry"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('two\nlines')).toBe('"two\nlines"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(-3)).toBe('-3');
  });

  it('neutralises spreadsheet formulas in text cells', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell('+1')).toBe("'+1");
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('writes a header and one row per expense, oldest first', () => {
    const a = { ...expense('2026-09-10', 16.74, 'dining', 'Trattoria, Bella'), subtotal: 15.5, tax: 1.24,
      items: [{ name: 'Pizza', qty: 1, price: 10 }, { name: 'Water', qty: 2, price: 5.5 }] };
    const b = expense('2026-09-01', 4, 'groceries', 'Corner');
    const lines = toCsv([a, b]).trimEnd().split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines[1]).toBe('2026-09-01,Corner,groceries,card,USD,,,,4,,');
    expect(lines[2]).toBe('2026-09-10,"Trattoria, Bella",dining,card,USD,15.5,1.24,,16.74,Pizza 10.00; 2 x Water 5.50,');
  });
});

describe('JSON backup', () => {
  it('round-trips expenses and budgets', () => {
    const list = [expense('2026-09-01', 4), expense('2026-09-02', 5, 'dining')];
    const restored = parseBackup(JSON.stringify(makeBackup(list, { dining: 200 })));
    expect(restored.expenses).toEqual(list);
    expect(restored.budgets).toEqual({ dining: 200 });
    expect(restored.skipped).toBe(0);
  });

  it('skips invalid entries and cleans unknown values', () => {
    const restored = parseBackup(JSON.stringify({
      app: 'receipto', version: 1, budgets: { dining: 'lots' },
      expenses: [
        { id: 'ok', date: '2026-09-01', total: '9.99', category: 'nonsense', payment: 'barter', currency: 'usd', thumbnail: 'javascript:alert(1)' },
        { id: 'bad-date', date: 'yesterday', total: 1 },
        { date: '2026-09-01', total: 1 },
      ],
    }));
    expect(restored.skipped).toBe(2);
    expect(restored.expenses[0]).toEqual(jasmine.objectContaining({ id: 'ok', total: 9.99, category: 'other', payment: 'other', currency: 'USD' }));
    expect(restored.budgets).toEqual({});
  });

  it('rejects files that are not Receipto backups', () => {
    expect(() => parseBackup('not json')).toThrowError(/not valid JSON/);
    expect(() => parseBackup('{"expenses":[]}')).toThrowError(/not a Receipto backup/);
  });
});
