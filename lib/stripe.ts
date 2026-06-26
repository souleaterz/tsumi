import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY;

export const isStripeConfigured = Boolean(key && process.env.STRIPE_PRO_PRICE_ID);

// Lazily instantiate so the app builds/runs without Stripe keys.
// API version is left unset to use the account default pinned in the dashboard.
export const stripe = key ? new Stripe(key) : null;

export const PRO_PRICE_GBP = '£0.99';
