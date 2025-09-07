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
    async findUnique(args: { where: { guild_id: string } }) {
      const rows = await query(
        "SELECT guild_id, plan, caps, updated_at FROM guild_entitlements WHERE guild_id = $1",
        [args.where.guild_id]
      );
      return rows[0] ?? null;
    },

    // Upsert by guild_id. If no row, creates one; otherwise updates.
    async upsert(args: {
      where: { guild_id: string };
      create: { plan: Plan; caps?: unknown };
      update: { plan?: Plan; caps?: unknown };
    }) {
      const { guild_id } = args.where;
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
      where: { guild_id: string };
      data: { plan?: Plan; caps?: unknown };
    }) {
      const sets: string[] = [];
      const params: any[] = [args.where.guild_id];

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

  subscriptions: {
    async upsert(_: any) { /* TODO: add if you create subscriptions table */ },
    async findUnique(_: any) { return null as any; },
  },
};

export type DB = typeof db;
