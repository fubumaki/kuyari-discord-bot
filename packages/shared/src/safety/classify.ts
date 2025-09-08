export type SafetyCategory = 'illegal' | 'hate' | 'harassment' | 'sexual' | 'violence' | 'self_harm' | 'profanity';

export interface SafetyFlags {
  [k: string]: number; // 0-10 severity per category
}

const ILLEGAL_WORDS = [
  'child sexual', 'csam', 'bomb recipe', 'make a bomb', 'sell drugs', 'hire a hitman',
];
const HATE_WORDS = ['kill all', 'gas the', 'nazi', 'kkk'];
const HARASS_WORDS = ['idiot', 'moron', 'stupid'];
const SEXUAL_WORDS = ['sex', 'porn', 'nsfw'];
const VIOLENCE_WORDS = ['kill', 'murder', 'stab'];
const SELF_HARM_WORDS = ['suicide', 'kill myself'];
const PROFANITY_WORDS = ['fuck', 'shit', 'bitch'];

function score(text: string, words: string[], base = 5): number {
  const lower = text.toLowerCase();
  let s = 0;
  for (const w of words) if (lower.includes(w)) s = Math.max(s, base);
  return s;
}

export function classify(content: string): SafetyFlags {
  return {
    illegal: score(content, ILLEGAL_WORDS, 10),
    hate: score(content, HATE_WORDS, 7),
    harassment: score(content, HARASS_WORDS, 6),
    sexual: score(content, SEXUAL_WORDS, 6),
    violence: score(content, VIOLENCE_WORDS, 6),
    self_harm: score(content, SELF_HARM_WORDS, 8),
    profanity: score(content, PROFANITY_WORDS, 3),
  } as SafetyFlags;
}

