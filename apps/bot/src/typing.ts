import { TextBasedChannel } from 'discord.js';

export async function withTyping(channel: TextBasedChannel, fn: () => Promise<void>) {
  let stopped = false;
  const loop = async () => {
    while (!stopped) {
      try { await channel.sendTyping(); } catch {}
      await sleep(8000);
    }
  };
  const bg = loop();
  try { await fn(); } finally { stopped = true; await bg; }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

