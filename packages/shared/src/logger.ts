type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const DEFAULT_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

const SECRET_PATTERNS: Array<RegExp> = [
  /sk-[A-Za-z0-9]{20,}/g, // common API key prefix
  /rk-[A-Za-z0-9]{20,}/g,
  /anthropic_(?:live|test)_[A-Za-z0-9_-]{20,}/g,
  /AIza[0-9A-Za-z\-_]{20,}/g, // Google
  /hf_[A-Za-z0-9]{20,}/g, // huggingface
];

const SENSITIVE_KEYS = new Set<string>([
  'apiKey', 'key', 'secret', 'authorization', 'Authorization', 'headers', 'prompt', 'content', 'messages', 'completion', 'body', 'request', 'response', 'token', 'access_token', 'refresh_token',
]);

export function createLogger(name: string) {
  const min = LEVELS[DEFAULT_LEVEL] ?? LEVELS.info;
  const base = { svc: name };

  function log(level: LogLevel, msg: string, meta?: unknown) {
    if ((LEVELS[level] ?? 100) < min) return;
    const out = {
      t: new Date().toISOString(),
      level,
      ...base,
      msg,
      ...(meta ? { meta: scrub(meta) } : {}),
    };
    const line = safeStringify(out);
    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info': console.info(line); break;
      case 'warn': console.warn(line); break;
      case 'error': console.error(line); break;
    }
  }

  return {
    debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
    info: (msg: string, meta?: unknown) => log('info', msg, meta),
    warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
    error: (msg: string, meta?: unknown) => log('error', msg, meta),
  } as const;
}

function scrub(value: unknown, keyHint?: string): unknown {
  if (value == null) return value;
  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v));
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k) || isLikelySensitiveKeyName(k)) {
        out[k] = redactPlaceholder(v);
      } else {
        out[k] = scrub(v, k);
      }
    }
    return out;
  }
  return '[redacted]';
}

function redactString(s: string): string {
  let red = s;
  for (const re of SECRET_PATTERNS) {
    red = red.replace(re, '[redacted]');
  }
  // Trim very long strings to avoid accidental content logging
  if (red.length > 256) red = red.slice(0, 256) + '…';
  return red;
}

function redactPlaceholder(v: unknown): string {
  if (typeof v === 'string' && v.length <= 8) return '[redacted]';
  return '[redacted]';
}

function isLikelySensitiveKeyName(k: string): boolean {
  const lower = k.toLowerCase();
  return lower.includes('key') || lower.includes('secret') || lower.includes('token') || lower.includes('auth');
}

function safeStringify(obj: unknown): string {
  try { return JSON.stringify(obj); } catch { return '{"error":"stringify_failed"}'; }
}


