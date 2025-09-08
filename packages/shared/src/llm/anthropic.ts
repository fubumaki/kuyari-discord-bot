import { parseSSELines } from './sse';
import type { GenerateStreamOptions, TokenStream, StreamMeta } from './types';

export function anthropicStream(opts: GenerateStreamOptions): TokenStream {
  const start = Date.now();
  let firstTokenAt: number | null = null;
  let textOutTokens = 0;

  const controller = new AbortController();

  const stream: AsyncIterable<string> & { meta: Promise<StreamMeta> } = {
    async *[Symbol.asyncIterator]() {
      const system = opts.system ?? `You are concise. Keep replies under ${opts.maxSentences ?? 2} sentences.`;
      const body = {
        model: opts.model,
        max_tokens: opts.maxTokens ?? 256,
        temperature: opts.temperature ?? 0.3,
        system,
        messages: [
          { role: 'user', content: opts.prompt },
        ],
        stream: true,
      } as any;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const msg = await safeText(res);
        throw new Error(`anthropic_http_${res.status}` + (msg ? `:${msg}` : ''));
      }
      const reader = res.body.getReader();
      for await (const data of parseSSELines(reader)) {
        try {
          const evt = JSON.parse(data);
          if (evt.type === 'content_block_delta' && evt.delta?.text) {
            if (firstTokenAt === null) firstTokenAt = Date.now();
            const delta: string = evt.delta.text;
            textOutTokens += delta.length;
            yield delta;
          }
        } catch {
          // ignore invalid lines
        }
      }
    },
    meta: (async () => ({
      provider: 'anthropic',
      model: opts.model,
      firstTokenMs: firstTokenAt ? firstTokenAt - start : -1,
      totalMs: Date.now() - start,
      completionTokens: textOutTokens,
    }))(),
  } as any;

  return stream as TokenStream;
}

async function safeText(res: Response) {
  try { return await res.text(); } catch { return ''; }
}

