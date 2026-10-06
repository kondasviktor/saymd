---
name: saymd
description: Record speech or an audio file into .ai/prompt.md, then load it into the current task
---

# /saymd

1. Run in the project terminal (mic; press Enter to stop):

```bash
npx saymd@0.1.2 -o .ai/prompt.md
```

Or with an existing recording:

```bash
npx saymd@0.1.2 --file idea.m4a -o .ai/prompt.md
```

2. Open / `@` `.ai/prompt.md` in this chat.
3. Summarize Objective + Constraints in one short sentence, then ask whether to implement.

If `saymd` is not set up: `npx saymd@0.1.2 setup` then `npx saymd@0.1.2 doctor`, then retry.
