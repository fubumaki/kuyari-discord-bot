// scripts/upgrade-entitlement.ts
import 'dotenv/config';
import { db } from '@kuyari/db';
import { getEntitlement } from '@kuyari/shared';
import { publish } from '@kuyari/shared/pubsub'; // if this import fails, try: `from '@kuyari/shared'`

const DISCORD_GUILD_ID = process.env.TEST_GUILD_ID || 'YOUR_GUILD_ID_HERE';

async function main() {
  // Ensure guild exists
  const guild = await db.guilds.upsertByDiscordId(DISCORD_GUILD_ID);

  // Update entitlement in DB with the caps shape shared expects
  await db.guildEntitlements.upsert({
    where: { guild_id: guild.id },
    create: {
      plan: 'premium',
      caps: {
        dj_concurrency: 3,
        tokens_month_in: 1000000,
        tokens_month_out: 300000,
        image_gen: 25,
        music_gen: 0,
        vision_describe: 100
      }
    },
    update: {
      plan: 'premium',
      caps: {
        dj_concurrency: 3,
        tokens_month_in: 1000000,
        tokens_month_out: 300000,
        image_gen: 25,
        music_gen: 0,
        vision_describe: 100
      }
    }
  });

  // Invalidate cache via pub/sub (shared listener will clear the cache on this channel)
  await publish(`entitlement:changed:${guild.id}`, '');

  // Give Redis a tick
  await new Promise(r => setTimeout(r, 300));

  // Read again through shared (should reflect premium)
  const ent = await getEntitlement(DISCORD_GUILD_ID);
  console.log('Entitlement after upgrade:', ent);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
