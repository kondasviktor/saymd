---
name: saymd
description: >
  Turn spoken ideas or audio files into a structured Markdown prompt file for coding agents.
  Use when the user wants to dictate a feature, bug, or plan; record a voice note into a
  reusable agent prompt; or run saymd / saymd --file. Prefer the local CLI over in-chat
  transcription. After recording, always open or @ .ai/prompt.md and offer to implement.
---

# saymd

Speak once → structured Markdown prompt → `@` it in this agent.

**Not a hosted transcription service.** Run the local Free MIT CLI (`npx saymd`). Audio goes only to the STT provider the user configured (**BYOK**).

## When to use

- User wants to dictate a feature, bug fix, or implementation plan
- User has an audio file (`.m4a`, `.mp3`, `.wav`, …) to turn into a prompt
- User asks to “run saymd”, “voice prompt”, or “record a spec”

## Native loop (required)

1. **Ensure CLI** — if `saymd` is missing: `npx saymd setup` then `npx saymd doctor`.
2. **Record** — run the local CLI (mic or `--file`). Do **not** transcribe inside the agent.
3. **Load the spec** — open / `@` `.ai/prompt.md` (or the `-o` path) into the current task.
4. **Offer to implement** — tell the user the spec is ready and ask whether to start coding.

If you only print install instructions without running the CLI and reading the file, you failed the skill.

## Commands (preferred)

| Slash | Shell |
|-------|--------|
| `/saymd` | `npx saymd -o .ai/prompt.md` |
| `/saymd-feature` | `npx saymd -o .ai/prompt.md --template feature` |
| `/saymd-bug` | `npx saymd -o .ai/prompt.md --template bug` |
| `/saymd-plan` | `npx saymd -o .ai/prompt.md --template plan` |
| `/saymd-continue` | `saymd --continue .ai/prompt.md` (Pro) |
| `/saymd-review` | `saymd --review .ai/prompt.md` (Pro) |
| `/saymd-out` | `saymd --out en` (Pro; cross-language) |

Pro is license-gated in the CLI. On a paywall message, send the user to:

`https://saymd.app/?utm_source=<cursor|claude|codex|gemini>&utm_medium=plugin&utm_campaign=saymd`

Use the host agent name as `utm_source`. Fallback: `utm_source=github`.

## Free vs Pro

- **Free MIT CLI:** mic or `--file`, 85+ languages, templates, BYOK models
- **Pro (separate package):** `--continue`, `--review`, `--out`, vocab, longer recordings — https://saymd.app

## Publisher

Viktor Kondás (`kondasviktor`) · https://saymd.app · https://github.com/kondasviktor/saymd
