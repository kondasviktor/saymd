# Deploy saymd.app (saymd-app on Vercel)

Project: [saymd-app on Vercel](https://vercel.com/viktors-projects-298638fc/saymd-app)  
Repo: `kondasviktor/saymd-app` (private) — **repo root = `landing/` contents**

## Pre-launch (now)

Keep the site **not public** until checkout is tested end-to-end.

### 1. Vercel environment variables

Add in **Project → Settings → Environment Variables** (Production + Preview):

| Variable | Value (now) | Notes |
|----------|-------------|--------|
| `SAYMD_PUBLIC` | `0` | **`1` only on launch day** |
| `SAYMD_PREVIEW_TOKEN` | random 32+ chars | e.g. `openssl rand -hex 24` |
| `SAYMD_SALES_ENABLED` | `0` | `1` after Stripe E2E test |
| `SAYMD_SITE_URL` | `https://saymd.app` | or preview URL while testing |
| `DATABASE_URL` | Neon pooled URL | from Neon dashboard |
| Stripe vars | (when ready) | see [STRIPE_SAYMD.md](./STRIPE_SAYMD.md) |

**Do not** commit `.env` — copy values into Vercel only.

### 2. Preview gate (middleware)

While `SAYMD_PUBLIC=0`:

- Everyone sees **Coming soon** (`/coming-soon.html`)
- **You** unlock with: `https://<your-vercel-url>/?preview=YOUR_SAYMD_PREVIEW_TOKEN` (once → 7-day cookie)
- **`/api/stripe-webhook-saymd`** stays open (Stripe must POST without a cookie)

Optional extra layer: Vercel **Deployment Protection** (password on production) under Project → Settings → Deployment Protection.

### 3. Neon schema

Run once in Neon SQL editor:

```bash
# or paste docs/NEON_SCHEMA.sql
```

File: [NEON_SCHEMA.sql](./NEON_SCHEMA.sql)

### 4. Push code to GitHub

```bash
cd landing   # contents go to saymd-app repo root
git add .
git commit -m "Pre-launch site with preview gate"
git push origin main
```

Vercel auto-deploys on push.

### 5. Test before DNS

Use the Vercel preview URL (e.g. `saymd-app-xxx.vercel.app`):

1. Coming soon without preview token ✓
2. `/?preview=TOKEN` → full landing ✓
3. Stripe test checkout → webhook → success page shows license ✓
4. `saymd activate <key>` locally ✓

Then flip `SAYMD_SALES_ENABLED=1` for checkout buttons (still behind preview gate).

---

## GoDaddy DNS → Vercel (when ready)

In Vercel: **Project → Settings → Domains → Add `saymd.app`**

Vercel shows the exact records. Typical GoDaddy setup:

| Type | Name | Value |
|------|------|--------|
| **A** | `@` | `76.76.21.21` |
| **CNAME** | `www` | `cname.vercel-dns.com` |

Remove conflicting GoDaddy parking records first. SSL is automatic once DNS propagates (often 5–60 min).

**Tip:** Add the domain in Vercel while `SAYMD_PUBLIC=0` — visitors still hit the coming-soon gate until you set `SAYMD_PUBLIC=1`.

---

## Launch day checklist

- [ ] Stripe live mode keys + webhook on production URL
- [ ] `SAYMD_PUBLIC=1`
- [ ] `SAYMD_SALES_ENABLED=1`
- [ ] Replace `robots.txt` with `Allow: /` or remove `Disallow`
- [ ] Flip `kondasviktor/saymd` repo to public + `npm publish`
- [ ] Show HN / communities

---

## Local `.env`

Root `saymd/.env` is for local scripts only. **Vercel does not read it** — duplicate vars in the dashboard.
