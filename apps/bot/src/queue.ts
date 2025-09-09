import { Message, MessageCreateOptions, MessageEditOptions, TextBasedChannel } from 'discord.js';
import { createLogger } from '@kuyari/shared';

type Task = () => Promise<void>;

const perChannelQueues = new Map<string, Task[]>();
const perChannelBusy = new Set<string>();

// Simple token bucket per channel to pace sends/edits comfortably under limits
type Bucket = { capacity: number; tokens: number; lastRefillMs: number; refillPerSec: number };
const perChannelBuckets = new Map<string, Bucket>();

const logger = createLogger('queue');

export function sendQueued(channel: TextBasedChannel, payload: string | MessageCreateOptions) {
  const id = (channel as any).id as string;
  const queue = perChannelQueues.get(id) ?? [];
  perChannelQueues.set(id, queue);
  queue.push(async () => {
    let attempt = 0;
    while (true) {
      try {
        await takeToken(id);
        const ch: any = channel as any;
        if (typeof payload === 'string') await ch.send(payload);
        else await ch.send(payload);
        await sleep(150); // small spacing to avoid bursts
        return;
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 429) {
          const delay = Math.min(500 * Math.pow(2, attempt++), 8000) + Math.floor(Math.random() * 250);
          await sleep(delay);
          continue;
        }
        // For other errors, log and drop
        logger.error('send error', { status, err });
        return;
      }
    }
  });
  pump(id, channel);
}

export function editQueued(message: Message, payload: string | MessageEditOptions) {
  const id = (message.channel as any).id as string;
  const queue = perChannelQueues.get(id) ?? [];
  perChannelQueues.set(id, queue);
  queue.push(async () => {
    let attempt = 0;
    while (true) {
      try {
        await takeToken(id);
        if (typeof payload === 'string') await message.edit(payload);
        else await message.edit(payload);
        await sleep(150);
        return;
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 429) {
          const delay = Math.min(500 * Math.pow(2, attempt++), 8000) + Math.floor(Math.random() * 250);
          await sleep(delay);
          continue;
        }
        logger.error('edit error', { status, err });
        return;
      }
    }
  });
  pump(id, message.channel as TextBasedChannel);
}

async function pump(id: string, channel: TextBasedChannel) {
  if (perChannelBusy.has(id)) return;
  perChannelBusy.add(id);
  const q = perChannelQueues.get(id)!;
  while (q.length) {
    const t = q.shift()!;
    await t();
  }
  perChannelBusy.delete(id);
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function takeToken(channelId: string) {
  // Refill or create bucket
  let b = perChannelBuckets.get(channelId);
  const now = Date.now();
  if (!b) {
    b = { capacity: 3, tokens: 3, lastRefillMs: now, refillPerSec: 3 };
    perChannelBuckets.set(channelId, b);
  }
  // Refill tokens based on elapsed time
  const elapsedMs = now - b.lastRefillMs;
  if (elapsedMs > 0) {
    const add = (elapsedMs / 1000) * b.refillPerSec;
    b.tokens = Math.min(b.capacity, b.tokens + add);
    b.lastRefillMs = now;
  }
  // Wait until at least 1 token is available
  while (b.tokens < 1) {
    const waitMs = Math.max(50, Math.ceil(((1 - b.tokens) / b.refillPerSec) * 1000));
    await sleep(waitMs);
    const n = Date.now();
    const add2 = ((n - b.lastRefillMs) / 1000) * b.refillPerSec;
    b.tokens = Math.min(b.capacity, b.tokens + add2);
    b.lastRefillMs = n;
  }
  b.tokens -= 1;
}

export async function sendWithPacing(channel: TextBasedChannel, payload: string | MessageCreateOptions): Promise<Message> {
  const id = (channel as any).id as string;
  let attempt = 0;
  // take a token first to respect pacing
  while (true) {
    try {
      await takeToken(id);
      const ch: any = channel as any;
      return await ch.send(payload as any);
    } catch (err: any) {
      const status = err?.status ?? err?.code;
      if (status === 429) {
        const delay = Math.min(500 * Math.pow(2, attempt++), 8000) + Math.floor(Math.random() * 250);
        await sleep(delay);
        continue;
      }
      logger.error('sendWithPacing error', { status, err });
      throw err;
    }
  }
}

export async function replyWithPacing(message: Message, payload: string | MessageCreateOptions): Promise<Message> {
  const id = (message.channel as any).id as string;
  let attempt = 0;
  while (true) {
    try {
      await takeToken(id);
      const msg: any = message as any;
      return await msg.reply(payload as any);
    } catch (err: any) {
      const status = err?.status ?? err?.code;
      if (status === 429) {
        const delay = Math.min(500 * Math.pow(2, attempt++), 8000) + Math.floor(Math.random() * 250);
        await sleep(delay);
        continue;
      }
      logger.error('replyWithPacing error', { status, err });
      throw err;
    }
  }
}

