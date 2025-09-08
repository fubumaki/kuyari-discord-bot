export type LLMProvider = 'openai' | 'anthropic' | 'gemini' | 'open';

export interface GenerateStreamOptions {
  provider: LLMProvider;
  model: string;
  apiKey: string;
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  // Hint to keep answers short; providers should apply a brief template
  maxSentences?: number;
}

export interface StreamMeta {
  provider: LLMProvider;
  model: string;
  firstTokenMs: number;
  totalMs: number;
  promptTokens?: number;
  completionTokens?: number;
}

export interface TokenStream extends AsyncIterable<string> {
  meta: Promise<StreamMeta>;
}

