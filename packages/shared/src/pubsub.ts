import Redis from 'ioredis';

// Create a Redis client for publishing messages.
// Use lazyConnect to avoid connecting during build time (e.g., Next.js build on Vercel).
const redis = new Redis(process.env.REDIS_URL as string, {
  lazyConnect: true,
  enableReadyCheck: false,
  // Do not retry aggressively during build; fail fast.
  retryStrategy: () => null,
  maxRetriesPerRequest: null,
});
redis.on('error', (err) => {
  // Prevent unhandled error events from crashing builds
  console.error('Redis(pubsub) error:', err?.message || err);
});

/**
 * Publishes a message on a Redis channel. Use this helper to notify other services
 * (e.g. the bot) of changes such as entitlement updates. Consumers should
 * subscribe with patterns like `entitlement:changed:*` and invalidate caches
 * appropriately.
 */
export async function publish(channel: string, message: unknown) {
  try {
    if (redis.status === 'wait' || redis.status === 'end') {
      await redis.connect();
    }
    await redis.publish(channel, JSON.stringify(message));
  } catch (err) {
    console.error('Failed to publish message on channel', channel, err);
  }
}
