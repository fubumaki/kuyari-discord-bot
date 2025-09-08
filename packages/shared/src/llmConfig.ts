import { db } from '@kuyari/db';
import { encryptSecret, decryptSecret } from './crypto';

export interface GuildLLMConfig {
  provider: string;
  model: string;
  encKey?: string | null; // encrypted key
}

export async function getGuildLLMConfig(guildId: string): Promise<GuildLLMConfig> {
  const row = await db.guildLLMConfigs.findUnique({ where: { guildId } });
  return {
    provider: row?.provider ?? 'anthropic',
    model: row?.model ?? 'claude-3-haiku-20240307',
    encKey: (row?.enc_key_cipher as string | undefined) ?? null,
  };
}

export async function setGuildModel(guildId: string, provider: string, model: string) {
  const row = await db.guildLLMConfigs.upsert({ where: { guildId }, create: { provider, model } });
  return { provider: row.provider as string, model: row.model as string };
}

export async function setGuildKey(guildId: string, provider: string, rawKey: string) {
  const enc = encryptSecret(rawKey);
  await db.guildLLMConfigs.upsert({ where: { guildId }, create: { provider, model: defaultModelFor(provider), encKeyCipher: enc } });
}

export async function unsetGuildKey(guildId: string) {
  // Keep provider/model; just clear key
  await db.guildLLMConfigs.update({ where: { guildId }, data: { encKeyCipher: null } });
}

export async function loadDecryptedKey(guildId: string): Promise<string | null> {
  const row = await db.guildLLMConfigs.findUnique({ where: { guildId } });
  const blob = (row?.enc_key_cipher as string | undefined) ?? null;
  if (!blob) return null;
  return decryptSecret(blob);
}

export function defaultModelFor(provider: string): string {
  if (provider === 'openai') return process.env.DEFAULT_OPENAI_MODEL || 'gpt-4o-mini';
  if (provider === 'anthropic') return process.env.DEFAULT_ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
  if (provider === 'open') return process.env.DEFAULT_OPEN_MODEL || 'mistral-small';
  if (provider === 'gemini') return process.env.DEFAULT_GEMINI_MODEL || 'models/gemini-1.5-pro-latest';
  return 'claude-3-haiku-20240307';
}

