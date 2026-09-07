# saymd — next steps (go-live)

Last updated: 2026-09-07  
Marketplaces / agent wrappers: **OFF** until this list is done (see plan + `docs/MARKETPLACE_PLAN.md`).

All three GitHub repos stay **private** until you explicitly flip `saymd` public for launch.

| Repo | Role | Visibility |
|------|------|------------|
| `kondasviktor/saymd` | MIT CLI | private → public on launch day only |
| `kondasviktor/saymd-pro` | `@saymd/pro` | private always |
| `kondasviktor/saymd-app` | Landing + Stripe + Neon | private always |

---

## A. Detailed testing (required before live Stripe)

Run from a clean terminal with:

```bash
alias saymd='node /Users/kondasviktor/Documents/gemini-transcribe/saymd/packages/cli/dist/cli.js'
cd ~/Documents/saymd-test
```

Ensure `@saymd/pro` resolves via `npm link` (do not commit a `file:` path into the MIT repo).

Ops smoke (A2–A4 APIs / Neon / Stripe / gates): `node scripts/a2-a4-ops-smoke.js` from the saymd repo (loads `.env`).

### A1. Free path — **DONE** (2026-09-07)

- [x] `saymd doctor` — ffmpeg, mic, key OK  
- [x] `saymd help` / `saymd --help` — providers, templates, privacy link, audio formats  
- [x] Structured recording / `--file` fixtures (`scripts/e2e-fixtures.sh`)  
- [x] Language auto-detect / `--lang hu` — same-language body (tech terms may stay English)  
- [x] `--template bug` and `--template plan` produce correct headings  
- [x] Without license: `--continue` / `--review` / `--out` — **Pro gate, no recording** (re-verified in A2 smoke)

Optional: one live mic Enter-to-stop UX check anytime.

### A2. Pro path (test mode Stripe)

- [x] Fresh Checkout → success page shows **24-char activation code** (not long blob)  
- [x] `saymd activate <code>` → plan + `validUntil`  
- [x] `saymd --continue <file>` — merge keeps template (plan → numbered Steps); polished tone  
- [x] `saymd --review <file>` — gaps + suggested continue  
- [x] `saymd --out en` — HU/DE → English spec (Pro translate pass)  
- [x] `.saymd/vocab.txt` respected on Pro  
- [x] Billing portal link (`/api/billing-portal`) → Stripe customer portal login  
- [x] Cancel at period end via Stripe API (`cancel_at_period_end`) — access until period end; restored after smoke  

### A3. Backend / webhook sanity

- [x] Stripe webhook endpoint `https://saymd.app/api/stripe-webhook-saymd` enabled (incl. `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated` / `deleted`)  
- [x] Neon row has `activation_code` (24), `stripe_subscription_id`, `valid_until`  
- [x] `POST /api/activate` case-insensitive / mixed-case code works  
- [ ] Invoice emails **off** in Stripe Dashboard (manual confirm)  
- [ ] szamlazz.hu process defined (can wait until live volume)

### A4. Security / ops smoke

- [x] `~/.saymd/config.json` mode 0600  
- [x] Preview gate works (`SAYMD_PUBLIC` unset/0 → coming-soon; `/?preview=TOKEN` sets cookie)  
- [ ] No API keys in shell history (local bash_history still shows possible key patterns — clean if you pasted keys into the terminal)

There is no **A5** section in this checklist (A1–A4 only).

---

## B. Go-live switches (production)

### B1. Stripe live mode

- [ ] Dashboard → **Live** mode  
- [ ] Products/prices €39/year + €5/month → new live `price_…` IDs  
- [ ] Webhook on `https://saymd.app/api/stripe-webhook-saymd` with same event set → new `whsec_…`  
- [ ] Customer portal live login URL → `STRIPE_SAYMD_BILLING_PORTAL_URL`  
- [ ] Vercel **saymd-app** Production env: `STRIPE_SECRET_KEY` (`sk_live_…`), price IDs, webhook secret, portal URL  
- [ ] Redeploy production  
- [ ] One real €5 (or annual) purchase → activation code → `saymd activate`  

### B2. Site public

- [ ] Vercel: `SAYMD_PUBLIC=1`  
- [ ] `SAYMD_SALES_ENABLED=1` (already on for tests — confirm live)  
- [ ] robots allow indexing (dynamic `api/robots.js` / `SAYMD_PUBLIC`)  
- [ ] Spot-check pricing, terms, privacy, success, activate flow on https://saymd.app  

### B3. Publish MIT CLI

- [ ] Final README / version bump on `saymd`  
- [ ] Flip **only** `kondasviktor/saymd` to **public** (leave app + pro private)  
- [ ] `npm publish` from `packages/cli` (`npx saymd` works)  
- [ ] Fresh machine: `npx saymd setup` → doctor → one Free recording  

### B4. Distribute `@saymd/pro` to paying users

**Chosen approach:** Vercel Blob (private) + auto-download on `saymd activate`.

- [x] Private Blob store `saymd-pro` linked to saymd-app (`BLOB_READ_WRITE_TOKEN`)
- [x] Upload script: `saymd-app/scripts/upload-pro-blob.js` → `pro/saymd-pro.tgz`
- [x] `POST /api/activate` returns `pro.version` + download path
- [x] `POST /api/pro-download` streams tarball after valid activation code
- [x] CLI `saymd activate <code>` downloads + `npm install --prefix ~/.saymd`
- [ ] Redeploy saymd-app + one activate on a machine **without** `npm link` Pro
- [ ] MIT CLI still has **no** Pro source; no `file:` dependency

Re-upload after Pro releases:

```bash
cd ~/Documents/saymd-app
vercel env pull .env.local --yes
set -a && source .env.local && set +a
node scripts/upload-pro-blob.js
```

### B5. Invoicing (Hungary)

- [ ] Stripe invoice emails stay **off** (sandbox + live)  
- [ ] szamlazz.hu workflow: map Stripe payment → számla (manual OK for early volume)  
- [ ] Support email process for lost activation codes (Neon lookup by email)  

### B6. Copy / support polish

- [ ] Terms/pricing still saying “license key” → “activation code” where needed  
- [ ] Success page + help match live flow  

---

## C. Explicitly deferred (not go-live blockers)

- Agent marketplaces / Gemini / Cursor / Claude / Codex / VS Code / HF wrappers  
- AssemblyAI, cloud STT auto-routing, `--provider auto`  
- Windows native mic (WSL / `--file` is enough for v1)  
- Promo automation beyond Dashboard coupons  

---

## D. Suggested order

1. Finish remaining **A3/A4** manual ticks (invoice emails off, clean shell history)  
2. **B4** design Pro install path (don’t go live without a buyer-usable Pro package)  
3. **B1** live Stripe + one paid E2E  
4. **B2** `SAYMD_PUBLIC=1`  
5. **B3** public `saymd` + npm  
6. **B5–B6** invoicing + copy  
7. Only then reopen Phase 2 marketplaces  

---

## Quick commands

```bash
# Local CLI (dev)
alias saymd='node ~/Documents/gemini-transcribe/saymd/packages/cli/dist/cli.js'

# Rebuild after Pro changes
cd ~/Documents/saymd-pro && npm run build
cd ~/Documents/gemini-transcribe/saymd && npm run build -w saymd

# A2–A4 ops smoke (uses saymd/.env)
node scripts/a2-a4-ops-smoke.js
```
