# GitHub repos

| Repo | Visibility | Contents | Vercel? |
|------|------------|----------|---------|
| [kondasviktor/saymd](https://github.com/kondasviktor/saymd) | Private until launch → **public** | MIT CLI (`packages/cli`) only | **No** |
| [kondasviktor/saymd-pro](https://github.com/kondasviktor/saymd-pro) | **Private always** | `@saymd/pro` — continue, review, `--out`, vocab, duration, license verify | **No** |
| [kondasviktor/saymd-app](https://github.com/kondasviktor/saymd-app) | **Private always** | Landing, Stripe, Neon, activation API | **Yes** → saymd.app |

Do **not** mirror landing code into `saymd`, and do **not** put Pro implementation into the MIT CLI repo (even behind a license check). The MIT tree may dynamically `import('@saymd/pro')` and show a paywall. Merge, review, cross-language prompts, vocab addendum, and Pro recording limits must live only in `saymd-pro`.

## Layout

**saymd** (MIT CLI):

```text
packages/cli/
README.md
LICENSE
docs/
```

**saymd-pro** (proprietary):

```text
src/          # merge, review, compiler addendum, limits, license
LICENSE       # subscribers only
package.json  # @saymd/pro
```

**saymd-app** (private site):

```text
index.html, pricing.html, success.html, …
api/          # checkout, webhook, activate, …
lib/
```

## Local CLI + Pro (maintainers)

```bash
cd ~/Documents/saymd-pro && npm install && npm run build && npm link
cd ~/Documents/gemini-transcribe/saymd/packages/cli && npm link @saymd/pro
cd ~/Documents/gemini-transcribe/saymd && npm run build -w saymd
```

Never add `file:…/saymd-pro` or `optionalDependencies` on `@saymd/pro` to the MIT `package.json`. The CLI loads Pro with a dynamic import after the user installs that package separately. Until `@saymd/pro` is published, `npm link` is the maintainer path.

## Vercel

Point Vercel at **kondasviktor/saymd-app** only (repo root = site). Never deploy `saymd` or `saymd-pro` to Vercel.

## Launch day

1. saymd-app live on Vercel.
2. Flip `saymd` to public + `npm publish` (MIT CLI).
3. Keep `saymd-pro` private; distribute `@saymd/pro` via private npm / GitHub Packages / post-purchase install when ready.
4. `SAYMD_SALES_ENABLED=1`.

## Go-live

See [NEXT_STEPS.md](./NEXT_STEPS.md) for testing and production checklist. Marketplaces stay off until that is done.
