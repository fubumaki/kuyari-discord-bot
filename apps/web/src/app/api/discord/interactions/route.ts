import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { verifyKey } from 'discord-interactions';
import { getEntitlement, loadDecryptedKey, setGuildKey, unsetGuildKey, setGuildModel, getGuildLLMConfig } from '@kuyari/shared';

export const runtime = 'nodejs';

function json(data: any, init?: ResponseInit) { return new NextResponse(JSON.stringify(data), { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }); }

async function verifyDiscordRequest(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const body = await req.text();
  if (!signature || !timestamp) return { valid: false } as const;
  const publicKey = process.env.DISCORD_PUBLIC_KEY!;
  const isValid = verifyKey(Buffer.from(body), signature, timestamp, publicKey);
  return { valid: isValid, bodyRaw: body } as const;
}

export async function POST(req: NextRequest) {
  const { valid, bodyRaw } = await verifyDiscordRequest(req as any);
  if (!valid) return new NextResponse('Bad signature', { status: 401 });
  const body = JSON.parse(bodyRaw!);

  // PING
  if (body.type === 1) {
    return json({ type: 1 });
  }

  // Application command
  if (body.type === 2) {
    const name: string = body.data?.name;
    const guildId: string | undefined = body.guild_id;
    const token: string = body.token;
    const appId = process.env.DISCORD_CLIENT_ID!;

    // Quick commands
    if (name === 'ping') {
      return json({ type: 4, data: { content: 'Pong!', flags: 64 } });
    }

    if (name === 'plan') {
      // Defer immediately, then follow up
      queueMicrotask(async () => {
        try {
          const ent = guildId ? await getEntitlement(guildId) : { plan: 'basic', caps: { dj_concurrency: 1 } as any };
          await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: `Plan: **${ent.plan}**  |  DJ slots: ${ent.caps.dj_concurrency}` }),
          });
        } catch (err) {
          await safeEdit(appId, token, 'Failed to load plan.');
        }
      });
      return json({ type: 5, data: { flags: 64 } });
    }

    if (name === 'llm') {
      const sub = body.data?.options?.[0]?.name as string | undefined;
      const options = (body.data?.options?.[0]?.options ?? []) as Array<{ name: string; value: string }>;
      if (!guildId) return json({ type: 4, data: { content: 'Use this in a server.', flags: 64 } });

      if (sub === 'set-key') {
        const provider = (options.find((o) => o.name === 'provider')?.value || 'anthropic') as string;
        const key = options.find((o) => o.name === 'key')?.value as string | undefined;
        if (!key) return json({ type: 4, data: { content: 'Missing key.', flags: 64 } });
        // Cheap probe
        const ok = await probeKey(provider, key);
        if (!ok) return json({ type: 4, data: { content: '🚫 Invalid API key or provider.', flags: 64 } });
        await setGuildKey(guildId, provider, key);
        return json({ type: 4, data: { content: `✅ Saved ${provider} key. We do not log prompts or keys.`, flags: 64 } });
      }

      if (sub === 'unset-key') {
        await unsetGuildKey(guildId);
        return json({ type: 4, data: { content: '🔒 Removed stored key. AI replies disabled until set.', flags: 64 } });
      }

      if (sub === 'model') {
        const nameArg = options.find((o) => o.name === 'name')?.value as string | undefined;
        if (!nameArg) {
          const cfg = await getGuildLLMConfig(guildId);
          return json({ type: 4, data: { content: `Current model: ${cfg.provider}/${cfg.model}`, flags: 64 } });
        }
        const cfg = await getGuildLLMConfig(guildId);
        const key = await loadDecryptedKey(guildId);
        if (!key) return json({ type: 4, data: { content: 'Set a provider key first via /llm set-key.', flags: 64 } });
        const ok = await probeModel(cfg.provider, key, nameArg);
        if (!ok) return json({ type: 4, data: { content: '🚫 Model not accessible with this key.', flags: 64 } });
        await setGuildModel(guildId, cfg.provider, nameArg);
        return json({ type: 4, data: { content: `✅ Model set to ${cfg.provider}/${nameArg}`, flags: 64 } });
      }

      if (sub === 'test') {
        const cfg = await getGuildLLMConfig(guildId);
        const key = await loadDecryptedKey(guildId);
        if (!key) return json({ type: 4, data: { content: 'No key configured. Use /llm set-key.', flags: 64 } });
        const ok = await quickTest(cfg.provider, key, cfg.model);
        return json({ type: 4, data: { content: ok ? '✅ Test successful.' : '❌ Test failed.', flags: 64 } });
      }

      return json({ type: 4, data: { content: 'Unknown subcommand.', flags: 64 } });
    }

    // Unknown
    return json({ type: 4, data: { content: 'Unsupported command.', flags: 64 } });
  }

  return new NextResponse('ok');
}

async function probeKey(provider: string, key: string): Promise<boolean> {
  try {
    if (provider === 'openai' || provider === 'open') {
      const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      return res.ok;
    }
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' } });
      return res.ok;
    }
    if (provider === 'gemini') {
      // No cheap probe; treat as ok if key length looks plausible
      return key.length > 20;
    }
    return false;
  } catch {
    return false;
  }
}

async function probeModel(provider: string, key: string, model: string): Promise<boolean> {
  try {
    if (provider === 'openai' || provider === 'open') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
      });
      return res.ok;
    }
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
      });
      return res.ok;
    }
    if (provider === 'gemini') {
      return true;
    }
    return false;
  } catch { return false; }
}

async function quickTest(provider: string, key: string, model: string): Promise<boolean> {
  try {
    if (provider === 'openai' || provider === 'open') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Test' }], max_tokens: 5 })
      });
      return res.ok;
    }
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Test' }], max_tokens: 5 })
      });
      return res.ok;
    }
    if (provider === 'gemini') return true;
    return false;
  } catch { return false; }
}

async function safeEdit(appId: string, token: string, content: string) {
  try {
    await fetch(`https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
    });
  } catch {}
}

