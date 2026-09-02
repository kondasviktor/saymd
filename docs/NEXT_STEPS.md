# saymd — next steps (go-live)

Last updated: 2026-09-02  
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

Ensure `@saymd/pro` resolves (`file:../../../../saymd-pro` or `npm link`).

### A1. Free path

- [ ] `saymd doctor` — ffmpeg, mic, key OK  
- [ ] `saymd help` / `saymd --help` — providers, templates, privacy link, audio formats  
- [ ] `saymd -o .ai/free.md --template feature --seconds 60` — Enter to stop; structured markdown  
- [ ] Language auto-detect (e.g. HU → `(hu)`, same-language body)  
- [ ] `--template bug` and `--template plan` produce correct headings  
- [ ] `--file sample.m4a` (or mp3/wav) works  
- [ ] Without license: `saymd --continue .ai/free.md` — **Pro gate, no recording**  
- [ ] Without license: `saymd --review .ai/free.md` and `saymd --out en` — Pro gate  

### A2. Pro path (test mode Stripe)

- [ ] Fresh Checkout → success page shows **24-char activation code** (not long blob)  
- [ ] `saymd activate <code>` → plan + `validUntil`  
- [ ] `saymd --continue <file>` — max **120s** default; Enter stops; merge keeps template (plan → numbered Steps)  
- [ ] New speech polished into existing tone (no raw “add the field” fragments)  
- [ ] `saymd --review <file>` — gaps + suggested continue  
- [ ] `saymd --out en --template feature -o .ai/en.md` — speak non-EN → English spec  
- [ ] `.saymd/vocab.txt` (one term per line) respected on Pro; ignored/warned on Free  
- [ ] Billing portal link (`/api/billing-portal`) opens Stripe login  
- [ ] Cancel at period end in portal — access until `validUntil` / period end (webhook sync)  

### A3. Backend / webhook sanity

- [ ] Stripe Dashboard → webhook endpoint: `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted` (+ checkout async if kept)  
- [ ] Neon row has `activation_code`, `stripe_subscription_id`, `valid_until`  
- [ ] `POST /api/activate` case-insensitive / mixed-case code works  
- [ ] Invoice emails **off**; receipt emails OK; számla via szamlazz.hu (process defined)  

### A4. Security / ops smoke

- [ ] No API keys in shell history (`grep` history empty for keys)  
- [ ] `~/.saymd/config.json` mode 0600  
- [ ] Preview gate still works if `SAYMD_PUBLIC=0`  

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

Today Pro works via local `file:` / `npm link` only. Pick one and implement:

- [ ] **Chosen approach** documented (GitHub Packages private scope, or post-purchase tarball/install script, or gated download from saymd.app)  
- [ ] Buyer after `saymd activate` can run `--continue` **without** your laptop  
- [ ] MIT CLI still has **no** Pro source; optionalDependency / install instructions only  

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

1. Finish **A** (detailed testing) on test Stripe  
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
```
