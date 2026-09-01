/**
 * GET /api/license-by-session?session_id=cs_...
 */
const Stripe = require('stripe');
const { getLicenseBySession } = require('../lib/db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sessionId = req.query?.session_id;
  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Missing session_id' });
  }

  try {
    let licenseKey = await getLicenseBySession(sessionId);

    if (!licenseKey && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'paid' || session.status === 'complete') {
        licenseKey = await getLicenseBySession(sessionId);
      }
    }

    if (!licenseKey) {
      return res.status(404).json({
        error: 'License not ready yet. Wait a few seconds and refresh, or email support@saymd.app.',
      });
    }

    return res.status(200).json({ licenseKey });
  } catch (err) {
    console.error('license-by-session:', err.message);
    return res.status(500).json({ error: 'Could not load license.' });
  }
};
