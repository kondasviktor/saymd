# Stripe — saymd (separate account)

**Use a new Stripe account for saymd.** Do not add saymd products to the VCL Stripe account.

## Why a separate account

| Concern | VCL account | saymd account |
|---------|-------------|---------------|
| Business name on receipts | Vibe Coder's Life | **SayMD** (or saymd.app) |
| Customer list | Playbook buyers | Pro subscribers only |
| Terms / Privacy URLs | vibecoderslife.com | **saymd.app/terms.html**, **saymd.app/privacy.html** |
| Support email | hello@vibecoderslife.com | **support@saymd.app** |
| Webhooks | `/api/stripe-webhook` (Playbook) | `/api/stripe-webhook-saymd` |
| Statement descriptor | VCLPLAYBOOK | e.g. **SAYMD** |

Same legal entity (Hungarian sole trader) can own both accounts — check with your accountant.

## Stripe Dashboard setup (new account)

1. Create account at [stripe.com](https://stripe.com) — business display name **saymd** / SayMD.
2. **Settings → Business → Public details**
   - Support email: `support@saymd.app`
   - Privacy policy: `https://saymd.app/privacy.html`
   - Terms of service: `https://saymd.app/terms.html`
3. **Product catalog → Add product** — “saymd Pro”
   - Price: **€39/year** (recurring, annual) — copy `price_…` → `STRIPE_SAYMD_PRO_ANNUAL_PRICE_ID`
   - Price: **€5/month** (recurring, monthly) — copy `price_…` → `STRIPE_SAYMD_PRO_MONTHLY_PRICE_ID`
   - Tax code: **Software as a service** (`txcd_10103001`) — required if Managed Payments is on
   - Or run setup scripts in the **saymd-app** repo (`scripts/stripe-setup.js` if present)
4. **Settings → Billing → Customer portal**
   - Enable the portal (invoices, cancel, payment method).
   - **Activate the login page** (customers enter the email they used at Checkout — no saymd login).
   - Copy the login URL (`https://billing.stripe.com/p/login/…`) → `STRIPE_SAYMD_BILLING_PORTAL_URL`
   - Landing **Manage subscription** goes to `/api/billing-portal`, which redirects there.
5. **Developers → Webhooks → Add endpoint**
   - URL: `https://saymd.app/api/stripe-webhook-saymd`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Signing secret → `STRIPE_SAYMD_WEBHOOK_SECRET`
6. **Developers → API keys** — Secret key → `STRIPE_SECRET_KEY` (test mode first).

Promo `LAUNCH50` (€29 first year): create coupon in Dashboard, enable promotion codes on Checkout (already in API).

## Checkout billing fields

Checkout collects (via API in `create-checkout-saymd.js`):

- **Name** (`name_collection`)
- **Billing address + country** (`billing_address_collection: required`)
- **VAT / tax ID** for businesses (`tax_id_collection`)
- **Terms checkbox** (short custom text + Stripe ToS URL in Dashboard)

**Note:** Stripe Managed Payments (default on new accounts) blocks `custom_text` and requires product tax codes. Checkout passes `managed_payments: { enabled: false }` until you upgrade API version and configure tax codes for Managed Payments.

## Vercel env (`saymd-app` project only)

```bash
SAYMD_SALES_ENABLED=0          # flip to 1 after E2E test
SAYMD_SITE_URL=https://saymd.app
STRIPE_SECRET_KEY=sk_test_...  # saymd account only — not VCL key
STRIPE_SAYMD_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_SAYMD_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_SAYMD_WEBHOOK_SECRET=whsec_...
STRIPE_SAYMD_BILLING_PORTAL_URL=https://billing.stripe.com/p/login/...
SAYMD_LICENSE_PRIVATE_KEY_DER_B64=...
DATABASE_URL=...               # Neon — licenses table
```

Never reuse `STRIPE_SECRET_KEY` or webhook secrets from vibecoderslife.com.

## Test flow

```bash
stripe login   # saymd account
stripe listen --forward-to https://<preview>.vercel.app/api/stripe-webhook-saymd
# complete test Checkout → success page shows license → saymd activate <key>
```

Then `SAYMD_SALES_ENABLED=1` on production.
