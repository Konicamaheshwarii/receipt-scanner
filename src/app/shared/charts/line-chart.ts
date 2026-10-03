import { ChangeDetectionStrategy, Component, computed, effect, input, signal, untracked } from '@angular/core';
import { Tip, hostWidth, niceTicks } from './geometry';

export interface LineDatum { key: string; label: string; total: number }

const H = 200;
const PAD = { top: 16, right: 18, bottom: 24, left: 46 };

/** Single-series line with a soft area, crosshair tooltip and an optional reference line (budget). */
@Component({
  selector: 'app-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart">
      <svg [attr.width]="width()" [attr.height]="h" [attr.viewBox]="'0 0 ' + width() + ' ' + h"
           role="group" [attr.aria-label]="label() + (reference() ? '. Dashed line: ' + format()(reference()!) : '')">
        @for (t of layout().ticks; track t.v) {
          <line [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="t.y" [attr.y2]="t.y" stroke="var(--grid)" />
          <text class="axis-text" [attr.x]="pad.left - 6" [attr.y]="t.y + 4" text-anchor="end">{{ t.text }}</text>
        }
        <line [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="h - pad.bottom" [attr.y2]="h - pad.bottom" stroke="var(--axis)" />
        @if (layout().ref; as r) {
          <line [attr.x1]="pad.left" [attr.x2]="width() - pad.right" [attr.y1]="r.y" [attr.y2]="r.y"
                stroke="var(--muted)" stroke-width="1" stroke-dasharray="4 4" />
        }
        <path [attr.d]="layout().area" fill="var(--accent)" opacity="0.1" />
        <path [attr.d]="layout().line" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
        @if (active() !== null) {
          <line [attr.x1]="layout().points[active()!].x" [attr.x2]="layout().points[active()!].x"
                [attr.y1]="pad.top" [attr.y2]="h - pad.bottom" stroke="var(--axis)" />
        }
        <rect [attr.x]="pad.left" [attr.y]="0" [attr.width]="width() - pad.left - pad.right" [attr.height]="h"
              fill="transparent" (pointermove)="move($event)" (pointerleave)="hide()" />
        @for (p of layout().points; track p.key; let i = $index) {
          <circle class="mark" [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="active() === i ? 6 : 4.5"
                  fill="var(--accent)" stroke="var(--surface)" stroke-width="2" tabindex="0" role="img"
                  [attr.aria-label]="p.label + ': ' + format()(p.total)"
                  (focus)="show(i)" (blur)="hide()" (pointerenter)="show(i)" (pointerleave)="hide()" />
          <text class="axis-text" [attr.x]="p.x" [attr.y]="h - 7" text-anchor="middle">{{ p.label }}</text>
        }
      </svg>
      @if (tip(); as t) {
        <div class="chart-tip" aria-hidden="true" [style.left.px]="t.x" [style.top.px]="t.y">
          {{ t.title }}<strong>{{ t.value }}</strong>
        </div>
      }
    </div>
  `,
  styles: `:host { display: block; min-width: 0; } rect { cursor: crosshair; }`,
})
export class LineChart {
  readonly data = input.required<LineDatum[]>();
  readonly format = input<(n: number) => string>((n) => n.toFixed(2));
  readonly compact = input<(n: number) => string>((n) => String(n));
  readonly label = input('Line chart');
  readonly reference = input<number | null>(null);
  readonly title = input<(d: LineDatum) => string>((d) => d.label);

  protected readonly width = hostWidth();
  protected readonly h = H;
  protected readonly pad = PAD;
  protected readonly tip = signal<Tip | null>(null);
  protected readonly active = signal<number | null>(null);

  protected readonly layout = computed(() => {
    const data = this.data();
    const w = this.width();
    const plotW = Math.max(10, w - PAD.left - PAD.right);
    const plotH = H - PAD.top - PAD.bottom;
    const ref = this.reference();
    const ticks = niceTicks(Math.max(0, ref ?? 0, ...data.map((d) => d.total)));
    const top = ticks[ticks.length - 1];
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
    const step = data.length > 1 ? plotW / (data.length - 1) : 0;
    const points = data.map((d, i) => ({ ...d, x: PAD.left + (data.length > 1 ? i * step : plotW / 2), y: y(d.total) }));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('');
    const base = PAD.top + plotH;
    const area = points.length ? `${line}L${points[points.length - 1].x} ${base}L${points[0].x} ${base}Z` : '';
    return {
      ticks: ticks.map((v) => ({ v, y: y(v), text: this.compact()(v) })),
      points, line, area, step,
      ref: ref && ref > 0 ? { y: y(ref) } : null,
    };
  });

  protected move(e: PointerEvent): void {
    const svg = (e.target as SVGElement).ownerSVGElement!;
    const box = svg.getBoundingClientRect();
    const x = e.clientX - box.left;
    const { points } = this.layout();
    let best = 0;
    points.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(points[best].x - x)) best = i; });
    this.show(best);
  }

  protected show(i: number): void {
    const p = this.layout().points[i];
    if (!p) return;
    this.active.set(i);
    this.tip.set({
      x: Math.min(Math.max(p.x, 60), this.width() - 60), y: Math.max(p.y, 44),
      title: this.title()(p), value: this.format()(p.total),
    });
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
