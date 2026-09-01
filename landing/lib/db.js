const { neon } = require('@neondatabase/serverless');

let sql;

function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL not configured');
    sql = neon(url);
  }
  return sql;
}

/** Run once in Neon SQL editor — see docs/NEON_SCHEMA.sql */
async function saveLicense({
  stripeSessionId,
  stripeCustomerId,
  email,
  plan,
  licenseKey,
  validUntil,
}) {
  const db = getSql();
  await db`
    INSERT INTO saymd_licenses (
      stripe_session_id, stripe_customer_id, email, plan, license_key, valid_until
    ) VALUES (
      ${stripeSessionId}, ${stripeCustomerId}, ${email}, ${plan}, ${licenseKey}, ${validUntil}
    )
    ON CONFLICT (stripe_session_id) DO UPDATE SET
      license_key = EXCLUDED.license_key,
      valid_until = EXCLUDED.valid_until
  `;
}

async function getLicenseBySession(stripeSessionId) {
  const db = getSql();
  const rows = await db`
    SELECT license_key FROM saymd_licenses
    WHERE stripe_session_id = ${stripeSessionId}
    LIMIT 1
  `;
  return rows[0]?.license_key || null;
}

module.exports = { saveLicense, getLicenseBySession };
