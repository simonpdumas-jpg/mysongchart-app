import { createClerkClient } from '@clerk/backend';
import Stripe from 'stripe';

// Safe initialization of Stripe and Clerk to prevent FUNCTION_INVOCATION_FAILED on cold starts
let stripe = null;
let clerkClient = null;

try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  } else {
    console.error('STRIPE_SECRET_KEY is missing from environment variables.');
  }
} catch (err) {
  console.error('Error initializing Stripe:', err);
}

try {
  if (process.env.CLERK_SECRET_KEY) {
    clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  } else {
    console.error('CLERK_SECRET_KEY is missing from environment variables.');
  }
} catch (err) {
  console.error('Error initializing Clerk:', err);
}

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Check if environment variables are properly set
  if (!stripe || !clerkClient) {
    const missing = [];
    if (!process.env.STRIPE_SECRET_KEY) missing.push('STRIPE_SECRET_KEY');
    if (!process.env.CLERK_SECRET_KEY) missing.push('CLERK_SECRET_KEY');
    return res.status(500).json({
      received: false,
      message: `Backend setup incomplete. Missing configuration for: ${missing.join(', ')}. Please add them in the Vercel Dashboard project settings.`
    });
  }

  const buf = await buffer(req);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.client_reference_id;
    const customerEmail = session.customer_details?.email || session.customer_email;

    // Case 1: User was logged in during checkout
    if (userId) {
      await clerkClient.users.updateUserMetadata(userId, {
        publicMetadata: { isPro: true, stripeRole: 'pro' }
      });
      console.log(`Successfully upgraded logged-in user ${userId} to Pro.`);
    } 
    // Case 2: User bought BEFORE logging in / creating an account
    else if (customerEmail) {
      // Search Clerk for an account matching the checkout email
      const usersList = await clerkClient.users.getUserList({
        emailAddress: [customerEmail]
      });

      if (usersList.data && usersList.data.length > 0) {
        const existingUser = usersList.data[0];
        await clerkClient.users.updateUserMetadata(existingUser.id, {
          publicMetadata: { isPro: true, stripeRole: 'pro' }
        });
        console.log(`Matched customer email ${customerEmail} to existing user ${existingUser.id}!`);
      } else {
        console.log(`Payment received for ${customerEmail}, but no Clerk account exists yet. They will be synced via session_id on first sign-up.`);
      }
    }

  }

  return res.status(200).json({ received: true });
}
