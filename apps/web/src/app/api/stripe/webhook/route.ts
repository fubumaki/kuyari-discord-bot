import { NextRequest, NextResponse } from 'next/server';
import { processStripeWebhook } from '@/server/stripe';

// POST /api/stripe/webhook
export async function POST(req: NextRequest) {
  try {
    // Stripe requires the raw body for signature verification
    const rawBody = await req.text();
    const signature = req.headers.get('stripe-signature') || '';
    const result = await processStripeWebhook(rawBody, signature);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}

// Disable the built-in body parser by exporting a config (not needed in Next.js App Router, but kept for clarity)
// export const config = { api: { bodyParser: false } };