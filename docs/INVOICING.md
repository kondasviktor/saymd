# Szamlazz.hu invoicing — saymd Pro (manual v1)

Annual-first to limit manual work. Same Stripe account as VCL Playbook.

## Trigger

- **Weekly batch** (recommended): every Monday, invoice all Stripe charges from the prior week.
- **Do not** issue per-checkout unless your accountant requires it — confirm NAV obligations first.

## Automation trigger (plan)

If **monthly subscribers exceed 10**, either:

1. Automate Szamlazz.hu (API or export), or  
2. Retire the monthly plan and keep annual only.

## Per paid subscription (manual steps)

1. Open Stripe → Customers → find payer from `checkout.session.completed` (filter metadata `sku=saymd_pro`).
2. Copy: legal name, billing address, country, tax ID (if collected), email, amount, currency, payment date.
3. Issue invoice in Szamlazz.hu (EUR; HUF equivalent if required by your setup).
4. Email PDF to customer. **Never mention Szamlazz.hu on the public site.**

## What the customer receives from Stripe

- Payment receipt only (not a Hungarian tax invoice).

## Launch promo

- Stripe code `LAUNCH50` → first 50 annual at **€29** (configure in Stripe Dashboard).

## Grandfathering

- Early subscribers keep their price while subscription stays active — state on landing page.

## Refunds

- 14-day no-questions refund on annual (manual in Stripe + credit note in Szamlazz if invoice already issued).
- Monthly: cancel anytime via Stripe Customer Portal.
