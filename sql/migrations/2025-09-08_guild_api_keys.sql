-- per-guild encrypted API keys

CREATE TABLE IF NOT EXISTS guild_api_keys (
	id bigserial PRIMARY KEY,
	guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
	provider text NOT NULL,
	key_cipher text NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	UNIQUE (guild_id, provider)
);



