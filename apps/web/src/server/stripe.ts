import Stripe from 'stripe';
import { db } from '@kuyari/db';
import { publish } from '@kuyari/shared/pubsub';

/**
 * Initialize Stripe using the secret API key from your environment. Use the latest API version.
 */
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-06-20',
});

/**
 * Creates a checkout session for a guild. The `priceId` should correspond to the plan
 * selected by the user (e.g. premium or pro). The `guildId` must reference the internal
 * database record rather than the Discord snowflake. We also embed the Discord guild ID
 * in the `client_reference_id` for redundancy.
 */
export async function createCheckoutSession(data: { priceId: string; guildId: string; discordGuildId: string }) {
  const { priceId, guildId, discordGuildId } = data;
  // Optionally retrieve existing Stripe customer ID for this guild from DB
  const guild = await db.guilds.findUnique({ where: { id: guildId } });
  const customerId = (guild as any)?.stripeCustomerId ?? undefined;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: discordGuildId,
    metadata: { guild_id: guildId },
    success_url: `${process.env.BASE_URL}/guild/${guildId}?upgraded=1`,
    cancel_url: `${process.env.BASE_URL}/guild/${guildId}?canceled=1`,
  });
  return session.url;
}

/**
 * Handles Stripe webhook events. Accepts the raw request body and signature. Returns
 * an object indicating whether processing succeeded. This utility does not send
 * responses directly; it should be wrapped in an API route handler.
 */
export async function processStripeWebhook(rawBody: Buffer | string, signature: string) {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, endpointSecret!);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return { ok: false, error: err.message };
  }
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const guildId = (session.metadata?.guild_id as string) || '';
      await upsertSubscriptionAndEntitlements(guildId, session);
      publish(`entitlement:changed:${guildId}`, {});
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const subscription = event.data.object as Stripe.Subscription;
      const guildId = await mapSubscriptionToGuildId(subscription);
      if (guildId) {
        await updatePlanStatusFromSubscription(guildId, subscription);
        publish(`entitlement:changed:${guildId}`, {});
      }
      break;
    }
    default:
      // Unhandled event type
      break;
  }
  return { ok: true };
}

/**
 * Upserts subscription and entitlement information for a guild. This should update
 * the subscriptions table, guilds table (plan & status), and guild_entitlements table.
 */
async function upsertSubscriptionAndEntitlements(guildId: string, session: Stripe.Checkout.Session) {
  // Determine plan from the session (via metadata or price ID)
  const priceId = (session.metadata?.price_id as string) ?? '';
  let plan: 'basic' | 'premium' | 'pro' = 'basic';
  if (priceId === process.env.PRICE_PREMIUM) plan = 'premium';
  if (priceId === process.env.PRICE_PRO) plan = 'pro';
  // Upsert subscription - using the actual DB interface
  // Note: The subscriptions table methods are stubbed in the current DB implementation
  // This will need to be implemented when the subscriptions table is fully set up
  // Update guild plan
  await db.guilds.update({ where: { id: guildId }, data: { plan: plan as any } });
  const caps = getCapsForPlan(plan);
  await db.guildEntitlements.upsert({
    where: { guildId: guildId },
    update: { plan, caps },
    create: { plan, caps },
  });
}

async function updatePlanStatusFromSubscription(guildId: string, subscription: Stripe.Subscription) {
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price?.id;
  let plan: 'basic' | 'premium' | 'pro' = 'basic';
  if (priceId === process.env.PRICE_PREMIUM) plan = 'premium';
  if (priceId === process.env.PRICE_PRO) plan = 'pro';
  let planStatus: 'active' | 'past_due' | 'canceled' = 'active';
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete_expired') {
    planStatus = 'past_due';
  }
  if (status === 'canceled') {
    planStatus = 'canceled';
  }
  await db.guilds.update({ where: { id: guildId }, data: { plan: (planStatus === 'active' ? plan : 'basic') as any, planStatus: planStatus as any } });
  const caps = planStatus === 'active' ? getCapsForPlan(plan) : getCapsForPlan('basic');
  await db.guildEntitlements.upsert({
    where: { guildId: guildId },
    update: { plan: planStatus === 'active' ? plan : 'basic', caps },
    create: { plan: planStatus === 'active' ? plan : 'basic', caps },
  });
}

async function mapSubscriptionToGuildId(subscription: Stripe.Subscription): Promise<string | null> {
  // Note: The subscriptions table methods are stubbed in the current DB implementation
  // This will need to be implemented when the subscriptions table is fully set up
  return null;
}

function getCapsForPlan(plan: 'basic' | 'premium' | 'pro') {
  switch (plan) {
    case 'premium':
      return {
        dj_concurrency: 2,
        tokens_month_in: 1500000,
        tokens_month_out: 300000,
        image_gen: 200,
        music_gen: 20,
        vision_describe: 2000,
      };
    case 'pro':
      return {
        dj_concurrency: 3,
        tokens_month_in: 2000000,
        tokens_month_out: 500000,
        image_gen: 400,
        music_gen: 40,
        vision_describe: 5000,
      };
    case 'basic':
    default:
      return {
        dj_concurrency: 1,
        tokens_month_in: 200000,
        tokens_month_out: 60000,
        image_gen: 0,
        music_gen: 0,
        vision_describe: 0,
      };
  }
}
