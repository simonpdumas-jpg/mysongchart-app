// /api/sync-purchase
//
// Serverless API endpoint (Vercel-compatible) used in two scenarios:
//
// 1. POST { userId, email } - "Legacy" sync check. Used when a logged-in user
//    does not yet have Pro status in Clerk metadata. We check Stripe for any
//    completed checkout sessions matching their email, and if found, mark
//    them as Pro in Clerk.
//
// 2. POST { sessionId, userId } - "Post-checkout" sync. Used right after a
//    brand new user signs up following a Stripe redirect that included
//    ?session_id={CHECKOUT_SESSION_ID}. We verify that Stripe session was
//    actually paid, then mark the now-authenticated Clerk user as Pro.
//
// Both paths set BOTH `isPro: true` and `stripeRole: 'pro'` on publicMetadata
// so older and newer feature-gating checks throughout the app continue to work.

import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function markUserAsPro(userId) {
  await clerkClient.users.updateUserMetadata(userId, {
    publicMetadata: { isPro: true, stripeRole: 'pro' },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { userId, email, sessionId } = req.body || {};

    // --- Path 2: Verify a specific Stripe Checkout Session (post-redirect) ---
    if (sessionId) {
      if (!userId) {
        return res.status(400).json({ isPro: false, message: 'Missing userId for session verification.' });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session && session.payment_status === 'paid') {
        await markUserAsPro(userId);
        return res.status(200).json({ isPro: true });
      }

      return res.status(200).json({ isPro: false, message: 'Checkout session not paid.' });
    }

    // --- Path 1: Fallback check by email across past Stripe checkout sessions ---
    if (!userId || !email) {
      return res.status(400).json({ isPro: false, message: 'Missing userId or email.' });
    }

    const sessions = await stripe.checkout.sessions.list({
      limit: 20,
    });

    const matchingPaidSession = sessions.data.find((s) => {
      const sessionEmail = s.customer_details?.email || s.customer_email;
      return (
        sessionEmail &&
        sessionEmail.toLowerCase() === email.toLowerCase() &&
        s.payment_status === 'paid'
      );
    });

    if (matchingPaidSession) {
      await markUserAsPro(userId);
      return res.status(200).json({ isPro: true });
    }

    return res.status(200).json({ isPro: false });
  } catch (err) {
    console.error('Error in /api/sync-purchase:', err);
    return res.status(500).json({ isPro: false, message: 'Internal server error.' });
  }
}
