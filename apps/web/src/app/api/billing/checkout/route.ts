import { NextRequest, NextResponse } from 'next/server';
import { createCheckoutSession } from '@/server/stripe';

// POST /api/billing/checkout
export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const { priceId, guildId, discordGuildId } = json;
    if (!priceId || !guildId || !discordGuildId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }
    const url = await createCheckoutSession({ priceId, guildId, discordGuildId });
    return NextResponse.json({ url });
  } catch (err: any) {
    console.error('Checkout API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}