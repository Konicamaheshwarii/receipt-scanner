import { DestroyRef, ElementRef, afterNextRender, inject, signal } from '@angular/core';

/** Round axis ticks (0, 50, 100...) that cover `max` in about `count` steps. */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const polar = (cx: number, cy: number, r: number, a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];

/** Donut segment from angle a0 to a1 (radians, clockwise from 12 o'clock). */
export function arcPath(cx: number, cy: number, r: number, inner: number, a0: number, a1: number): string {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4; // a full ring needs two arcs; nudge it
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const [x2, y2] = polar(cx, cy, inner, a1);
  const [x3, y3] = polar(cx, cy, inner, a0);
  const f = (n: number) => n.toFixed(2);
  return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${inner} ${inner} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

/** Column with a rounded data end (top) and a square base. */
export function columnPath(x: number, y: number, w: number, h: number, radius = 4): string {
  if (h <= 0) return '';
  const r = Math.min(radius, w / 2, h);
  return `M${x} ${y + h}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h}Z`;
}

/** Tracks the rendered width of the host element so charts draw at 1:1 pixels (text never shrinks). */
export function hostWidth(fallback = 600) {
  const width = signal(fallback);
  const el = inject(ElementRef<HTMLElement>);
  const destroyRef = inject(DestroyRef);
  afterNextRender(() => {
    const host = el.nativeElement as HTMLElement;
    const measure = () => { const w = Math.floor(host.clientWidth); if (w > 0) width.set(w); };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    destroyRef.onDestroy(() => ro.disconnect());
  });
  return width;
}

export interface Tip { x: number; y: number; title: string; value: string }
