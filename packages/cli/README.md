# saymd

Speak once. Get a prompt file any agent can @.

## Quick start

```bash
npm install -g saymd
saymd setup          # pick provider + paste API key → ~/.saymd/config.json
saymd doctor
saymd                # record from mic → .ai/prompt.md
saymd --file x.m4a --template feature -o feature-auth.md
```

## BYOK providers

Bring Your Own Key — you pay the STT provider, not saymd.

| `--provider` | Model |
|--------------|-------|
| `gemini` (default) | gemini-3.5-transcribe |
| `openai` | gpt-4o-transcribe |
| `deepgram` | nova-3 |
| `elevenlabs` | scribe_v2 |

```bash
saymd config set provider openai
saymd --provider deepgram --file meeting.wav
```

Deepgram/ElevenLabs need a Gemini or OpenAI key too (prompt structuring). `saymd setup` walks you through both.

## Language

- **Default:** auto-detect (85+ languages)
- **Hint:** `--lang de` when you know the audio is German
- **Pro cross-language:** `--out en` — speak Hungarian, get English spec

## Output shape

```markdown
## Objective
...

## Context
...

## Instructions
- ...

## Constraints
- ...
```

## Pro

`--continue`, `--review`, and `--out` require a Pro license from [saymd.app](https://saymd.app) — €39/yr.

Pro implementation is a **separate proprietary package** (`@saymd/pro`), not part of this MIT repo.

```bash
saymd activate <activation-code>
saymd --continue feature-auth.md
```

## Platforms

macOS + Linux native. Windows: WSL or `--file` only.

## Cost

BYOK — saymd prints duration + per-provider estimate after each run (not a guarantee).

## Links

- [saymd.app](https://saymd.app)
- [Apify audio Actors](https://apify.com/kondasviktor) — batch podcast/meeting intelligence (platform-managed key)
