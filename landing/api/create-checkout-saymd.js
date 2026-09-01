/**
 * POST /api/create-checkout-saymd — Stripe subscription for saymd Pro
 * Body: { plan: 'annual' | 'monthly' }
 */
const Stripe = require('stripe');

module.exports.config = { maxDuration: 15 };

function json(res, status, body) {
  return res.status(status).json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (process.env.SAYMD_SALES_ENABLED !== '1') {
    return json(res, 503, { ok: false, error: 'Pro checkout is not open yet.' });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return json(res, 503, { ok: false, error: 'Stripe not configured.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const plan = body?.plan === 'monthly' ? 'monthly' : 'annual';
  const priceId =
    plan === 'monthly'
      ? process.env.STRIPE_SAYMD_PRO_MONTHLY_PRICE_ID
      : process.env.STRIPE_SAYMD_PRO_ANNUAL_PRICE_ID;

  if (!priceId) {
    return json(res, 503, { ok: false, error: 'Price not configured.' });
  }

  const siteUrl = (process.env.SAYMD_SITE_URL || 'https://saymd.app').replace(/\/$/, '');
  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/?cancelled=1`,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_creation: 'always',
      allow_promotion_codes: true,
      consent_collection: { terms_of_service: 'required' },
      custom_text: {
        terms_of_service_acceptance: {
          message:
            'I agree to the Terms of Service and acknowledge immediate access to digital Pro features.',
        },
      },
      metadata: {
        brand: 'saymd',
        sku: 'saymd_pro',
        plan,
      },
    });

    return json(res, 200, { ok: true, url: session.url });
  } catch (err) {
    console.error('saymd checkout failed:', err.message);
    return json(res, 500, { ok: false, error: err.message || 'Checkout failed' });
  }
};
