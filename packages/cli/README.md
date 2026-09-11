# saymd

**Speak once. Get a prompt file any agent can @.**

Free MIT CLI. Bring your own speech-to-text key (**BYOK**). Pro features are a **separate proprietary package** (`@saymd/pro`) — not in this package.

### Free includes

- Mic **or** `--file` audio
- **85+ languages** with auto-detect (output stays in the language you spoke)
- Exact models: `gemini-3.5-transcribe`, `gpt-4o-transcribe`, `nova-3`, `scribe_v2`
- Templates: `feature`, `bug`, `plan`

## Start here — Free

```bash
npx saymd setup
npx saymd doctor
npx saymd -o .ai/prompt.md --template feature --seconds 30
```

Speak, press **Enter** to stop, then `@` `.ai/prompt.md` in Cursor, Claude Code, Codex, Copilot, Gemini CLI, or any agent that can read Markdown.

Default output (no `--template`): **Objective / Context / Instructions / Constraints**.

## Languages — Free (85+)

Auto-detect across **85+** input languages. Free Markdown is written in the **same language you spoke**.

```bash
saymd --lang hu          # optional hint if auto-detect is wrong
saymd --out en           # Pro: speak one language, write another
```

## Templates — Free

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

Audio: mp3, m4a, wav, ogg, opus, flac, webm, aiff, caf, mp4, mov

## Recording

Enter to stop. Free: max **60s** per take. Pro: default 120s, max 10 min.

## BYOK providers (exact models)

You pay the STT provider. Keys in `~/.saymd/config.json` (0600) or env — never printed by `saymd config`.

| `--provider` | Exact model ID |
|--------------|----------------|
| `gemini` (recommended) | `gemini-3.5-transcribe` |
| `openai` | `gpt-4o-transcribe` |
| `deepgram` | `nova-3` (needs Gemini or OpenAI for structuring) |
| `elevenlabs` | `scribe_v2` (needs Gemini or OpenAI for structuring) |

```bash
saymd setup
saymd config set provider openai
saymd --provider deepgram --file meeting.wav
```

## Pro

`--continue`, `--review`, `--out`, `.saymd/vocab.txt`, and longer recordings require [saymd.app](https://saymd.app) (€39/yr · €5/mo).

```bash
saymd activate <activation-code>
saymd --continue .ai/prompt.md
saymd --review .ai/prompt.md
saymd --out en
```

## Privacy

Audio goes only to the provider you chose, with your key. [Privacy](https://saymd.app/privacy.html)

## Platforms

macOS + Linux. Windows: WSL or `--file` only. Node 20+, ffmpeg.

```bash
saymd help
saymd --help
saymd doctor
```

## How you can help

- ⭐ [Star on GitHub](https://github.com/kondasviktor/saymd)
- ✉️ [Vibe Coder's Life newsletter](https://vibecoderslife.com/?utm_source=npm&utm_medium=readme&utm_campaign=saymd#subscribe-email)
- ☕ [Buy Me a Coffee](https://buymeacoffee.com/kondasviktor)

Full docs: [github.com/kondasviktor/saymd](https://github.com/kondasviktor/saymd)
