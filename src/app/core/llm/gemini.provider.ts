import { LlmProvider, LlmRequest, readSse, toLlmError } from './llm-provider';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiProvider implements LlmProvider {
  constructor(private readonly apiKey: string, private readonly model: string) {}

  /** Request body; images go first as inline base64 parts, then the instruction text. */
  static body(req: LlmRequest): string {
    return JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{
        role: 'user',
        parts: [
          ...(req.images ?? []).map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
          { text: req.prompt },
        ],
      }],
      generationConfig: {
        temperature: req.json ? 0.1 : 0.6,
        ...(req.json ? { responseMimeType: 'application/json' } : {}),
      },
    });
  }

  private headers() {
    return { 'content-type': 'application/json', 'x-goog-api-key': this.apiKey };
  }

  private static text(chunk: any): string {
    return (chunk?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? '').join('');
  }

  async complete(req: LlmRequest, signal?: AbortSignal): Promise<string> {
    const res = await fetch(`${BASE}/${this.model}:generateContent`, {
      method: 'POST', headers: this.headers(), body: GeminiProvider.body(req), signal,
    });
    if (!res.ok) throw await toLlmError(res, 'Gemini');
    return GeminiProvider.text(await res.json());
  }

  async *stream(req: LlmRequest, signal?: AbortSignal): AsyncIterable<string> {
    const res = await fetch(`${BASE}/${this.model}:streamGenerateContent?alt=sse`, {
      method: 'POST', headers: this.headers(), body: GeminiProvider.body(req), signal,
    });
    if (!res.ok) throw await toLlmError(res, 'Gemini');
    for await (const data of readSse(res)) {
      const text = GeminiProvider.text(JSON.parse(data));
      if (text) yield text;
    }
  }
}
