import type { GenerateStreamOptions, TokenStream } from './types';
import { openaiStream } from './openai';

// For "open" models (e.g., openrouter or OSS proxied APIs),
// we reuse the OpenAI-compatible streaming path. Configure base URL via env if needed.
export function openStream(opts: GenerateStreamOptions): TokenStream {
  return openaiStream(opts);
}

