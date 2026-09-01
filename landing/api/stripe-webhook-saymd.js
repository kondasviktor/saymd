/**
 * POST /api/stripe-webhook-saymd — issue license on checkout.session.completed
 */
const Stripe = require('stripe');
const { sign, createPrivateKey } = require('crypto');
const { saveLicense } = require('../lib/db');

module.exports.config = { api: { bodyParser: false } };

function createLicenseKey(payload, privateKeyDerB64) {
  const priv = createPrivateKey({
    key: Buffer.from(privateKeyDerB64, 'base64'),
    format: 'der',
    type: 'pkcs8',
  });
  const key = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(null, Buffer.from(JSON.stringify(payload)), priv).toString('base64');
  return `${key}.${signature}`;
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_SAYMD_WEBHOOK_SECRET;
  const privateKey = process.env.SAYMD_LICENSE_PRIVATE_KEY_DER_B64;

  if (!stripeKey || !webhookSecret || !privateKey) {
    return res.status(503).json({ error: 'Webhook not configured' });
  }

  const stripe = new Stripe(stripeKey);
  const sig = req.headers['stripe-signature'];
  const raw = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.metadata?.sku !== 'saymd_pro') {
      return res.status(200).json({ received: true, skipped: true });
    }

    const email = session.customer_details?.email || session.customer_email || 'unknown';
    const plan = session.metadata?.plan === 'monthly' ? 'monthly' : 'annual';
    const validUntil = new Date();
    if (plan === 'monthly') validUntil.setMonth(validUntil.getMonth() + 1);
    else validUntil.setFullYear(validUntil.getFullYear() + 1);

    const licenseKey = createLicenseKey(
      {
        email,
        plan,
        validUntil: validUntil.toISOString(),
        issuedAt: new Date().toISOString(),
      },
      privateKey
    );

    try {
      await saveLicense({
        stripeSessionId: session.id,
        stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
        email,
        plan,
        licenseKey,
        validUntil: validUntil.toISOString(),
      });
      console.log('saymd license saved for', email, plan, session.id);
    } catch (err) {
      console.error('saymd license save failed:', err.message);
      return res.status(500).json({ error: 'License save failed' });
    }
  }

  return res.status(200).json({ received: true });
};
