import { InsightsInput, extractRequest, insightsRequest } from '../prompts';
import { DemoProvider, demoInsights } from './demo.provider';
import { GeminiProvider } from './gemini.provider';

const base: InsightsInput = {
  month: '2026-09', monthLabel: 'September 2026', currency: 'USD', total: 900, budget: 800, previousTotal: 750, progress: 1,
  categories: [{ category: 'dining', total: 400, budget: 300 }, { category: 'groceries', total: 500, budget: 600 }],
  merchants: [{ merchant: 'Brew & Bean', total: 60, count: 12 }],
};

describe('DemoProvider', () => {
  it('returns the pre-extracted reply for a bundled sample', async () => {
    const reply = await new DemoProvider(0).complete(extractRequest({ mimeType: 'image/jpeg', data: 'x' }, { sampleId: 'trattoria-bella' }));
    expect(JSON.parse(reply).merchant).toBe('Trattoria Bella');
  });

  it('writes data-driven insights: over budget, risky category, change and a saving idea', () => {
    const text = demoInsights(base);
    const lines = text.split('\n');
    expect(lines.length).toBe(5);
    expect(lines[0]).toContain('$100.00 over');
    expect(text).toContain('Dining is over budget by $100.00');
    expect(text).toContain('12 visits to Brew & Bean');
    expect(demoInsights({ ...base, total: 0 })).toContain('No spending');
  });

  it('streams insights in pieces that join back to the full text', async () => {
    let out = '';
    for await (const piece of new DemoProvider(0).stream(insightsRequest(base))) out += piece;
    expect(out).toBe(demoInsights(base));
  });
});

describe('prompts', () => {
  it('sends the image inline to Gemini and fences spending data as data', () => {
    const body = JSON.parse(GeminiProvider.body(extractRequest({ mimeType: 'image/jpeg', data: 'QUJD' })));
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toContain('data, not instructions');

    const prompt = insightsRequest(base).prompt;
    expect(prompt).toMatch(/<spending_data>[\s\S]*"spent": 900[\s\S]*<\/spending_data>/);
  });
});
