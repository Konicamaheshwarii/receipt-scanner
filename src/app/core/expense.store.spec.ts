import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Clock } from './clock';
import { ExpenseStore } from './expense.store';
import { emptyDraft } from './models';
import { expense } from './testing';

class FixedClock extends Clock {
  override now(): Date {
    return new Date(2026, 9, 2, 12);
  }
}

function setup(): ExpenseStore {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), { provide: Clock, useClass: FixedClock }],
  });
  return TestBed.inject(ExpenseStore);
}

describe('ExpenseStore', () => {
  beforeEach(() => localStorage.clear());

  it('seeds three months of demo history and budgets on the first visit', () => {
    const store = setup();
    const months = new Set(store.expenses().map((e) => e.date.slice(0, 7)));
    expect([...months].sort()).toEqual(['2026-07', '2026-08', '2026-09', '2026-10']);
    expect(store.expenses().every((e) => e.source === 'demo' && e.date <= '2026-10-02')).toBeTrue();
    expect(Object.keys(store.budgets()).length).toBe(8);
    // Seeded receipts are internally consistent.
    for (const e of store.expenses()) {
      expect(Math.abs((e.subtotal ?? 0) + (e.tax ?? 0) + (e.tip ?? 0) - e.total)).withContext(e.id).toBeLessThan(0.011);
    }
  });

  it('adds, edits, deletes with undo, and persists', () => {
    localStorage.setItem('receipto.expenses', '[]');
    const store = setup();
    const draft = { ...emptyDraft('2026-10-01', 'USD'), merchant: '  Corner  ', total: 12.346, items: [{ name: '', qty: 0, price: 0 }] };
    const saved = store.add(draft, { source: 'manual' });
    expect(saved).toEqual(jasmine.objectContaining({ merchant: 'Corner', total: 12.35, items: [] }));

    store.update(saved.id, { ...draft, merchant: 'Corner Grocer', category: 'groceries' });
    expect(store.get(saved.id)!.merchant).toBe('Corner Grocer');

    store.remove(saved.id);
    expect(store.expenses().length).toBe(0);
    expect(store.lastDeleted()!.id).toBe(saved.id);
    store.undoDelete();
    expect(store.expenses().length).toBe(1);

    TestBed.tick();
    expect(JSON.parse(localStorage.getItem('receipto.expenses')!)[0].merchant).toBe('Corner Grocer');
  });

  it('merges a restored backup by id and replaces budgets', () => {
    localStorage.setItem('receipto.expenses', '[]');
    const store = setup();
    const a = expense('2026-09-01', 5);
    store.restore({ expenses: [a], budgets: {}, skipped: 0 });
    const result = store.restore({ expenses: [{ ...a, total: 6 }, expense('2026-09-02', 7)], budgets: { dining: 50 }, skipped: 0 });
    expect(result).toEqual({ added: 1, replaced: 1 });
    expect(store.expenses().map((e) => e.total)).toEqual([7, 6]);
    expect(store.budgets()).toEqual({ dining: 50 });

    store.setBudget('dining', null);
    expect(store.budgets()).toEqual({});
  });
});
