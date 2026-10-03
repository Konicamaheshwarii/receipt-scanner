import { Injectable, inject, signal } from '@angular/core';
import { Clock } from './clock';
import { SampleReceipt } from './demo/samples';
import { PreparedImage, prepareImage } from './image';
import { LlmService } from './llm/llm.service';
import { Expense, ReceiptDraft, emptyDraft } from './models';
import { extractRequest } from './prompts';
import { parseReceiptReply } from './receipt-parser';
import { SettingsStore } from './settings.store';

export interface Review {
  draft: ReceiptDraft;
  warnings: string[];
  /** Image shown next to the form: full compressed image for new scans, thumbnail when editing. */
  image?: string;
  thumbnail?: string;
  source: Expense['source'];
  /** Set when editing a saved expense. */
  editingId?: string;
}

export type ScanStatus = 'idle' | 'preparing' | 'extracting' | 'error';

/** Runs the scan pipeline (compress -> vision model -> validate) and holds the draft being reviewed. */
@Injectable({ providedIn: 'root' })
export class ScanStore {
  private readonly llm = inject(LlmService);
  private readonly settings = inject(SettingsStore);
  private readonly clock = inject(Clock);
  private controller?: AbortController;

  readonly status = signal<ScanStatus>('idle');
  readonly error = signal('');
  readonly review = signal<Review | null>(null);
  /** Upload size info for the last scan, shown while extracting. */
  readonly prepared = signal<Pick<PreparedImage, 'width' | 'height' | 'bytes'> | null>(null);

  private options() {
    const s = this.settings.settings();
    return { today: this.clock.today(), defaultCurrency: s.currency, dateOrder: s.dateOrder };
  }

  /** Returns true when a draft is ready for review. */
  async scanFile(file: Blob): Promise<boolean> {
    return this.run(file);
  }

  async scanSample(sample: SampleReceipt): Promise<boolean> {
    try {
      const blob = await fetch(sample.file).then((r) => {
        if (!r.ok) throw new Error('Could not load the sample image.');
        return r.blob();
      });
      return this.run(blob, sample.id);
    } catch (e) {
      this.fail(e);
      return false;
    }
  }

  startManual(): void {
    this.cancel();
    this.review.set({ draft: emptyDraft(this.clock.today(), this.settings.currency()), warnings: [], source: 'manual' });
  }

  edit(expense: Expense): void {
    const { id, thumbnail, source, createdAt, ...draft } = expense;
    this.review.set({ draft: structuredClone(draft), warnings: [], image: thumbnail, thumbnail, source, editingId: id });
  }

  cancel(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.status.set('idle');
  }

  clear(): void {
    this.review.set(null);
  }

  private async run(file: Blob, sampleId?: string): Promise<boolean> {
    this.cancel();
    const controller = (this.controller = new AbortController());
    this.error.set('');
    this.status.set('preparing');
    try {
      const image = await prepareImage(file);
      this.prepared.set({ width: image.width, height: image.height, bytes: image.bytes });
      if (controller.signal.aborted) return false;

      const isDemo = this.settings.isDemo();
      if (isDemo && !sampleId) {
        // The offline demo has no vision model, so it cannot read the user's own photo.
        this.review.set({
          draft: emptyDraft(this.clock.today(), this.settings.currency()),
          warnings: ['Demo mode cannot read your own photos. Fill in the fields yourself, or add a free Gemini key in Settings to extract them automatically.'],
          image: image.dataUrl, thumbnail: image.thumbnail, source: 'scan',
        });
        this.status.set('idle');
        return true;
      }
      if (this.settings.needsKey()) throw new Error('Add your API key in Settings, or switch to Demo mode.');

      this.status.set('extracting');
      const reply = await this.llm.complete(
        extractRequest({ mimeType: image.mimeType, data: image.base64 }, { sampleId }), controller.signal);
      if (controller.signal.aborted) return false;
      const { draft, warnings } = parseReceiptReply(reply, this.options());
      this.review.set({ draft, warnings, image: image.dataUrl, thumbnail: image.thumbnail, source: 'scan' });
      this.status.set('idle');
      return true;
    } catch (e) {
      if (controller.signal.aborted) return false;
      this.fail(e);
      return false;
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }

  private fail(e: unknown): void {
    const message = e instanceof Error ? e.message : String(e);
    this.error.set(/failed to fetch|network/i.test(message) ? 'Network error. Check your connection and try again.' : message);
    this.status.set('error');
  }
}
