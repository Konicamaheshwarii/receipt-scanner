import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { Tip, arcPath } from './geometry';

export interface Slice { key: string; label: string; value: number; color: string }

const SIZE = 200;
const R = 96;
const INNER = 64;
const GAP_PX = 2;

/** Donut with a per-segment tooltip; segments are focusable and labelled for screen readers. */
@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart donut">
      <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" role="group" [attr.aria-label]="label()">
        @if (!segments().length) {
          <circle [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="(r + inner) / 2" fill="none"
                  stroke="var(--grid)" [attr.stroke-width]="r - inner" />
        }
        @for (s of segments(); track s.key) {
          <path class="mark" [attr.d]="s.d" [attr.fill]="s.color" tabindex="0" role="img"
                [attr.aria-label]="s.label + ': ' + s.text"
                [style.opacity]="active() && active() !== s.key ? 0.45 : 1"
                (pointerenter)="show(s)" (pointerleave)="hide()" (focus)="show(s)" (blur)="hide()" />
        }
      </svg>
      <div class="center" aria-hidden="true">
        <span class="muted small">{{ centerLabel() }}</span>
        <strong>{{ centerValue() }}</strong>
      </div>
      @if (tip(); as t) {
        <div class="chart-tip" aria-hidden="true" [style.left.%]="t.x" [style.top.%]="t.y">
          {{ t.title }}<strong>{{ t.value }}</strong>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; max-width: 240px; margin: 0 auto; width: 100%; }
    .donut { position: relative; }
    .center {
      position: absolute; inset: 0; display: grid; place-content: center; text-align: center;
      pointer-events: none; line-height: 1.2;
      strong { font-size: 1.25rem; }
    }
    path { transition: opacity 120ms; }
  `,
})
export class DonutChart {
  readonly data = input.required<Slice[]>();
  readonly format = input<(n: number) => string>((n) => n.toFixed(2));
  readonly label = input('Donut chart');
  readonly centerLabel = input('');
  readonly centerValue = input('');

  protected readonly size = SIZE;
  protected readonly r = R;
  protected readonly inner = INNER;
  protected readonly tip = signal<Tip | null>(null);
  protected readonly active = signal<string | null>(null);

  protected readonly segments = computed(() => {
    const items = this.data().filter((d) => d.value > 0);
    const total = items.reduce((s, d) => s + d.value, 0);
    if (!total) return [];
    const pad = items.length > 1 ? GAP_PX / 2 / ((R + INNER) / 2) : 0;
    let angle = 0;
    return items.map((d) => {
      const sweep = (d.value / total) * Math.PI * 2;
      const a0 = angle + pad;
      const a1 = angle + sweep - pad;
      const mid = angle + sweep / 2;
      angle += sweep;
      const pct = Math.round((d.value / total) * 1000) / 10;
      return {
        ...d,
        d: arcPath(SIZE / 2, SIZE / 2, R, INNER, a0, Math.max(a1, a0 + 0.002)),
        text: `${this.format()(d.value)} (${pct}%)`,
        // tooltip anchor on the outer edge of the segment, as a % of the box
        tx: ((SIZE / 2 + (R - 8) * Math.sin(mid)) / SIZE) * 100,
        ty: ((SIZE / 2 - (R - 8) * Math.cos(mid)) / SIZE) * 100,
      };
    });
  });

  protected show(s: { key: string; label: string; text: string; tx: number; ty: number }): void {
    this.active.set(s.key);
    this.tip.set({ x: s.tx, y: s.ty, title: s.label, value: s.text });
  }

  constructor() {
    // A tooltip must never outlive the data it describes (e.g. after switching month).
    effect(() => {
      this.data();
      untracked(() => this.hide());
    });
  }

  protected hide(): void {
    this.active.set(null);
    this.tip.set(null);
  }
}
