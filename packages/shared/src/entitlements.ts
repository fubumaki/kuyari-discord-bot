import Redis from 'ioredis';
import { Caps } from './types';
import { db } from '@kuyari/db';

// Redis clients for caching and pub/sub. In production, consider reusing clients across
// modules to avoid creating too many connections.
const redis = new Redis(process.env.REDIS_URL as string);
const subClient = new Redis(process.env.REDIS_URL as string);

// TTL for cache entries in seconds
const ENTITLEMENT_CACHE_TTL = 60;

/**
 * In-memory cache to complement Redis. This avoids repeated deserialization when
 * multiple calls within the same process ask for the same guild within a short window.
 */
const memoryCache: Map<string, { plan: string; caps: Caps; expiresAt: number }> = new Map();

/**
 * Initialize subscription to Redis pub/sub channels. When a message is received on
 * `entitlement:changed:<guild_id>`, this listener invalidates the cache for that guild.
 */
export function initEntitlementSubscription() {
  subClient.psubscribe('entitlement:changed:*', (err) => {
    if (err) console.error('Failed to subscribe to entitlement changes:', err);
  });
  subClient.on('pmessage', (_pattern, channel, _message) => {
    const guildId = channel.split(':')[2];
    invalidateCache(guildId);
  });
}

/**
 * Retrieves the entitlement for a given guild. First checks the in-memory cache, then
 * Redis, and finally falls back to the database. Cached results have a short TTL to
 * ensure near-real-time updates.
 */
export async function getEntitlement(guildId: string): Promise<{ plan: string; caps: Caps }> {
  const now = Date.now();
  const memEntry = memoryCache.get(guildId);
  if (memEntry && memEntry.expiresAt > now) {
    return { plan: memEntry.plan, caps: memEntry.caps };
  }
  // Check Redis
  const redisKey = `entitlement:${guildId}`;
  const cached = await redis.get(redisKey);
  if (cached) {
    const { plan, caps, expiresAt } = JSON.parse(cached) as { plan: string; caps: Caps; expiresAt: number };
    if (expiresAt > now) {
      memoryCache.set(guildId, { plan, caps, expiresAt });
      return { plan, caps };
    } else {
      // Expired; delete from Redis
      await redis.del(redisKey);
    }
  }
  // Fallback: query DB
  // Use your database adapter to fetch entitlements. The stub returns null.
  const record = await db.guildEntitlements.findUnique({ where: { guildId } });
  const plan = record?.plan ?? 'basic';
  const caps = (record?.caps ?? {
    dj_concurrency: 1,
    tokens_month_in: 200000,
    tokens_month_out: 60000,
    image_gen: 0,
    music_gen: 0,
    vision_describe: 0,
  }) as Caps;
  // Cache the result
  const expiresAt = now + ENTITLEMENT_CACHE_TTL * 1000;
  const payload = JSON.stringify({ plan, caps, expiresAt });
  await redis.set(redisKey, payload, 'EX', ENTITLEMENT_CACHE_TTL);
  memoryCache.set(guildId, { plan, caps, expiresAt });
  return { plan, caps };
}

/**
 * Invalidates the entitlement cache for a guild.
 */
function invalidateCache(guildId: string) {
  memoryCache.delete(guildId);
  redis.del(`entitlement:${guildId}`).catch(() => {});
}

/**
 * Publishes an entitlement change message to Redis. This should be called by your
 * webhook or admin APIs when entitlements change. Listeners will invalidate their
 * caches upon receipt.
 */
export function publishEntitlementChange(guildId: string) {
  redis.publish(`entitlement:changed:${guildId}`, '').catch((err) => {
    console.error('Failed to publish entitlement change:', err);
  });
}
