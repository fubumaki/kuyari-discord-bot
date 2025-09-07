import Redis from 'ioredis';
import { getEntitlement } from '@kuyari/shared';

// Redis client for concurrency tracking. Use separate connection from cache to avoid interference.
const redis = new Redis(process.env.REDIS_URL as string);

/**
 * Attempts to acquire a voice connection slot for the given guild. If the guild's
 * concurrency limit has been reached, this function throws an error. On success,
 * a token is added to a Redis set keyed by guild ID.
 *
 * The token should be released by calling `releaseVoiceConnection` when the
 * connection ends. Tokens have a TTL to avoid leaks in case of crashes.
 */
export async function acquireVoiceConnection(guildId: string, connectionId: string): Promise<void> {
  const ent = await getEntitlement(guildId);
  const limit = ent.caps.dj_concurrency;
  const key = `dj:${guildId}:conns`;
  const active = await redis.scard(key);
  if (active >= limit) {
    throw new Error(`This plan allows ${limit} concurrent voice connections.`);
  }
  await redis.sadd(key, connectionId);
  // Set a TTL on the set if it doesn't exist to ensure old entries expire (e.g. 1 hour)
  await redis.expire(key, 3600);
}

/**
 * Releases a previously acquired voice connection token. Should be called when
 * disconnecting from voice. If the token does not exist, this is a no-op.
 */
export async function releaseVoiceConnection(guildId: string, connectionId: string): Promise<void> {
  const key = `dj:${guildId}:conns`;
  await redis.srem(key, connectionId);
}

/**
 * Example function for connecting to voice. Calls acquireVoiceConnection and
 * should wrap the actual connection logic. You would call this from your
 * command handler when the bot is instructed to join a channel.
 */
export async function connectVoice(guildId: string, channelId: string): Promise<void> {
  const connectionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await acquireVoiceConnection(guildId, connectionId);
  try {
    // TODO: add logic to join voice channel via discord.js or Lavalink
  } catch (err) {
    // On failure, release the token
    await releaseVoiceConnection(guildId, connectionId);
    throw err;
  }
  // On successful connection, listen for end events and release token in your voice handler
}
