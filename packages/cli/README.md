# saymd

**Speak once. Get a prompt file any agent can @.**

Agents execute. saymd delivers a usable spec. Free MIT CLI — bring your own speech-to-text key (**BYOK**). Works with Cursor · Claude Code · Codex · GitHub Copilot · Antigravity CLI · OpenCode. Pro is a **separate proprietary package** (`@saymd/pro`) — not in this package.

### Free includes

- Mic **or** `--file` audio
- **85+ languages** with auto-detect (output stays in the language you spoke)
- Exact models: `whisper-large-v3-turbo` (Groq), `gemini-3.5-transcribe`, `gpt-4o-transcribe` / `gpt-4o-mini-transcribe`, `nova-3`, `scribe_v3`
- Templates: `feature`, `bug`, `plan`

## Start here — Free

```bash
npx saymd@0.1.2 setup
npx saymd@0.1.2 doctor
npx saymd@0.1.2 -o .ai/prompt.md --template feature --seconds 30
```

Speak, press **Enter** to stop, then `@` `.ai/prompt.md` in Cursor, Claude Code, Codex, Copilot, Antigravity CLI, OpenCode, or any agent that can read Markdown.

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
| `groq` (start here: free tier, no card) | `whisper-large-v3-turbo`; structures with `openai/gpt-oss-120b` |
| `gemini` | `gemini-3.5-transcribe`; structures with `gemini-3.1-flash-lite` |
| `openai` | `gpt-4o-transcribe` or `gpt-4o-mini-transcribe` (half the price) |
| `deepgram` | `nova-3` (needs Gemini, OpenAI or Groq for structuring) |
| `elevenlabs` | `scribe_v3` (needs Gemini, OpenAI or Groq for structuring) |

```bash
saymd setup
saymd config set provider openai
saymd config set model gpt-4o-mini-transcribe
saymd --model gpt-4o-mini-transcribe --file memo.m4a
saymd --provider deepgram --file meeting.wav
```

## Pro

`--split`, `--ground`, `--continue`, `--review`, `--out`, `.saymd/vocab.txt`, and longer recordings require [saymd.app](https://saymd.app) (€39/yr · €5/mo).

```bash
saymd activate <activation-code>
saymd --split --ground --file walk.m4a   # ordered task files in .ai/tasks/ with depends_on
saymd --ground -o .ai/prompt.md          # spec with real @paths, checked against disk
saymd --continue .ai/prompt.md
saymd --review .ai/prompt.md
saymd --out en
```

## Privacy

Audio goes only to the provider you chose, with your key. [Privacy](https://saymd.app/privacy.html)

## Platforms

macOS + Linux. Windows: WSL or `--file` only. Node 24+, ffmpeg.

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
