import type { SafetyFlags } from './classify';

export function isIllegal(flags: SafetyFlags): boolean {
  return (flags['illegal'] ?? 0) >= 1;
}

export function refusalMessage(): string {
  return 'I can’t help with that. If you have another question, I’m happy to help.';
}

export function applyMasking(content: string, level: number): string {
  if (level <= 0) return content;
  // Mild profanity masking for level >= 5
  if (level >= 5) {
    return content
      .replace(/fuck/gi, 'f**k')
      .replace(/shit/gi, 's**t')
      .replace(/bitch/gi, 'b***h');
  }
  return content;
}

