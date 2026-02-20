# PrimatIA — Stripe Setup Guide

## 1. Create Stripe Products & Prices

Go to [dashboard.stripe.com/products](https://dashboard.stripe.com/products) and create 3 products:

| Product | Suggested Price | Billing |
|---------|----------------|---------|
| PrimărIA — Comună | ~200 RON/month | Recurring monthly |
| PrimărIA — Oraș | ~500 RON/month | Recurring monthly |
| PrimărIA — Municipiu | ~1000 RON/month | Recurring monthly |

After creating each, copy the **Price ID** (starts with `price_`).

## 2. Create Webhook Endpoint

Go to [dashboard.stripe.com/webhooks](https://dashboard.stripe.com/webhooks) → **+ Add endpoint**

- **Endpoint URL:** `https://primaria-382299704849.europe-central2.run.app/api/payments/webhook`
- **Events to listen to:**
  - `checkout.session.completed`
  - `checkout.session.expired`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.payment_succeeded`
  - `payment_intent.payment_failed`

Copy the **Signing secret** (starts with `whsec_`).

## 3. GCP Cloud Run Environment Variables

Set these on the PrimatIA Cloud Run service (`primaria-382299704849`, region `europe-central2`):

```
PAYMENT_MODE=stripe
STRIPE_SECRET_KEY=sk_live_PASTE_HERE
STRIPE_WEBHOOK_SECRET=whsec_PASTE_HERE
STRIPE_PRICE_COMUNA_ID=price_PASTE_COMUNA_PRICE_ID
STRIPE_PRICE_ORAS_ID=price_PASTE_ORAS_PRICE_ID
STRIPE_PRICE_MUNICIPIU_ID=price_PASTE_MUNICIPIU_PRICE_ID
```

### Via GCP Console:
1. Cloud Run → `primaria` service → **Edit & Deploy New Revision**
2. **Variables & Secrets** tab → Add each variable above
3. **Deploy**

### Via gcloud CLI:
```bash
gcloud run services update primaria \
  --project YOUR_PROJECT_ID \
  --region europe-central2 \
  --update-env-vars \
PAYMENT_MODE=stripe,\
STRIPE_SECRET_KEY=sk_live_XXX,\
STRIPE_WEBHOOK_SECRET=whsec_XXX,\
STRIPE_PRICE_COMUNA_ID=price_XXX,\
STRIPE_PRICE_ORAS_ID=price_XXX,\
STRIPE_PRICE_MUNICIPIU_ID=price_XXX
```

## 4. Verify

After deploying:
1. Go to the citizen portal → login → select debts → pay online
2. Should redirect to Stripe Checkout
3. Use test card `4242 4242 4242 4242` if in test mode
4. Check webhook delivery at dashboard.stripe.com/webhooks
