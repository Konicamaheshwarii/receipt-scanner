import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { Clock } from './clock';
import { LlmService } from './llm/llm.service';
import { ScanStore } from './scan.store';
import { SettingsStore } from './settings.store';

class FixedClock extends Clock {
  override now(): Date {
    return new Date(2026, 9, 2, 12);
  }
}

/** A real image blob drawn on a canvas, so the compression pipeline runs for real. */
function photo(w = 2400, h = 3200): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#222';
  ctx.font = '120px monospace';
  ctx.fillText('TOTAL 12.00', 200, 600);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

describe('ScanStore', () => {
  let llm: jasmine.SpyObj<LlmService>;

  beforeEach(() => {
    localStorage.clear();
    llm = jasmine.createSpyObj<LlmService>('LlmService', ['complete', 'stream']);
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: Clock, useClass: FixedClock }, { provide: LlmService, useValue: llm }],
    });
  });

  it('downscales the photo, sends it to the model and validates the reply', async () => {
    TestBed.inject(SettingsStore).update({ provider: 'gemini', apiKeys: { gemini: 'test-key' } });
    llm.complete.and.resolveTo('```json\n{"merchant":"Corner","date":"10/01/2026","total":"$12.00","items":[{"name":"Milk","price":"12.00"}],"category":"Grocery"}\n```');
    const scan = TestBed.inject(ScanStore);

    expect(await scan.scanFile(await photo())).toBeTrue();
    const req = llm.complete.calls.mostRecent().args[0];
    expect(req.images![0].mimeType).toBe('image/jpeg');
    expect(scan.prepared()).toEqual(jasmine.objectContaining({ width: 1200, height: 1600 }));
    expect(scan.review()!.draft).toEqual(jasmine.objectContaining({ merchant: 'Corner', date: '2026-10-01', total: 12, category: 'groceries' }));
    expect(scan.review()!.thumbnail).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('in Demo mode, opens an empty draft for your own photo without calling a model', async () => {
    const scan = TestBed.inject(ScanStore);
    expect(await scan.scanFile(await photo(600, 800))).toBeTrue();
    expect(llm.complete).not.toHaveBeenCalled();
    expect(scan.review()!.warnings[0]).toContain('Demo mode cannot read your own photos');
  });

  it('reports errors and refuses non-images', async () => {
    TestBed.inject(SettingsStore).update({ provider: 'gemini', apiKeys: { gemini: 'k' } });
    llm.complete.and.resolveTo('{"error":"not a receipt"}');
    const scan = TestBed.inject(ScanStore);
    expect(await scan.scanFile(await photo(100, 100))).toBeFalse();
    expect(scan.error()).toContain('does not look like a receipt');

    expect(await scan.scanFile(new Blob(['hi'], { type: 'text/plain' }))).toBeFalse();
    expect(scan.status()).toBe('error');
  });
});
