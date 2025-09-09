import { encryptSecret, decryptSecret } from './crypto';

export type Provider = 'openai' | 'anthropic';

export async function saveGuildApiKey(guildId: string, provider: Provider, rawKey: string): Promise<void> {
	const key_cipher = encryptSecret(rawKey);
	// TODO: implement insert with your DB adapter
	// e.g., await pool.query('INSERT INTO api_keys (guild_id, provider, key_cipher) VALUES ($1,$2,$3)', [guildId, provider, key_cipher]);
	throw new Error('saveGuildApiKey not implemented');
}

export async function loadGuildApiKey(guildId: string, provider: Provider): Promise<string | null> {
	// TODO: implement select with your DB adapter
	// const row = await pool.query('SELECT key_cipher FROM api_keys WHERE guild_id=$1 AND provider=$2 ORDER BY id DESC LIMIT 1', [guildId, provider]).then(r => r.rows[0]);
	const row: any = null;
	if (!row) return null;
	return decryptSecret(row.key_cipher);
}



