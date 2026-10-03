import { CATEGORY_LABELS } from '../models';
import { formatMoney } from '../parse';
import { ExtractInput, InsightsInput } from '../prompts';
import { SAMPLES } from '../demo/samples';
import { LlmProvider, LlmRequest } from './llm-provider';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Rule-based spending commentary, so Demo mode gives real, data-driven insights. */
export function demoInsights(i: InsightsInput): string {
  const money = (n: number) => formatMoney(n, i.currency);
  const out: string[] = [];
  if (!i.total) return `- No spending recorded for ${i.monthLabel} yet. Scan a receipt or add one manually to get started.`;

  const projected = i.progress > 0 && i.progress < 1 ? i.total / i.progress : i.total;
  if (i.budget) {
    const pct = Math.round((i.total / i.budget) * 100);
    out.push(i.total > i.budget
      ? `- You have spent ${money(i.total)}, which is ${money(i.total - i.budget)} over your ${money(i.budget)} budget.`
      : i.progress < 1 && projected > i.budget
        ? `- ${pct}% of your budget is used with ${Math.round((1 - i.progress) * 100)}% of the month left. At this pace you would end near ${money(projected)}, above the ${money(i.budget)} budget.`
        : `- ${money(i.total)} spent, ${pct}% of your ${money(i.budget)} budget. You are on track.`);
  } else {
    out.push(`- ${money(i.total)} spent in ${i.monthLabel}. Set budgets in Settings to track progress against a target.`);
  }

  const top = i.categories[0];
  if (top) out.push(`- ${CATEGORY_LABELS[top.category]} is your biggest category at ${money(top.total)} (${Math.round((top.total / i.total) * 100)}% of spending).`);

  const risky = i.categories
    .filter((c) => c.budget && c.total / c.budget >= 0.85)
    .sort((a, b) => b.total / b.budget - a.total / a.budget)[0];
  if (risky) {
    out.push(risky.total > risky.budget
      ? `- ${CATEGORY_LABELS[risky.category]} is over budget by ${money(risky.total - risky.budget)}.`
      : `- ${CATEGORY_LABELS[risky.category]} has used ${Math.round((risky.total / risky.budget) * 100)}% of its budget.`);
  }

  if (i.previousTotal && i.progress >= 1) {
    const change = (i.total - i.previousTotal) / i.previousTotal;
    out.push(`- That is ${Math.abs(Math.round(change * 100))}% ${change >= 0 ? 'more' : 'less'} than the month before (${money(i.previousTotal)}).`);
  }

  const frequent = [...i.merchants].sort((a, b) => b.count - a.count)[0];
  if (frequent && frequent.count >= 4) {
    out.push(`- Saving idea: ${frequent.count} visits to ${frequent.merchant} added up to ${money(frequent.total)}. Cutting a quarter of them would save about ${money(frequent.total / 4)}.`);
  } else if (top) {
    out.push(`- Saving idea: set a weekly cap for ${CATEGORY_LABELS[top.category].toLowerCase()} of ${money((top.total / Math.max(i.progress, 0.25)) / 4.3 * 0.9)} to trim about 10%.`);
  }
  return out.slice(0, 5).join('\n');
}

/** Offline provider: returns pre-extracted data for the bundled samples and rule-based insights. */
export class DemoProvider implements LlmProvider {
  constructor(private readonly delayMs = 700) {}

  async complete(req: LlmRequest): Promise<string> {
    await sleep(this.delayMs);
    if (req.task === 'extract') {
      const sample = SAMPLES.find((s) => s.id === (req.input as ExtractInput | undefined)?.sampleId);
      // Without a vision model the demo cannot read arbitrary photos: return an empty receipt to fill in.
      return JSON.stringify(sample?.reply ?? { merchant: null, date: null, items: [], total: null });
    }
    if (req.task === 'insights') return demoInsights(req.input as InsightsInput);
    return '{"ok":true}';
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const text = req.task === 'insights' ? demoInsights(req.input as InsightsInput) : await this.complete(req);
    for (const piece of text.match(/\S+\s*/g) ?? []) {
      if (signal?.aborted) return;
      await sleep(this.delayMs / 25);
      yield piece;
    }
  }
}
