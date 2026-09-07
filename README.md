# saymd

**Speak once. Get a prompt file any agent can @.**

Free MIT CLI. You bring your own speech-to-text key. saymd does not host audio or sell minutes.

Pro (`--continue`, `--review`, `--out`, vocab, longer recordings) is a **separate proprietary package**. It is not in this repository. Removing a check in this CLI does not unlock Pro.

## Start here — Free

```bash
npx saymd setup
npx saymd doctor
npx saymd -o .ai/prompt.md --template feature --seconds 30
```

Speak naturally, then press **Enter** when finished (you do not need to wait for the maximum).

Open `.ai/prompt.md` and `@` it in Cursor, Claude Code, Codex, Gemini CLI, Copilot, or any agent that can read Markdown.

The raw transcript is not the main artifact — the structured spec is.

Default output shape (no `--template`): **Objective / Context / Instructions / Constraints**.

## Languages — Free

Auto-detect, 85+ languages. Markdown is written in the **same language you spoke**.

```bash
saymd --lang hu          # optional hint if auto-detect is wrong
saymd --out en           # Pro: speak one language, write the spec in another
```

## Templates — Free

Same audio in; different markdown out.

| `--template` | Headings |
|--------------|----------|
| `feature` | Objective, Context, Instructions, Constraints, Acceptance criteria |
| `bug` | Objective, Context, Steps to reproduce, Expected / Actual |
| `plan` | Objective, Context, numbered Steps, Constraints, Open questions |
| _(none)_ | Objective, Context, Instructions, Constraints |

```bash
saymd --template bug -o .ai/bug.md
saymd --file idea.m4a --template feature -o .ai/feature.md
```

Supported audio: mp3, m4a, wav, ogg, opus, flac, webm, aiff, caf, mp4, mov

## Recording

Press **Enter** to stop.

- **Free:** up to 60 seconds per recording (default 60s)
- **Pro:** default 120 seconds, up to 10 minutes per recording

```bash
saymd --seconds 30       # shorter first test
```

## Providers — BYOK

You pay the speech-to-text provider on your own account.

| Provider | Notes |
|----------|--------|
| **Gemini** (recommended) | STT + structuring |
| OpenAI | STT + structuring |
| Deepgram | STT only — also needs a Gemini or OpenAI key to structure Markdown |
| ElevenLabs | STT only — same as Deepgram |

```bash
saymd setup                              # provider + key (clipboard or hidden paste)
saymd config                             # current provider (never prints the key)
saymd config set provider openai
```

Keys live in `~/.saymd/config.json` (mode 0600) or env: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `DEEPGRAM_API_KEY`, `ELEVENLABS_API_KEY`.

## Pro — when you need more

Upgrade at [saymd.app](https://saymd.app), then:

```bash
saymd activate <activation-code>
saymd --continue .ai/prompt.md     # add more speech; merge into the same spec
saymd --review .ai/prompt.md       # missing requirements, constraints, acceptance criteria
saymd --out en                     # speak one language → write the spec in another
```

`.saymd/vocab.txt` — project names, APIs, acronyms (one per line). Ignored on Free.

Pro implementation ships as `@saymd/pro` from a **private** repo. This MIT tree only has a dynamic import and a paywall message.

## Privacy

API keys stay on this machine. Audio is sent only to the STT provider you chose, using your key. saymd does not receive your audio, transcripts, or prompt files.

[Privacy](https://saymd.app/privacy.html)

## Requirements

- Node 20+
- ffmpeg
- macOS or Linux (Windows: WSL or `--file` only)

```bash
saymd help                 # this start-here guide
saymd --help               # full option list
```

## Repo layout

This repository is the **MIT CLI only** (`packages/cli`).

| Repo | Role |
|------|------|
| `kondasviktor/saymd` | MIT CLI (this repo) |
| `kondasviktor/saymd-pro` | Private `@saymd/pro` — never MIT |
| `kondasviktor/saymd-app` | Private landing + Stripe (Vercel → saymd.app) |

See [docs/REPOS.md](./docs/REPOS.md).

## Develop

```bash
npm install
npm run build
npm test
node packages/cli/dist/cli.js doctor
```

Pro locally: build and `npm link` `@saymd/pro` from the private `saymd-pro` repo. Do not add a `file:` dependency in this package — that would ship a path to Pro source.

## License

- CLI (`saymd`): MIT
- `@saymd/pro`: proprietary (separate private repo; subscribers only)
