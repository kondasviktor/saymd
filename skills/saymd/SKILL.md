# saymd — agent marketplace skill

Run the local MIT CLI, then reference the generated prompt file in your agent.

## Install

```bash
npx saymd setup    # BYOK: Gemini, OpenAI, Deepgram, or ElevenLabs
npx saymd          # mic → .ai/prompt.md
```

## Workflow

1. `saymd` or `saymd --file recording.m4a`
2. Open or `@` `.ai/prompt.md` in Cursor, Claude Code, Codex, Copilot, or Gemini CLI
3. Pro features (`--continue`, `--review`, `--out`): https://saymd.app?utm_source=agent-skill

## Requirements

- Node 20+, ffmpeg
- Your own STT API key (Bring Your Own Key)
