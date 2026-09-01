# saymd

**Speak once. Get a prompt file any agent can @.**

Free MIT CLI for developers. Pro adds `--continue`, `--review`, and cross-language output (`--out en`).

## Install

```bash
npx saymd setup
npx saymd
npx saymd --file idea.m4a --template feature
```

## BYOK — Bring Your Own Key

You pay the speech-to-text provider on **your** account. saymd never sells transcription minutes.

| Provider | STT model | Setup |
|----------|-----------|-------|
| **Gemini** (recommended) | gemini-3.5-transcribe | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| OpenAI | gpt-4o-transcribe | [OpenAI API keys](https://platform.openai.com/api-keys) |
| Deepgram | nova-3 | [Deepgram console](https://console.deepgram.com/) |
| ElevenLabs | scribe_v2 | [ElevenLabs API keys](https://elevenlabs.io/app/settings/api-keys) |

```bash
saymd setup                              # interactive provider + key picker
saymd config set provider openai         # change default
saymd --provider deepgram --file x.m4a   # one-off override
```

Deepgram and ElevenLabs are STT-only — `saymd setup` also asks for a Gemini or OpenAI key to structure the transcript into Markdown.

Keys live in `~/.saymd/config.json` (mode 0600) or env: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`.

## Free

- Mic or `--file` (MP3, M4A, WAV, …)
- Four STT providers (BYOK) — all on Free
- 85+ languages in → **same language** out (auto-detect)
- `--lang de` when you know the spoken language
- Templates: `feature`, `bug`, `plan`
- Output: `.ai/prompt.md` (override with `-o`)
- `--raw`, `--stdout`, `--clipboard`, `--json`, `--diff`

## Pro ([saymd.app](https://saymd.app))

```bash
saymd --continue .ai/prompt.md
saymd --review .ai/prompt.md
saymd --out en          # think HU, ship EN
saymd activate <key>
```

€39/yr (primary) · €5/mo · BYOK · no hosted STT

## Requirements

- Node 20+
- ffmpeg
- macOS or Linux (Windows: WSL or `--file` only)

```bash
saymd doctor
```

## Monorepo

| Path | Package |
|------|---------|
| `packages/cli` | `saymd` (MIT) |
| `packages/pro` | `@saymd/pro` (closed) |
| `landing/` | saymd.app static + Stripe API → push to **saymd-app** repo |
| `docs/` | invoicing, GTM, [DEPLOY.md](./docs/DEPLOY.md), [STRIPE_SAYMD.md](./docs/STRIPE_SAYMD.md), [MARKETPLACE_PLAN.md](./docs/MARKETPLACE_PLAN.md) |

## Develop

```bash
npm install
npm run build
npm test
node packages/cli/dist/cli.js doctor
```

Optional live smoke (requires your API keys):

```bash
chmod +x scripts/live-smoke.sh
GEMINI_API_KEY=... ./scripts/live-smoke.sh sample.m4a
```

## License

- CLI: MIT
- `@saymd/pro`: proprietary (subscribers only)
