import { Channel, MessageCreateOptions, TextBasedChannel } from 'discord.js';

type Task = () => Promise<void>;

const perChannelQueues = new Map<string, Task[]>();
const perChannelBusy = new Set<string>();

export function sendQueued(channel: TextBasedChannel, payload: string | MessageCreateOptions) {
  const id = (channel as any).id as string;
  const queue = perChannelQueues.get(id) ?? [];
  perChannelQueues.set(id, queue);
  queue.push(async () => {
    let attempt = 0;
    while (true) {
      try {
        if (typeof payload === 'string') await channel.send(payload);
        else await channel.send(payload);
        await sleep(200); // small spacing to avoid 429s
        return;
      } catch (err: any) {
        const status = err?.status ?? err?.code;
        if (status === 429) {
          const delay = Math.min(2000 * Math.pow(2, attempt++), 10000);
          await sleep(delay);
          continue;
        }
        // For other errors, log and drop
        console.error('send error:', status || err?.message || err);
        return;
      }
    }
  });
  pump(id, channel);
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

