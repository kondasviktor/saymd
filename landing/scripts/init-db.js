#!/usr/bin/env node
/**
 * Apply Neon schema. Reads DATABASE_URL from env or saymd/.env.
 */
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { neon } = require('@neondatabase/serverless');

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const envPath = resolve(__dirname, '../../.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) process.env.DATABASE_URL = m[1].trim();
  }
}

async function main() {
  loadEnv();
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS saymd_licenses (
      id SERIAL PRIMARY KEY,
      stripe_session_id TEXT UNIQUE NOT NULL,
      stripe_customer_id TEXT,
      email TEXT NOT NULL,
      plan TEXT NOT NULL CHECK (plan IN ('annual', 'monthly')),
      license_key TEXT NOT NULL,
      valid_until TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS saymd_licenses_email_idx ON saymd_licenses (email)
  `;

  console.log('Neon schema applied (saymd_licenses).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
