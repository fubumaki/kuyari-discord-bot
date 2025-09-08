import { encryptSecret, decryptSecret } from './crypto';
import { db } from '@kuyari/db';

export async function saveGuildApiKey(guildId: string, provider: string, rawKey: string): Promise<void> {
	const keyCipher = encryptSecret(rawKey);
	await db.guildApiKeys.upsert({ where: { guildId, provider }, create: { keyCipher } });
}

export async function loadGuildApiKey(guildId: string, provider: string): Promise<string | null> {
	const row = await db.guildApiKeys.findLatest({ where: { guildId, provider } });
	if (!row) return null;
	return decryptSecret(row.key_cipher as string);
}


