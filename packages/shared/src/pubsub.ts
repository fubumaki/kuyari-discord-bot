import Redis from 'ioredis';

// Create a single Redis client for publishing messages. In a real application,
// you might want to reuse this client across modules or use a connection
// pool.
const redis = new Redis(process.env.REDIS_URL as string);

/**
 * Publishes a message on a Redis channel. Use this helper to notify other services
 * (e.g. the bot) of changes such as entitlement updates. Consumers should
 * subscribe with patterns like `entitlement:changed:*` and invalidate caches
 * appropriately.
 */
export function publish(channel: string, message: unknown) {
  // Serialize the message as JSON. The subscriber must parse if needed.
  redis.publish(channel, JSON.stringify(message)).catch((err) => {
    console.error('Failed to publish message on channel', channel, err);
  });
}
