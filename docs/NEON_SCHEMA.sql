-- Run in Neon SQL editor (saymd-app project)

CREATE TABLE IF NOT EXISTS saymd_licenses (
  id SERIAL PRIMARY KEY,
  stripe_session_id TEXT UNIQUE NOT NULL,
  stripe_customer_id TEXT,
  email TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('annual', 'monthly')),
  license_key TEXT NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saymd_licenses_email_idx ON saymd_licenses (email);
