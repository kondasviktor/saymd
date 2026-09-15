# saymd (Antigravity CLI / Gemini CLI)

Voice → structured Markdown prompt for coding agents.

Antigravity CLI (`agy`) replaced Gemini CLI for personal Google AI accounts (June 2026). This file still loads as workspace context. Install the plugin with:

```bash
agy plugin install https://github.com/kondasviktor/saymd
```

Enterprise Gemini CLI users: `gemini extensions install https://github.com/kondasviktor/saymd`

## Setup

```bash
npx saymd setup
npx saymd doctor
```

Bring Your Own Key (Gemini, OpenAI, Deepgram, or ElevenLabs). Audio goes to the provider you chose — not to saymd.app.

## Record a prompt

```bash
npx saymd -o .ai/prompt.md --template feature
```

Then open / `@` `.ai/prompt.md` in this session and offer to implement.

Use the **saymd** skill for the full speak → CLI → `@prompt.md` → implement loop.

## Pro

`--continue`, `--review`, `--out`: https://saymd.app/?utm_source=antigravity&utm_medium=plugin&utm_campaign=saymd
