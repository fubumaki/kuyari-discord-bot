import 'dotenv/config';
import { db } from '@kuyari/db';
import { getEntitlement, initEntitlementSubscription } from '@kuyari/shared';

// Use your real Discord Guild (Server) ID
const DISCORD_GUILD_ID = process.env.TEST_GUILD_ID || '1178092238681677966';

async function main() {
  // Start Redis subscription so cache invalidations happen
  await initEntitlementSubscription();

  // Ensure a guild row exists for this Discord server
  const guild = await db.guilds.upsertByDiscordId(DISCORD_GUILD_ID);

  // Upsert entitlement (plan + caps). This triggers pub/sub in your shared code.
  await db.guildEntitlements.upsert({
    where: { guild_id: guild.id },
    create: { plan: 'premium', caps: { seats: 5, models: 3 } },
    update: { plan: 'premium', caps: { seats: 5, models: 3 } }
  });

  // Read back via the shared cache API (should populate Redis)
  const ent = await getEntitlement(DISCORD_GUILD_ID);
  console.log('Entitlement (from cache/db):', ent);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});