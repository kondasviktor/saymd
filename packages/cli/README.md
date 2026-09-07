# saymd

**Speak once. Get a prompt file any agent can @.**

Free MIT CLI. Bring your own speech-to-text key. Pro features are a **separate proprietary package** (`@saymd/pro`) — not in this repo.

## Start here

```bash
npm install -g saymd
saymd setup
saymd doctor
saymd -o .ai/prompt.md --template feature --seconds 30
```

Speak, press **Enter** to stop, then `@` `.ai/prompt.md` in your agent.

## Languages

Auto-detect, 85+ languages. Spec is written in the **same language you spoke**.

```bash
saymd --lang hu          # optional hint
saymd --out en           # Pro: speak one language, write another
```

## Templates

| `--template` | Headings |
|--------------|----------|
| `feature` | Objective, Context, Instructions, Constraints, Acceptance criteria |
| `bug` | Objective, Context, Steps to reproduce, Expected / Actual |
| `plan` | Objective, Context, numbered Steps, Constraints, Open questions |
| _(none)_ | Objective, Context, Instructions, Constraints |

```bash
saymd --file idea.m4a --template feature -o .ai/feature.md
```

Audio: mp3, m4a, wav, ogg, opus, flac, webm, aiff, caf, mp4, mov

## Recording

Enter to stop. Free: max **60s** per take. Pro: default 120s, max 10 min.

## BYOK providers

You pay the STT provider. Keys in `~/.saymd/config.json` (0600) or env — never printed by `saymd config`.

| `--provider` | Model |
|--------------|-------|
| `gemini` (recommended) | gemini-3.5-transcribe |
| `openai` | gpt-4o-transcribe |
| `deepgram` | nova-3 (needs Gemini or OpenAI for structuring) |
| `elevenlabs` | scribe_v2 (needs Gemini or OpenAI for structuring) |

```bash
saymd config set provider openai
saymd --provider deepgram --file meeting.wav
```

## Pro

`--continue`, `--review`, `--out`, `.saymd/vocab.txt`, and longer recordings require [saymd.app](https://saymd.app) (€39/yr · €5/mo).

```bash
saymd activate <activation-code>
saymd --continue .ai/prompt.md
saymd --review .ai/prompt.md
```

Implementation is **not** in this MIT package. Install `@saymd/pro` after purchase.

## Privacy

Audio goes only to the provider you chose, with your key. [Privacy](https://saymd.app/privacy.html)

## Platforms

macOS + Linux. Windows: WSL or `--file` only. Node 20+, ffmpeg.

```bash
saymd help
saymd --help
```
