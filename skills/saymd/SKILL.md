---
name: saymd
description: Voice inbox for the repo. Turn spoken ideas, audio files or Telegram voice notes into a structured Markdown spec (.ai/prompt.md) or ordered task files (.ai/tasks/), then implement them. Use when the user wants to dictate a feature, bug or plan; split a long voice memo into tasks; sync voice notes from their phone; or run saymd / saymd --file / saymd inbox sync. Prefer the local CLI over in-chat transcription. After recording or syncing, always open the spec or the next task and offer to implement.
---

# saymd

Voice note → structured Markdown spec or ordered task files in this repo → implement them here.

Run the local Free MIT CLI (`npx saymd@1.0.0`). On Free and Pro Local, audio goes only to the speech-to-text provider the user configured (**BYOK**; Groq has a free tier with no card). Never transcribe inside the agent.

## When to use

- The user wants to dictate a feature, bug fix or implementation plan
- The user has an audio file (`.m4a`, `.mp3`, `.wav`, …) to turn into a spec
- The user has a long brain-dump to split into tasks (Pro)
- The user sent voice notes from their phone to the saymd Telegram bot (Pro Cloud)
- The user asks to "run saymd", "voice prompt", "record a spec" or "check my voice inbox"

## Native loop (required)

1. **Ensure the CLI**: if `saymd` is missing, run `npx saymd@1.0.0 setup`, then `npx saymd@1.0.0 doctor`.
2. **Get the voice work into the repo**:
   - record or use a file: `npx saymd@1.0.0 -o .ai/prompt.md` (mic, Enter to stop) or `--file idea.m4a`;
   - Pro, long memo: `saymd --split --ground --file walk.m4a` writes `.ai/tasks/01-….md`, `02-….md` … plus `.ai/tasks/README.md` with the run order;
   - Pro Cloud: `saymd inbox sync` pulls Telegram notes into `.ai/inbox/` (specs) or `.ai/tasks/` (split notes).
3. **Load it**: open / `@` `.ai/prompt.md`, the new `.ai/inbox/*.md` file, or the first `todo` task whose `depends_on` are all `done`.
4. **Offer to implement**: say what the spec or task asks for in one sentence and ask whether to start.

If you only print install instructions without running the CLI and reading the file, you failed the skill.

## Task queue (Pro)

- Work through `.ai/tasks/` in the order of `.ai/tasks/README.md`. Each task has `status: todo | done` and `depends_on` in its frontmatter.
- If the `saymd` MCP server is connected, use its tools instead of reading files by hand: `list_tasks` (queue and the next ready task), `get_item`, `mark_done` (pass a short `done_note`, e.g. the PR link; it returns the next task) and `list_inbox`.
- Without MCP, set `status: done` in the task's frontmatter when it is finished.
- Set up MCP once per repo: `saymd mcp config claude` (or `cursor`, `codex`, `antigravity`, `vscode`) prints the settings to add.

## Commands (preferred)

| Slash | Shell |
|-------|--------|
| `/saymd` | `npx saymd@1.0.0 -o .ai/prompt.md` |
| `/saymd-feature` | `npx saymd@1.0.0 -o .ai/prompt.md --template feature` |
| `/saymd-bug` | `npx saymd@1.0.0 -o .ai/prompt.md --template bug` |
| `/saymd-plan` | `npx saymd@1.0.0 -o .ai/prompt.md --template plan` |
| `/saymd-split` | `saymd --split --ground` (Pro; one memo → ordered task files) |
| `/saymd-inbox` | `saymd inbox sync` (Pro Cloud), then the next task or spec |
| `/saymd-continue` | `saymd --continue .ai/prompt.md` (Pro) |
| `/saymd-review` | `saymd --review .ai/prompt.md` (Pro) |
| `/saymd-out` | `saymd --out en` (Pro; cross-language) |

Pro is license-gated in the CLI. On a paywall message, send the user to:

`https://saymd.app/pricing.html?utm_source=<cursor|claude|codex|antigravity|grok>&utm_medium=plugin&utm_campaign=saymd`

Use the host agent name as `utm_source`. Fallback: `utm_source=github`.

## Free, Pro Local and Pro Cloud

- **Free (MIT, BYOK):** mic or `--file`, 85+ languages, 3 templates, 6 providers including Groq's free tier and OpenRouter (one key, many models)
- **Pro Local (€49 one-time):** `--split`, `--ground`, `saymd mcp`, plus `--continue`, `--review`, `--out`, vocab and 10-minute recordings
- **Pro Cloud (€9/month or €79/year, no API key):** everything in Pro Local, plus the Telegram voice inbox and `saymd inbox sync`

## Publisher

Viktor Kondás (`kondasviktor`) · https://saymd.app · https://github.com/kondasviktor/saymd
