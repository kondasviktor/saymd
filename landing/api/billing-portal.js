/**
 * GET /api/billing-portal — send the customer to Stripe (no saymd login).
 * They enter the email they used at Checkout, then manage card, invoices, cancel.
 *
 * Set STRIPE_SAYMD_BILLING_PORTAL_URL from Stripe Dashboard:
 * Settings → Billing → Customer portal → Login page (activate) → copy the link.
 */
module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const url = process.env.STRIPE_SAYMD_BILLING_PORTAL_URL;
  if (url && /^https:\/\/(billing\.stripe\.com|invoice\.stripe\.com)\//.test(url)) {
    res.setHeader('Location', url);
    return res.status(302).end();
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(503).send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Manage subscription — saymd</title>
<link rel="stylesheet" href="/styles.css"></head>
<body>
<main class="legal-page">
  <h1>Manage subscription</h1>
  <p>The Stripe customer portal is not connected yet. Email
  <a href="mailto:support@saymd.app">support@saymd.app</a> with your purchase email
  to update your card, download invoices, or cancel.</p>
  <p class="legal-back"><a href="/">← Back to saymd.app</a></p>
</main>
</body></html>`);
};
