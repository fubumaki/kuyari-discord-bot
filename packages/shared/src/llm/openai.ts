import { parseSSELines } from './sse';
import type { GenerateStreamOptions, TokenStream, StreamMeta } from './types';

export function openaiStream(opts: GenerateStreamOptions): TokenStream {
  const start = Date.now();
  let firstTokenAt: number | null = null;
  let textOutTokens = 0;

  const controller = new AbortController();

  const stream: AsyncIterable<string> & { meta: Promise<StreamMeta> } = {
    async *[Symbol.asyncIterator]() {
      const system = opts.system ?? `You are concise. Keep replies under ${opts.maxSentences ?? 2} sentences.`;
      const body = {
        model: opts.model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 256,
        stream: true,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: opts.prompt },
        ],
      } as any;

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${opts.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await safeText(res);
        throw new Error(`openai_http_${res.status}` + (msg ? `:${msg}` : ''));
      }

      const reader = res.body.getReader();
      for await (const data of parseSSELines(reader)) {
        // Each data is JSON with choices[0].delta.content
        try {
          const json = JSON.parse(data);
          const delta = json?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            if (firstTokenAt === null) firstTokenAt = Date.now();
            textOutTokens += delta.length;
            yield delta as string;
          }
        } catch {
          // ignore bad lines
        }
      }
    },
    meta: (async () => ({
      provider: 'openai',
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

