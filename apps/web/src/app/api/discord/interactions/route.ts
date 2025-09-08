import type { NextRequest } from 'next/server';
import { InteractionResponseType, InteractionType, verifyKey } from 'discord-interactions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const preferredRegion = ['iad1'];

const PK = process.env.DISCORD_PUBLIC_KEY;
const DEBUG = process.env.DISCORD_DEBUG === '1';

function log(level: 'log' | 'warn' | 'error', msg: string, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({ svc: 'discord-interactions', msg, ...meta });
  console[level](line);
}

export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID();
  const vercelId = req.headers.get('x-vercel-id') ?? 'n/a';
  const ts = req.headers.get('x-signature-timestamp') ?? '';
  const sig = req.headers.get('x-signature-ed25519') ?? '';

  if (!PK) {
    log('error', 'Missing DISCORD_PUBLIC_KEY', { reqId, vercelId });
    return new Response('Server misconfigured', { status: 500, headers: { 'x-request-id': reqId } });
  }

  const raw = await req.text();

  let valid = false;
  try {
    valid = await verifyKey(raw, sig, ts, PK);
  } catch (e) {
    log('error', 'verifyKey threw', { reqId, vercelId, err: (e as Error)?.message ?? String(e) });
  }

  if (!valid) {
    log('warn', 'Signature verification failed', {
      reqId,
      vercelId,
      hasSig: Boolean(sig),
      hasTs: Boolean(ts),
      bodyLen: raw.length,
      debug: DEBUG,
    });
    return new Response('Bad request', { status: 401, headers: { 'x-request-id': reqId } });
  }

  const interaction = JSON.parse(raw);

  if (interaction.type === InteractionType.PING) {
    log('log', 'PING', { reqId });
    return Response.json({ type: InteractionResponseType.PONG }, { headers: { 'x-request-id': reqId } });
  }

  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;
    if (name === 'ping') {
      return Response.json(
        { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64, content: '🏓 Pong!' } },
        { headers: { 'x-request-id': reqId } }
      );
    }
    if (name === 'plan') {
      const content = [
        "Here's a quick plan stub. (A full version will arrive when async follow-ups are implemented.)",
        '1) Define your goal → 2) Break it into tasks → 3) Assign owners → 4) Set deadlines.',
      ].join('\n');
      return Response.json(
        { type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64, content } },
        { headers: { 'x-request-id': reqId } }
      );
    }

    return Response.json(
      { type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: 64 } },
      { headers: { 'x-request-id': reqId } }
    );
  }

  log('warn', 'Unhandled interaction type', { reqId, type: interaction.type });
  return new Response('Unhandled', { status: 400, headers: { 'x-request-id': reqId } });
}

export async function GET() {
  return new Response('ok', { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

