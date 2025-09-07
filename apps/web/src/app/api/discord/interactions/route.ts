// Minimal, fast-ACK Discord interactions handler (Edge runtime)
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

const EPHEMERAL = 1 << 6; // 64

function badSig(): Response {
  return new Response('Bad request signature', { status: 401 });
}

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  // Read raw body before any parsing
  const raw = await req.text();
  if (!signature || !timestamp || !publicKey) return badSig();
  const ok = verifyKey(raw, signature, timestamp, publicKey);
  if (!ok) return badSig();

  const body = JSON.parse(raw);

  // PING -> PONG
  if (body.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  // Commands
  if (body.type === InteractionType.APPLICATION_COMMAND) {
    const name = body?.data?.name;
    if (name === 'ping') {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '🏓 Pong!', flags: EPHEMERAL },
      });
    }

    // Default: defer and handle via follow-up later (no heavy work here)
    return Response.json({ type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE });
  }

  return new Response('Unhandled interaction type', { status: 400 });
}
