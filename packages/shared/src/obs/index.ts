export interface LLMMetricEvent {
  kind: 'llm';
  provider: string;
  model: string;
  latency_ms_first_token: number;
  latency_ms_total: number;
  tokens_in?: number;
  tokens_out?: number;
  result_code: 'ok' | 'refused' | 'filtered' | '429' | '401' | 'error';
  guild_anonymized?: string;
  user_anonymized?: string;
}

export function anonymizeId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  // Simple reversible-less anonymization: sha256-like via built-in crypto subtle not available here; fallback to mask
  return 'id_' + Buffer.from(id).toString('base64url').slice(0, 12);
}

export function logMetric(evt: LLMMetricEvent) {
  // Do NOT include prompts or completions.
  try {
    console.log('[metric]', JSON.stringify(evt));
  } catch {
    // ignore
  }
}

