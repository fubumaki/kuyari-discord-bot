import type { GenerateStreamOptions, TokenStream } from './types';

// Placeholder: implement Gemini streaming via Google AI SDK or SSE.
export function geminiStream(_opts: GenerateStreamOptions): TokenStream {
  throw new Error('gemini_provider_not_configured');
}

