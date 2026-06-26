import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout session for the Tsumi Pro subscription (£0.99/mo).
 */
export async function POST() {
  if (!isStripeConfigured || !stripe) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY and STRIPE_PRO_PRICE_ID.' },
      { status: 503 },
    );
  }

  // Resolve the Clerk user (when auth is wired up).
  let userId: string | null = null;
  if (hasClerk) {
    const result = auth();
    userId = result.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: process.env.STRIPE_PRO_PRICE_ID!, quantity: 1 }],
      success_url: `${appUrl}/profile?upgraded=1`,
      cancel_url: `${appUrl}/profile`,
      client_reference_id: userId ?? undefined,
      metadata: { userId: userId ?? 'anonymous' },
      subscription_data: { metadata: { userId: userId ?? 'anonymous' } },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Checkout failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
