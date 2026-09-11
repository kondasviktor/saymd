# GitHub repos

| Repo | Visibility | Contents | Vercel? |
|------|------------|----------|---------|
| [kondasviktor/saymd](https://github.com/kondasviktor/saymd) | **Public** (MIT) | Free CLI (`packages/cli`) only | **No** |
| [kondasviktor/saymd-pro](https://github.com/kondasviktor/saymd-pro) | **Private** | `@saymd/pro` — continue, review, `--out`, vocab, duration, license verify | **No** |
| [kondasviktor/saymd-app](https://github.com/kondasviktor/saymd-app) | **Private** | Landing, Stripe, activation API | **Yes** → [saymd.app](https://saymd.app) |

Do **not** put Pro implementation into this MIT CLI repo (even behind a license check). The Free CLI may dynamically `import('@saymd/pro')` and show a paywall. Merge, review, cross-language prompts, vocab, and Pro recording limits live only in `saymd-pro`.

## Layout (this repo)

```text
packages/cli/     # npm package `saymd`
skills/saymd/     # optional agent skill
wrappers/         # marketplace stubs (not published yet)
README.md
LICENSE
docs/REPOS.md
```

## Develop

```bash
npm install
npm run build
npm test
node packages/cli/dist/cli.js doctor
```

Pro locally (maintainers with access to the private `saymd-pro` repo): build and `npm link` `@saymd/pro`. Never add a `file:` dependency on Pro in this package.

## License

- CLI (`saymd`): MIT
- `@saymd/pro`: proprietary (private repo; subscribers only)
