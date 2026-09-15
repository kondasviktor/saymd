# saymd

**Speak once. Get a prompt file any agent can @.**

Agents execute. saymd delivers a usable spec — a Free MIT CLI that turns microphone speech or audio files into structured Markdown prompts. You bring your own speech-to-text key (**BYOK**). saymd does not host audio or sell transcription minutes.

**Works with:** Cursor · Claude Code · Codex · Grok Build · GitHub Copilot · Gemini CLI · OpenCode (and any agent that can `@` a Markdown file).

[![Codex / ChatGPT plugin](https://img.shields.io/badge/Codex%20%2F%20ChatGPT-Plugin%20Directory-412991?style=flat-square)](https://chatgpt.com/plugins/plugins_6aa7de5bf4f48191b8eb88fcf33e2f24)
[![Grok Build plugin](https://img.shields.io/badge/Grok%20Build-Plugin-111111?style=flat-square)](https://github.com/kondasviktor/saymd)
[![Gemini CLI extension](https://img.shields.io/badge/Gemini%20CLI-Extension-1a73e8?style=flat-square)](https://github.com/kondasviktor/saymd)

Pro (`--continue`, `--review`, `--out`, vocab, longer recordings) is a **separate proprietary package**. It is not in this repository. Removing a check in this CLI does not unlock Pro.

### Free includes

- Mic **or** existing audio via `--file`
- **85+ input languages** with automatic detection
- Structured Markdown (not a raw transcript dump)
- Templates: `feature`, `bug`, `plan` (or default headings)
- Exact BYOK models: `gemini-3.5-transcribe`, `gpt-4o-transcribe`, `nova-3`, `scribe_v2`

## Start here — Free

1. **Install** — `npx saymd setup` (pick a provider; key stays on this machine).
2. **Speak** — mic or `--file`; press **Enter** to stop (you do not need to wait for the maximum).
3. **@ the prompt** — open `.ai/prompt.md` in your agent.

```bash
npx saymd setup
npx saymd doctor
npx saymd -o .ai/prompt.md --template feature --seconds 30
```

`doctor` checks ffmpeg, microphone, provider, and API key before your first run.

![saymd --file demo](./assets/demo.gif)

## Install in Cursor / Claude / Codex / Grok / Gemini

This repo is the plugin package (shared skill + slash commands). The Free CLI stays `npx saymd`.

| Agent | Install |
|-------|---------|
| **Cursor** | Clone or add this repo as a plugin; local: symlink into `~/.cursor/plugins/local/saymd`. Manifest: `.cursor-plugin/plugin.json` |
| **Claude Code** | `claude plugin marketplace add kondasviktor/saymd` then install **saymd**. Or submit/install from the community catalog after approval. |
| **Codex** | Listed in the [OpenAI Plugins Directory](https://chatgpt.com/plugins/plugins_6aa7de5bf4f48191b8eb88fcf33e2f24) (ChatGPT + Codex). Manifest: `.codex-plugin/plugin.json` |
| **Grok Build** | DIY: `grok plugin marketplace add kondasviktor/saymd` then install **saymd**. Official catalog PR pending ([xai-org/plugin-marketplace](https://github.com/xai-org/plugin-marketplace)). Manifest: `.grok-plugin/plugin.json` |
| **Gemini CLI** | `gemini extensions install https://github.com/kondasviktor/saymd` (root `gemini-extension.json` + `GEMINI.md`) |

Slash commands: `/saymd`, `/saymd-feature`, `/saymd-bug`, `/saymd-plan`, `/saymd-continue`, `/saymd-review`, `/saymd-out`.

Native loop: run local CLI → `@` `.ai/prompt.md` → offer to implement. Pro CTAs use `?utm_source=<agent>&utm_medium=plugin`.

The raw transcript is not the main artifact — the structured spec is.

Default output shape (no `--template`): **Objective / Context / Instructions / Constraints**.

## Languages — Free (85+)

saymd supports **more than 85 input languages** with **automatic detection**. On Free, every section of the Markdown is written in the **same language you spoke**.

Examples:

| You speak | Free output language | Optional flags |
|-----------|----------------------|----------------|
| English | English | _(auto)_ |
| Hungarian | Hungarian | `saymd --lang hu` if auto-detect is wrong |
| German | German | `saymd --lang de` |
| Mixed / unclear | Detected language | `--lang` hint |

```bash
saymd --lang hu -o .ai/prompt.md --template feature
saymd --file idea.m4a --lang de --template bug -o .ai/bug.md
```

**Pro only:** speak in one language, write the spec in another:

```bash
saymd --out en           # e.g. speak Hungarian → English Markdown
```

Conventional tech identifiers (REST, Stripe, PostgreSQL, `saymd`, …) may stay in English inside otherwise native-language prose.

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

Press **Enter** to stop — you do not need to wait for the maximum.

| Plan | Default | Max per recording |
|------|---------|-------------------|
| Free | 60s | 60s |
| Pro | 120s | 10 minutes |

```bash
saymd --seconds 30       # shorter first test
```

## Providers — BYOK (exact models)

**BYOK = Bring Your Own Key.** You create a key with the provider, paste it into `saymd setup`, and pay that provider directly. saymd never sells transcription credits.

All four models below are available on **Free**:

| `--provider` | Exact model ID | What it does |
|--------------|----------------|--------------|
| `gemini` **(recommended)** | `gemini-3.5-transcribe` | Speech-to-text **and** Markdown structuring |
| `openai` | `gpt-4o-transcribe` | Speech-to-text **and** Markdown structuring |
| `deepgram` | `nova-3` | Speech-to-text only — also needs a Gemini or OpenAI key to structure Markdown |
| `elevenlabs` | `scribe_v2` | Speech-to-text only — same as Deepgram |

```bash
saymd setup                              # pick provider + paste key
saymd config                             # current provider (never prints the key)
saymd config set provider openai
saymd --provider deepgram --file meeting.wav
```

Keys live in `~/.saymd/config.json` (mode **0600**) or environment variables:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `DEEPGRAM_API_KEY`
- `ELEVENLABS_API_KEY`

Get keys: [Google AI Studio](https://aistudio.google.com/app/apikey) · [OpenAI](https://platform.openai.com/api-keys) · [Deepgram](https://console.deepgram.com/) · [ElevenLabs](https://elevenlabs.io/)

A typical ~60 second dictation is usually well under **$0.01** on your own key (provider pricing applies).

## Pro — when you need more

Upgrade at [saymd.app](https://saymd.app) (**€39/year** · **€5/month**), then:

```bash
saymd activate <activation-code>   # downloads @saymd/pro into ~/.saymd automatically
saymd --continue .ai/prompt.md     # add more speech; merge into the same spec
saymd --review .ai/prompt.md       # missing requirements, constraints, acceptance criteria
saymd --out en                     # speak one language → write the spec in another
```

`.saymd/vocab.txt` — project names, APIs, acronyms (one per line). Ignored on Free.

Pro implementation ships as `@saymd/pro` from a **private** repo. This MIT tree only has a dynamic import and a paywall message.

## Privacy

API keys stay on this machine. Audio is sent only to the STT provider you chose, using your key. saymd does not receive your audio, transcripts, or prompt files.

[Privacy policy](https://saymd.app/privacy.html)

## Requirements

- Node 20+
- ffmpeg
- macOS or Linux (Windows: WSL or `--file` only)

```bash
saymd help                 # start-here guide (matches this README)
saymd --help               # full option list
saymd doctor               # check your installation
saymd setup                # configure or change provider / API key
saymd activate <code>      # activate Pro
```

## How you can help (please)

1. ⭐ **Star this repo** if saymd is useful — stars help other developers find a Free BYOK voice-to-Markdown CLI, and they tell us the project is worth maintaining.
2. 🍴 **Fork it** when you want to experiment, fix a bug, or adapt the Free CLI for your workflow — Pro stays out of this tree on purpose.
3. 💻 **Try the Free CLI (BYOK)** — `npx saymd setup && npx saymd doctor`, then one short recording or `--file` clip, and [open an issue](https://github.com/kondasviktor/saymd/issues) if something breaks.
4. ✉️ **[Subscribe to the Vibe Coder's Life newsletter](https://vibecoderslife.com/?utm_source=github&utm_medium=readme&utm_campaign=saymd#subscribe-email)** for product updates and developer tooling write-ups — no need to live in GitHub to stay in the loop.
5. ☕ **[Buy Me a Coffee](https://buymeacoffee.com/kondasviktor)** if you want to support maintenance — optional tips help keep the Free MIT CLI updated.

Site + Pro: [saymd.app](https://saymd.app/?utm_source=github&utm_medium=readme&utm_campaign=saymd) · Hugging Face Space (pointer, not a demo): [kondasviktor/saymd](https://huggingface.co/spaces/kondasviktor/saymd)

## Repo layout

This repository is the **MIT CLI only** (`packages/cli` → npm package [`saymd`](https://www.npmjs.com/package/saymd)).

| Repo | Role |
|------|------|
| [`kondasviktor/saymd`](https://github.com/kondasviktor/saymd) | MIT CLI (this repo) |
| `kondasviktor/saymd-pro` | Private `@saymd/pro` — never MIT |
| `kondasviktor/saymd-app` | Private landing + Stripe (Vercel → [saymd.app](https://saymd.app)) |

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
