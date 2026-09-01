# GitHub repos and Vercel

| Repo | Visibility | Contents | Vercel? |
|------|------------|----------|---------|
| [kondasviktor/saymd](https://github.com/kondasviktor/saymd) | Private until launch → **public** | MIT CLI (`packages/cli`), README, tests | **No** |
| [kondasviktor/saymd-app](https://github.com/kondasviktor/saymd-app) | **Private always** | Landing site, Stripe API routes, Neon, Pro bundle source | **Yes** |

## Import in Vercel: `saymd-app`

Point Vercel at **kondasviktor/saymd-app**, not `saymd`.

- Root directory: `/` (if repo root is the landing app) or `landing/` if you keep a subfolder.
- Domain: `saymd.app`
- Env vars: see [STRIPE_SAYMD.md](./STRIPE_SAYMD.md)

The public CLI repo is for GitHub + npm only. Customers never need to clone it to buy Pro.

## Local → remote layout (suggested)

**saymd** (public CLI repo):

```text
packages/cli/
README.md
LICENSE
```

**saymd-app** (private):

```text
index.html
privacy.html
terms.html
success.html
styles.css
vercel.json
api/
packages/pro/          # closed Pro bundle + activate download API
```

Until you split, `gemini-transcribe/saymd/landing/` is the source for **saymd-app**.

## Launch day

1. Deploy saymd-app to Vercel (already live).
2. Flip `kondasviktor/saymd` to public.
3. `npm publish` from `packages/cli`.
4. `SAYMD_SALES_ENABLED=1`.
