---
name: stripe-subscriptions
description: Stripe integration for SaaS — Checkout sessions, Customer Portal, webhook handling, subscription lifecycle (active/trialing/past_due/cancelled), pricing tiers, and billing dashboard. Next.js/Node patterns.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---

# Stripe Subscriptions

Production Stripe integration for SaaS apps. Covers setup, Checkout, webhooks, portal, and subscription state.

---

## Install & Setup

```bash
npm i stripe @stripe/stripe-js
```

```ts
// lib/stripe.ts — server-side client
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
  typescript: true,
})
```

```
STRIPE_SECRET_KEY=sk_live_...        # or sk_test_... for dev
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...      # from: stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

## Pricing Tiers Setup (Stripe Dashboard)

1. Create Products (e.g. "Pro Plan", "Business Plan")
2. Create Prices with `lookup_key` — use lookup keys, not hardcoded price IDs:
   - `pro_monthly`, `pro_yearly`, `business_monthly`, `business_yearly`
3. Store lookup keys in code, never raw price IDs

```ts
const prices = await stripe.prices.list({
  lookup_keys: ['pro_monthly', 'pro_yearly'],
  expand: ['data.product'],
})
```

---

## Checkout Flow

```ts
// app/actions/billing.ts
'use server'
import { stripe } from '@/lib/stripe'
import { auth } from '@/auth'
import { redirect } from 'next/navigation'

export async function createCheckoutSession(priceId: string) {
  const session = await auth()
  if (!session?.user) throw new Error('Not authenticated')

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: session.user.email!,
    metadata: { userId: session.user.id },
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
    // Enable trial via price config in Stripe Dashboard, or:
    subscription_data: { trial_period_days: 14, metadata: { userId: session.user.id } },
    allow_promotion_codes: true,
  })

  redirect(checkoutSession.url!)
}
```

If user already has a Stripe customer ID, pass `customer` instead of `customer_email`:
```ts
customer: user.stripeCustomerId ?? undefined,
customer_email: user.stripeCustomerId ? undefined : user.email,
```

---

## Customer Portal (Self-Service Billing)

```ts
export async function createPortalSession() {
  const session = await auth()
  const user = await db.query.users.findFirst({ where: eq(users.id, session!.user.id) })

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user!.stripeCustomerId!,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  })

  redirect(portalSession.url)
}
```

Configure portal in Stripe Dashboard → Billing → Customer portal: enable invoice history, payment method update, subscription cancellation.

---

## Webhook Handler

```ts
// app/api/webhooks/stripe/route.ts
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import Stripe from 'stripe'

export async function POST(req: Request) {
  const body = await req.text()
  const sig = headers().get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.CheckoutSession
      await handleCheckoutComplete(session)
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription
      await upsertSubscription(sub)
      break
    }
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await cancelSubscription(sub)
      break
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await handlePaymentFailed(invoice)
      break
    }
  }

  return NextResponse.json({ received: true })
}
```

### Key webhook handlers

```ts
async function handleCheckoutComplete(session: Stripe.CheckoutSession) {
  const userId = session.metadata?.userId
  if (!userId || session.mode !== 'subscription') return

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
  await db.update(users).set({
    stripeCustomerId: session.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0].price.id,
    stripeCurrentPeriodEnd: new Date(subscription.current_period_end * 1000),
    subscriptionStatus: subscription.status,
  }).where(eq(users.id, userId))
}

async function upsertSubscription(sub: Stripe.Subscription) {
  await db.update(users).set({
    stripePriceId: sub.items.data[0].price.id,
    stripeCurrentPeriodEnd: new Date(sub.current_period_end * 1000),
    subscriptionStatus: sub.status,
  }).where(eq(users.stripeCustomerId, sub.customer as string))
}

async function cancelSubscription(sub: Stripe.Subscription) {
  await db.update(users).set({
    subscriptionStatus: 'cancelled',
    stripePriceId: null,
  }).where(eq(users.stripeCustomerId, sub.customer as string))
}
```

---

## Subscription Status Reference

| Status | Meaning | Access |
|--------|---------|--------|
| `trialing` | Free trial period | Full paid access |
| `active` | Paying, current | Full paid access |
| `past_due` | Payment failed, retrying | Warn + limited access |
| `unpaid` | All retries failed | Block paid features |
| `cancelled` | Explicitly cancelled | Block paid features |
| `incomplete` | Checkout started but not finished | No access |

```ts
// lib/subscription.ts — access check
export function hasActiveSubscription(status: string | null) {
  return status === 'active' || status === 'trialing'
}
```

---

## DB Schema (Drizzle)

```ts
// schema/users.ts — subscription columns
stripeCustomerId: text('stripe_customer_id').unique(),
stripeSubscriptionId: text('stripe_subscription_id').unique(),
stripePriceId: text('stripe_price_id'),
stripeCurrentPeriodEnd: timestamp('stripe_current_period_end'),
subscriptionStatus: text('subscription_status').default('free'),
```

---

## Billing Dashboard Page

```tsx
// app/settings/billing/page.tsx
export default async function BillingPage() {
  const user = await getCurrentUser()
  const isActive = hasActiveSubscription(user.subscriptionStatus)

  return (
    <div>
      <h1>Billing</h1>
      <p>Status: {user.subscriptionStatus ?? 'Free'}</p>
      {isActive && user.stripeCurrentPeriodEnd && (
        <p>Renews: {user.stripeCurrentPeriodEnd.toLocaleDateString()}</p>
      )}
      {user.stripeCustomerId ? (
        <form action={createPortalSession}>
          <button type="submit">Manage billing</button>
        </form>
      ) : (
        <a href="/pricing">Upgrade to Pro</a>
      )}
    </div>
  )
}
```

---

## Local Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local dev
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger invoice.payment_failed
```

---

## Required ENV Variables

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...     # from `stripe listen` output
```

---

## Upgrade/Downgrade Flow

Use the Customer Portal for self-service upgrades/downgrades. For programmatic changes:
```ts
// Upgrade: update subscription item price
const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId)
await stripe.subscriptions.update(user.stripeSubscriptionId, {
  items: [{ id: subscription.items.data[0].id, price: newPriceId }],
  proration_behavior: 'create_prorations',  // or 'always_invoice'
})
```
