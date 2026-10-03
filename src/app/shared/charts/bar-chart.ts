import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { Tip, columnPath, hostWidth, niceTicks } from './geometry';

export interface BarDatum { key: string; label: string; total: number }

const H = 200;
const PAD = { top: 12, right: 6, bottom: 24, left: 46 };

/** Column chart drawn at the host's real pixel width; each column has a full-height hover/focus target. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <svg [attr.width]="width()" [attr.height]="h" [attr.viewBox]="'0 0 ' + width() + ' ' + h"
           role="group" [attr.aria-label]="label()">
        @for (t of layout().ticks; track t.v) {
          <line [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="t.y" [attr.y2]="t.y"
                stroke="var(--grid)" stroke-width="1" />
          <text class="axis-text" [attr.x]="pad.left - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.text }}</text>
        }
        <line [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="h - pad.bottom" [attr.y2]="h - pad.bottom"
              stroke="var(--axis)" stroke-width="1" />
        @for (b of layout().bars; track b.key) {
          <g class="mark" tabindex="0" role="img" [attr.aria-label]="b.aria"
             (pointerenter)="show(b)" (pointerleave)="hide()" (focus)="show(b)" (blur)="hide()">
            <rect [attr.x]="b.bandX" [attr.y]="pad.top" [attr.width]="b.bandW" [attr.height]="h - pad.top - pad.bottom"
                  [attr.fill]="active() === b.key ? 'var(--surface-2)' : 'transparent'" />
            <path [attr.d]="b.d" [attr.fill]="b.highlight ? 'var(--accent)' : color()" />
          </g>
          @if (b.showLabel) {
            <text class="axis-text" [attr.x]="b.cx" [attr.y]="h - 7" text-anchor="middle">{{ b.label }}</text>
          }
        }
      </svg>
      @if (tip(); as t) {
        <div class="chart-tip" aria-hidden="true" [style.left.px]="t.x" [style.top.px]="t.y">
          {{ t.title }}<strong>{{ t.value }}</strong>
        </div>
      }
    </div>
  `,
  styles: `:host { display: block; min-width: 0; } g.mark:focus-visible rect { stroke: var(--text); }`,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly format = input<(n: number) => string>((n) => n.toFixed(2));
  readonly compact = input<(n: number) => string>((n) => String(n));
  readonly label = input('Bar chart');
  /** Key of a bar drawn in the accent colour (e.g. today). */
  readonly highlight = input<string | null>(null);
  readonly color = input('var(--c-groceries)');
  /** Turns a datum into the tooltip title, e.g. a full date. */
  readonly title = input<(d: BarDatum) => string>((d) => d.label);

  protected readonly width = hostWidth();
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly tip = signal<Tip | null>(null);
  protected readonly active = signal<string | null>(null);

  protected readonly layout = computed(() => {
    const data = this.data();
    const w = this.width();
    const plotW = Math.max(10, w - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;
    const ticks = niceTicks(Math.max(0, ...data.map((d) => d.total)));
    const top = ticks[ticks.length - 1];
    const band = plotW / Math.max(1, data.length);
    const barW = Math.max(2, Math.min(24, band - 2));
    const labelEvery = Math.max(1, Math.ceil(30 / band));
    return {
      ticks: ticks.map((v) => ({ v, y: PAD.top + plotH - (v / top) * plotH, text: this.compact()(v) })),
      bars: data.map((d, i) => {
        const bh = (d.total / top) * plotH;
        const x = PAD.left + i * band + (band - barW) / 2;
        return {
          ...d,
          bandX: PAD.left + i * band, bandW: band, cx: x + barW / 2,
          d: columnPath(x, PAD.top + plotH - bh, barW, bh),
          tipY: PAD.top + plotH - bh,
          highlight: d.key === this.highlight(),
          showLabel: i % labelEvery === 0,
          aria: `${this.title()(d)}: ${this.format()(d.total)}`,
        };
      }),
    };
  });

  protected show(b: { key: string; cx: number; tipY: number; total: number } & BarDatum): void {
    this.active.set(b.key);
    const x = Math.min(Math.max(b.cx, 60), this.width() - 60);
    this.tip.set({ x, y: Math.max(b.tipY, 40), title: this.title()(b), value: this.format()(b.total) });
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
