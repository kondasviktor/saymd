# Go-to-market — saymd

Time-boxed so this does not eat Actor publish time.

## Launch sequence (after Free CLI + GIF on GitHub)

1. **GitHub README** — 10s GIF: messy speech → clean `.ai/prompt.md`. Second GIF: HU speech → EN spec (Pro).
2. **Show HN** — "saymd — speak messy, get a prompt file any agent can @"
3. **HU/DE/ES/FR/PL communities** — cross-language Pro hook (Copilot voice: EN+ES only)
4. **r/ClaudeAI, r/cursor, r/LocalLLaMA**
5. **Product Hunt** — after ~50 GitHub stars
6. **VCL post + newsletter** — **not** same week as Playbook flip (1 Sep) or image-prompts post (4 Sep) or Actor publish week

## npm / SEO keywords

`gemini`, `voice`, `prompt`, `cli`, `cursor`, `claude`, `speech-to-text`, `ai-agent`

Target lists: awesome-claude-code, awesome-ai-cli (manual PRs).

## Success metrics (kill criteria)

| When | Target | Action if miss |
|------|--------|----------------|
| 30 days after public repo | 100 GitHub stars + 300 npm downloads/week | Delay Stripe; keep iterating Free |
| 60 days after checkout live | 20 paying subs (~€780/yr) | Keep investing |
| Below half of above | — | **Park it** — Free repo stays, no more hours |

## Support

- Free: GitHub issues, best effort
- Pro: email, 2 business days

## No telemetry

Measure via npm, GitHub, Stripe only.

## Checkout go-live gate

Pro checkout (`SAYMD_SALES_ENABLED=1`) only after:

- [ ] Separate **saymd Stripe account** created (not VCL) — see [STRIPE_SAYMD.md](./STRIPE_SAYMD.md)
- [ ] Privacy + Terms live at saymd.app (Stripe business settings)
- [ ] `saymd activate` tested with signed license
- [ ] Webhook tested with Stripe CLI
- [ ] Customer Portal link on landing
- [ ] Resend email with license key (or manual email runbook for first 20)
