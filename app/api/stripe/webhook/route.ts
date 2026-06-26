import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook
 * Mirrors Stripe subscription state into Supabase so the app can gate Pro
 * features (ad-free playback). Configure STRIPE_WEBHOOK_SECRET and point a
 * Stripe webhook at this route for checkout + subscription events.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await req.text();
  const sig = headers().get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid signature';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase =
    supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  async function upsertSub(userId: string, fields: Record<string, unknown>) {
    if (!supabase) return;
    await supabase
      .from('subscriptions')
      .upsert(
        { user_id: userId, updated_at: new Date().toISOString(), ...fields },
        { onConflict: 'user_id' },
      );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as any;
      const userId = s.metadata?.userId || s.client_reference_id;
      if (userId) {
        await upsertSub(userId, {
          stripe_customer_id: s.customer,
          stripe_subscription_id: s.subscription,
          status: 'active',
          tier: 'pro',
        });
      }
      break;
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      if (userId) {
        const active = sub.status === 'active' || sub.status === 'trialing';
        await upsertSub(userId, {
          stripe_subscription_id: sub.id,
          status: sub.status,
          tier: active ? 'pro' : 'free',
          current_period_end: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : null,
        });
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
