// app/api/discord/interactions/route.ts
/* eslint-disable no-console */
import nacl from 'tweetnacl';
import { NextRequest } from 'next/server';

// Use Node runtime
export const runtime = 'nodejs';

// Discord constants
const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
} as const;

// Bitwise flag for ephemeral
const EPHEMERAL = 1 << 6; // 64

function hexToUint8Array(hex: string) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)));
}

function verifyDiscordRequest(req: NextRequest, rawBody: string): boolean {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');
  const publicKey = process.env.DISCORD_PUBLIC_KEY;

  if (!signature || !timestamp || !publicKey) return false;

  const message = new TextEncoder().encode(timestamp + rawBody);
  const sig = hexToUint8Array(signature);
  const pub = hexToUint8Array(publicKey);

  return nacl.sign.detached.verify(message, sig, pub);
}

export async function POST(req: NextRequest) {
  // IMPORTANT: verify BEFORE parsing
  const raw = await req.text();
  if (!verifyDiscordRequest(req, raw)) {
    return new Response('Bad signature', { status: 401 });
  }

  const interaction = JSON.parse(raw);

  // 1) PING -> PONG (Discord's ownership check)
  if (interaction.type === InteractionType.PING) {
    return Response.json({ type: InteractionResponseType.PONG });
  }

  // 2) Slash commands
  if (interaction.type === InteractionType.APPLICATION_COMMAND) {
    const name = interaction.data?.name;

    // Fast path responses under ~3s are fine:
    if (name === 'ping') {
      return Response.json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '🏓 Pong!', flags: EPHEMERAL },
      });
    }
    // For everything else, ACK immediately then enqueue asynchronously via Upstash REST
    const ack = Response.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: EPHEMERAL },
    });

    // Fire-and-forget enqueue (do not block the ACK)
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (upstashUrl && upstashToken) {
      const job = {
        id: interaction.id,
        token: interaction.token,
        application_id: interaction.application_id,
        command: name,
        userId: interaction.member?.user?.id ?? interaction.user?.id,
        guildId: interaction.guild_id,
        options: interaction.data?.options ?? [],
      };
      const idKey = `kuyari:interaction:${interaction.id}`;
      const pipelineBody = {
        commands: [
          ['SET', idKey, '1', 'EX', '60', 'NX'],
          ['LPUSH', 'kuyari:jobs', JSON.stringify(job)],
        ],
      } as const;
      // No await – do not delay the response
      fetch(`${upstashUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pipelineBody),
      }).catch(() => {});
    }

    return ack;
  }

  // 3) Components / modals (optional paths)
  if (
    interaction.type === InteractionType.MESSAGE_COMPONENT ||
    interaction.type === InteractionType.MODAL_SUBMIT
  ) {
    // handle quickly or defer similarly
    return Response.json({
      type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
      data: { flags: EPHEMERAL },
    });
  }

  // Fallback
  return new Response('Unhandled interaction', { status: 200 });
}

