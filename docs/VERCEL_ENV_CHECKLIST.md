# Vercel env vars for saymd-app (copy values from saymd/.env)

Set these in **Vercel → saymd-app → Settings → Environment Variables** for **Production** (and Preview if you test there):

| Variable | Notes |
|----------|--------|
| `STRIPE_SECRET_KEY` | `sk_test_…` (switch to `sk_live_…` at launch) |
| `STRIPE_SAYMD_WEBHOOK_SECRET` | `whsec_…` from Stripe webhook endpoint |
| `STRIPE_SAYMD_PRO_ANNUAL_PRICE_ID` | `price_1UBCH4IvqAw9YlpWbs0jMFfd` |
| `STRIPE_SAYMD_PRO_MONTHLY_PRICE_ID` | `price_1UBCH5IvqAw9YlpW7qjBJfUd` |
| `STRIPE_SAYMD_BILLING_PORTAL_URL` | `https://billing.stripe.com/p/login/test_…` |
| `SAYMD_LICENSE_PRIVATE_KEY_DER_B64` | From private `saymd-pro` keygen (`npm run generate-keys`) — never commit |
| `DATABASE_URL` | Neon connection string |
| `SAYMD_PREVIEW_TOKEN` | Preview gate token |
| `SAYMD_SALES_ENABLED` | `1` for checkout testing |
| `SAYMD_SITE_URL` | `https://saymd.app` |
| `SAYMD_PUBLIC` | `0` until launch |

After saving, **Redeploy** production (Deployments → … → Redeploy).

Test: `node scripts/e2e-stripe-test.js` (from repo with env loaded).
