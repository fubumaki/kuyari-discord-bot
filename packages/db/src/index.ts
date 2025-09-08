import pkg from "pg";
const { Pool } = pkg;

type Plan = "basic" | "premium" | "pro";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await pool.query(text, params as any);
  return res.rows as T[];
}

export const db = {
  guilds: {
    async findUnique(args: { where: { discord_guild_id?: string; id?: string } }) {
      const { where } = args;
      if (where.discord_guild_id) {
        const rows = await query(
          "SELECT id, discord_guild_id, created_at FROM guilds WHERE discord_guild_id = $1",
          [where.discord_guild_id]
        );
        return rows[0] ?? null;
      }
      if (where.id) {
        const rows = await query(
          "SELECT id, discord_guild_id, created_at FROM guilds WHERE id = $1",
          [where.id]
        );
        return rows[0] ?? null;
      }
      return null;
    },

    // Always returns a row with a valid id (uses RETURNING)
    async upsertByDiscordId(discord_guild_id: string) {
      const rows = await query(
        `
        INSERT INTO guilds (discord_guild_id)
        VALUES ($1)
        ON CONFLICT (discord_guild_id) DO UPDATE
          SET discord_guild_id = EXCLUDED.discord_guild_id
        RETURNING id, discord_guild_id, created_at
        `,
        [discord_guild_id]
      );
      return rows[0];
    },

    async update(args: { where: { id: string }; data: { plan?: Plan; planStatus?: string } }) {
      const sets: string[] = [];
      const params: any[] = [args.where.id];
      if (args.data.plan) {
        sets.push(`plan = $${params.length + 1}`);
        params.push(args.data.plan);
      }
      if (args.data.planStatus) {
        sets.push(`plan_status = $${params.length + 1}`);
        params.push(args.data.planStatus);
      }
      sets.push(`updated_at = now()`);
      const rows = await query(
        `
        UPDATE guilds
           SET ${sets.join(", ")}
         WHERE id = $1
        RETURNING id, discord_guild_id, plan, plan_status, updated_at
        `,
        params
      );
      return rows[0];
    },
  },

  guildEntitlements: {
    async findUnique(args: { where: { guildId: string } }) {
      const rows = await query(
        "SELECT guild_id, plan, caps, updated_at FROM guild_entitlements WHERE guild_id = $1",
        [args.where.guildId]
      );
      return rows[0] ?? null;
    },

    // Upsert by guild_id. If no row, creates one; otherwise updates.
    async upsert(args: {
      where: { guildId: string };
      create: { plan: Plan; caps?: unknown };
      update: { plan?: Plan; caps?: unknown };
    }) {
      const guild_id = args.where.guildId;
      const plan = (args.create?.plan ?? args.update?.plan ?? "basic") as Plan;
      const caps = (args.create?.caps ?? args.update?.caps ?? {}) as unknown;

      const rows = await query(
        `
        INSERT INTO guild_entitlements (guild_id, plan, caps, updated_at)
        VALUES ($1, $2, $3::jsonb, now())
        ON CONFLICT (guild_id) DO UPDATE
          SET plan = EXCLUDED.plan,
              caps = EXCLUDED.caps,
              updated_at = now()
        RETURNING guild_id, plan, caps, updated_at
        `,
        [guild_id, plan, JSON.stringify(caps)]
      );
      return rows[0];
    },

    async update(args: {
      where: { guildId: string };
      data: { plan?: Plan; caps?: unknown };
    }) {
      const sets: string[] = [];
      const params: any[] = [args.where.guildId];

      if (args.data.plan) {
        sets.push(`plan = $${params.length + 1}`);
        params.push(args.data.plan);
      }
      if ("caps" in args.data) {
        sets.push(`caps = $${params.length + 1}::jsonb`);
        params.push(JSON.stringify(args.data.caps ?? {}));
      }
      sets.push(`updated_at = now()`);

      const rows = await query(
        `
        UPDATE guild_entitlements
           SET ${sets.join(", ")}
         WHERE guild_id = $1
        RETURNING guild_id, plan, caps, updated_at
        `,
        params
      );
      return rows[0];
    },
  },

  guildLLMConfigs: {
    async findUnique(args: { where: { guildId: string } }) {
      const rows = await query(
        `SELECT guild_id, provider, model, enc_key_cipher, updated_at, created_at
           FROM guild_llm_configs WHERE guild_id = $1`,
        [args.where.guildId]
      );
      return rows[0] ?? null;
    },
    async upsert(args: { where: { guildId: string }; create: { provider: string; model: string; encKeyCipher?: string | null } }) {
      const { guildId } = args.where;
      const { provider, model, encKeyCipher } = args.create;
      const rows = await query(
        `INSERT INTO guild_llm_configs (guild_id, provider, model, enc_key_cipher)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (guild_id) DO UPDATE
           SET provider = EXCLUDED.provider,
               model = EXCLUDED.model,
               enc_key_cipher = EXCLUDED.enc_key_cipher,
               updated_at = NOW()
         RETURNING guild_id, provider, model, enc_key_cipher, updated_at, created_at`,
        [guildId, provider, model, encKeyCipher ?? null]
      );
      return rows[0] ?? null;
    },
    async update(args: { where: { guildId: string }; data: { provider?: string; model?: string; encKeyCipher?: string | null } }) {
      const sets: string[] = [];
      const params: any[] = [args.where.guildId];
      if (typeof args.data.provider !== 'undefined') { params.push(args.data.provider); sets.push(`provider = $${params.length}`); }
      if (typeof args.data.model !== 'undefined')     { params.push(args.data.model);     sets.push(`model = $${params.length}`); }
      if (typeof args.data.encKeyCipher !== 'undefined') { params.push(args.data.encKeyCipher); sets.push(`enc_key_cipher = $${params.length}`); }
      sets.push('updated_at = NOW()');
      const rows = await query(
        `UPDATE guild_llm_configs SET ${sets.join(', ')} WHERE guild_id = $1
         RETURNING guild_id, provider, model, enc_key_cipher, updated_at, created_at`,
        params
      );
      return rows[0] ?? null;
    },
  },

  subscriptions: {
    async upsert(args: {
      where: { stripeSubscriptionId: string };
      create: { guildId: string; stripeSubscriptionId: string; status?: string; plan?: string; validFrom?: Date | null; validTo?: Date | null };
      update: { status?: string; plan?: string; validFrom?: Date | null; validTo?: Date | null };
    }) {
      const sId = args.where.stripeSubscriptionId;
      const data = { ...args.create, ...args.update };
      const rows = await query(
        `
        INSERT INTO subscriptions (guild_id, stripe_subscription_id, status, plan, valid_from, valid_to)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (stripe_subscription_id) DO UPDATE
          SET status = EXCLUDED.status,
              plan = EXCLUDED.plan,
              valid_from = EXCLUDED.valid_from,
              valid_to = EXCLUDED.valid_to
        RETURNING id, guild_id, stripe_subscription_id, status, plan, valid_from, valid_to
        `,
        [data.guildId, sId, data.status ?? null, data.plan ?? null, data.validFrom ?? null, data.validTo ?? null]
      );
      return rows[0] ?? null;
    },
    async findUnique(args: { where: { stripeSubscriptionId: string } }) {
      const rows = await query(
        `SELECT id, guild_id, stripe_subscription_id, status, plan, valid_from, valid_to
           FROM subscriptions
          WHERE stripe_subscription_id = $1`,
        [args.where.stripeSubscriptionId]
      );
      return rows[0] ?? null;
    },
  },

  guildApiKeys: {
    async upsert(args: { where: { guildId: string; provider: string }; create: { keyCipher: string } }) {
      const { guildId, provider } = args.where;
      const { keyCipher } = args.create;
      const rows = await query(
        `
        INSERT INTO guild_api_keys (guild_id, provider, key_cipher)
        VALUES ($1, $2, $3)
        ON CONFLICT (guild_id, provider) DO UPDATE
          SET key_cipher = EXCLUDED.key_cipher,
              created_at = NOW()
        RETURNING id, guild_id, provider, key_cipher, created_at
        `,
        [guildId, provider, keyCipher]
      );
      return rows[0] ?? null;
    },
    async findLatest(args: { where: { guildId: string; provider: string } }) {
      const { guildId, provider } = args.where;
      const rows = await query(
        `SELECT id, guild_id, provider, key_cipher, created_at
           FROM guild_api_keys
          WHERE guild_id = $1 AND provider = $2
          ORDER BY id DESC
          LIMIT 1`,
        [guildId, provider]
      );
      return rows[0] ?? null;
    },
    async delete(args: { where: { guildId: string; provider: string } }) {
      const { guildId, provider } = args.where;
      await query(`DELETE FROM guild_api_keys WHERE guild_id = $1 AND provider = $2`, [guildId, provider]);
    },
  },

  userPrefs: {
    async get(args: { where: { userId: string; guildId: string } }) {
      const rows = await query(
        `SELECT user_id, guild_id, moderation_level, updated_at
           FROM user_prefs WHERE user_id = $1 AND guild_id = $2`,
        [args.where.userId, args.where.guildId]
      );
      return rows[0] ?? null;
    },
    async upsert(args: { where: { userId: string; guildId: string }; create: { moderationLevel: number } }) {
      const { userId, guildId } = args.where;
      const { moderationLevel } = args.create;
      const rows = await query(
        `INSERT INTO user_prefs (user_id, guild_id, moderation_level)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id, guild_id) DO UPDATE
           SET moderation_level = EXCLUDED.moderation_level,
               updated_at = NOW()
         RETURNING user_id, guild_id, moderation_level, updated_at`,
        [userId, guildId, moderationLevel]
      );
      return rows[0] ?? null;
    },
  },
};

export type DB = typeof db;
