#!/usr/bin/env node
/**
 * A2–A4 ops smoke against production saymd.app + Neon + Stripe test mode.
 * Loads env from saymd/.env (key names only logged).
 *
 * Usage: node scripts/a2-a4-ops-smoke.js
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function loadEnvFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

const envPath = path.resolve(__dirname, '../.env');
loadEnvFile(envPath);

const BASE = process.env.SAYMD_SITE_URL || 'https://saymd.app';
const CLI = path.resolve(__dirname, '../packages/cli/dist/cli.js');

function ok(msg) {
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exitCode = 1;
}

async function run() {
  let Stripe;
  try {
    Stripe = require('/Users/kondasviktor/Documents/saymd-app/node_modules/stripe');
  } catch {
    try {
      Stripe = require('stripe');
    } catch {
      fail('Install stripe in saymd-app (npm i stripe)');
      return;
    }
  }

  const { neon } = require('/Users/kondasviktor/Documents/saymd-app/node_modules/@neondatabase/serverless');

  console.log(`Base: ${BASE}`);
  console.log('Env present:', [
    'STRIPE_SECRET_KEY',
    'STRIPE_SAYMD_WEBHOOK_SECRET',
    'STRIPE_SAYMD_PRO_MONTHLY_PRICE_ID',
    'STRIPE_SAYMD_BILLING_PORTAL_URL',
    'DATABASE_URL',
    'SAYMD_PREVIEW_TOKEN',
    'SAYMD_SALES_ENABLED',
  ]
    .map((k) => `${k}=${process.env[k] ? 'yes' : 'NO'}`)
    .join(', '));

  // --- A2 billing portal ---
  {
    const res = await fetch(`${BASE}/api/billing-portal`, { redirect: 'manual' });
    const loc = res.headers.get('location') || '';
    if (res.status === 302 && loc.includes('billing.stripe.com')) ok(`A2 billing-portal → ${loc.slice(0, 48)}…`);
    else fail(`A2 billing-portal (${res.status}) ${loc}`);
  }

  // --- A2 create-checkout ---
  {
    const res = await fetch(`${BASE}/api/create-checkout-saymd`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'monthly' }),
    });
    const body = await res.json();
    if (res.ok && body.url?.includes('checkout.stripe.com')) ok('A2 create-checkout monthly URL ok');
    else fail(`A2 create-checkout (${res.status}) ${JSON.stringify(body)}`);
  }

  // --- A4 preview gate ---
  {
    const token = process.env.SAYMD_PREVIEW_TOKEN;
    const locked = await fetch(`${BASE}/`, { redirect: 'manual' });
    const loc = locked.headers.get('location') || '';
    if (
      (locked.status === 307 || locked.status === 302) &&
      loc.includes('coming-soon')
    ) {
      ok('A4 preview gate redirects locked visitors to coming-soon');
    } else if (locked.status === 200) {
      // may already have followed or public
      const text = await locked.text();
      if (/coming soon|Redirecting/i.test(text) || text.length < 500) {
        ok('A4 site not fully public yet (coming-soon / redirect body)');
      } else {
        fail(`A4 expected gate; got 200 open homepage (${text.slice(0, 80)})`);
      }
    } else {
      fail(`A4 gate unexpected ${locked.status} ${loc}`);
    }

    const unlock = await fetch(`${BASE}/?preview=${encodeURIComponent(token)}`, {
      redirect: 'manual',
    });
    const setCookie = unlock.headers.get('set-cookie') || '';
    if (
      (unlock.status === 307 || unlock.status === 302) &&
      setCookie.includes('saymd_preview=')
    ) {
      ok('A4 preview token sets saymd_preview cookie');
    } else {
      fail(`A4 preview unlock (${unlock.status}) cookie=${setCookie.slice(0, 60)}`);
    }
  }

  // --- A3 Neon ---
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`
    SELECT email, plan, activation_code, stripe_subscription_id, stripe_customer_id,
           valid_until, length(activation_code) AS code_len
    FROM saymd_licenses
    ORDER BY created_at DESC NULLS LAST
    LIMIT 5
  `;
  if (!rows.length) {
    fail('A3 Neon: no saymd_licenses rows');
  } else {
    const r = rows[0];
    ok(
      `A3 Neon latest: plan=${r.plan} code_len=${r.code_len} sub=${r.stripe_subscription_id ? 'yes' : 'no'} until=${r.valid_until}`
    );
    if (r.code_len !== 24) fail(`A3 expected 24-char activation code, got ${r.code_len}`);
    else ok('A3 activation_code length 24');
    if (!r.stripe_subscription_id) fail('A3 missing stripe_subscription_id on latest row');
    else ok('A3 stripe_subscription_id present');
  }

  const latest = rows[0];

  // --- A3 activate mixed-case ---
  if (latest?.activation_code) {
    const mixed = latest.activation_code
      .split('')
      .map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase()))
      .join('');
    const res = await fetch(`${BASE}/api/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: mixed }),
    });
    const body = await res.json();
    if (res.ok && body.licenseKey && body.licenseKey.includes('.')) {
      ok('A3 activate mixed-case code → signed licenseKey');
    } else {
      fail(`A3 activate mixed-case (${res.status}) ${JSON.stringify(body)}`);
    }
  }

  // --- A2 cancel at period end via Stripe API ---
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  if (latest?.stripe_subscription_id) {
    const before = await stripe.subscriptions.retrieve(latest.stripe_subscription_id);
    const updated = await stripe.subscriptions.update(latest.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    if (updated.cancel_at_period_end === true) {
      ok(
        `A2 cancel_at_period_end=true (status=${updated.status}, period_end=${new Date(
          updated.current_period_end * 1000
        ).toISOString()})`
      );
    } else {
      fail('A2 failed to set cancel_at_period_end');
    }
    // Restore for continued testing unless it was already cancelling
    if (!before.cancel_at_period_end) {
      await stripe.subscriptions.update(latest.stripe_subscription_id, {
        cancel_at_period_end: false,
      });
      ok('A2 restored cancel_at_period_end=false for continued Pro testing');
    } else {
      ok('A2 left cancel_at_period_end=true (was already set)');
    }
  } else {
    fail('A2 skip cancel test — no subscription id');
  }

  // --- Stripe webhook endpoint listing (best-effort) ---
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    const saymd = endpoints.data.filter((e) => e.url.includes('stripe-webhook-saymd'));
    if (!saymd.length) fail('A3 no Stripe webhook endpoint URL containing stripe-webhook-saymd');
    else {
      for (const e of saymd) {
        const need = [
          'checkout.session.completed',
          'invoice.paid',
          'customer.subscription.updated',
          'customer.subscription.deleted',
        ];
        const missing = need.filter((ev) => !e.enabled_events.includes(ev) && !e.enabled_events.includes('*'));
        if (missing.length && !e.enabled_events.includes('*')) {
          fail(`A3 webhook ${e.url} missing events: ${missing.join(', ')}`);
        } else {
          ok(`A3 webhook configured: ${e.url} status=${e.status}`);
        }
      }
    }
  } catch (err) {
    fail(`A3 webhook list: ${err.message}`);
  }

  // --- A4 config mode ---
  const cfg = path.join(process.env.HOME, '.saymd/config.json');
  const st = fs.statSync(cfg);
  const mode = (st.mode & 0o777).toString(8);
  if (mode === '600') ok('A4 ~/.saymd/config.json mode 600');
  else fail(`A4 config mode ${mode} (want 600)`);

  // --- Free Pro gates (temporarily hide license) ---
  const lic = path.join(process.env.HOME, '.saymd/license.json');
  const bak = path.join(process.env.HOME, '.saymd/license.json.a2a4bak');
  fs.renameSync(lic, bak);
  try {
    const cont = spawnSync(process.execPath, [CLI, '--continue', '.ai/01-feature.md', '--file', 'fixtures/01-feature-en.aiff'], {
      cwd: path.join(process.env.HOME, 'Documents/saymd-test'),
      encoding: 'utf8',
    });
    const out = `${cont.stdout}\n${cont.stderr}`;
    if (/--continue is Pro|is Pro/i.test(out) && cont.status !== 0) ok('A2 Free gate: --continue blocked without license');
    else fail(`A2 Free gate continue unexpected status=${cont.status} out=${out.slice(0, 200)}`);

    const rev = spawnSync(process.execPath, [CLI, '--review', '.ai/01-feature.md'], {
      cwd: path.join(process.env.HOME, 'Documents/saymd-test'),
      encoding: 'utf8',
    });
    const rout = `${rev.stdout}\n${rev.stderr}`;
    if (/--review is Pro|is Pro/i.test(rout) && rev.status !== 0) ok('A2 Free gate: --review blocked without license');
    else fail(`A2 Free gate review unexpected status=${rev.status} out=${rout.slice(0, 200)}`);

    const outp = spawnSync(
      process.execPath,
      [CLI, '--out', 'en', '--file', 'fixtures/05-feature-hu.aiff', '-o', '.ai/gate-out.md'],
      { cwd: path.join(process.env.HOME, 'Documents/saymd-test'), encoding: 'utf8' }
    );
    const oout = `${outp.stdout}\n${outp.stderr}`;
    if (/--out is Pro|is Pro/i.test(oout) && outp.status !== 0) ok('A2 Free gate: --out blocked without license');
    else fail(`A2 Free gate out unexpected status=${outp.status} out=${oout.slice(0, 200)}`);
  } finally {
    fs.renameSync(bak, lic);
    ok('Restored ~/.saymd/license.json');
  }

  // Invoice email setting — Stripe API account setting is not always readable; log reminder
  ok('A3 invoice emails: confirm OFF in Stripe Dashboard → Settings → Customer emails (manual)');

  if (process.exitCode) console.error('\nSome checks failed');
  else console.log('\nAll automated A2–A4 checks passed');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
