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
saymd activate <activation-code>
```

€39/yr (primary) · €5/mo · BYOK · no hosted STT

Pro logic ships as a separate proprietary package (`@saymd/pro`), **not** in this MIT repository.

## Requirements

- Node 20+
- ffmpeg
- macOS or Linux (Windows: WSL or `--file` only)

```bash
saymd doctor
saymd help
```

## Repo layout

This repository is the **MIT CLI only** (`packages/cli`).

| Repo | Role |
|------|------|
| `kondasviktor/saymd` | Public MIT CLI |
| `kondasviktor/saymd-pro` | Private `@saymd/pro` |
| `kondasviktor/saymd-app` | Private landing + Stripe (Vercel) |

See [docs/REPOS.md](./docs/REPOS.md).

## Develop

```bash
npm install
npm run build
npm test
node packages/cli/dist/cli.js doctor
```

For Pro features locally, link the private package (see REPOS.md).

## License

- CLI (`saymd`): MIT
- `@saymd/pro`: proprietary (separate private repo; subscribers only)
