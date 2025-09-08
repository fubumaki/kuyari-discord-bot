import { anthropicStream } from './anthropic';
import { geminiStream } from './gemini';
import { openStream } from './open';
import { openaiStream } from './openai';
import { briefSystemTemplate } from './template';
import type { GenerateStreamOptions, LLMProvider, TokenStream } from './types';

export * from './types';
export * from './template';

export function generateStream(opts: Omit<GenerateStreamOptions, 'system'> & { system?: string }): TokenStream {
  const system = opts.system ?? briefSystemTemplate(opts.maxSentences ?? 2);
  const args = { ...opts, system } as GenerateStreamOptions;
  switch (normalizeProvider(opts.provider)) {
    case 'openai':
      return openaiStream(args);
    case 'anthropic':
      return anthropicStream(args);
    case 'gemini':
      return geminiStream(args);
    case 'open':
    default:
      return openStream(args);
  }
}

function normalizeProvider(p: LLMProvider): LLMProvider {
  return p as LLMProvider;
}

