---
name: saymd-bug
description: Record a bug-report voice prompt into .ai/prompt.md (--template bug)
---

# /saymd-bug

1. Run:

```bash
npx saymd -o .ai/prompt.md --template bug
```

Or: `npx saymd --file bug.m4a -o .ai/prompt.md --template bug`

2. Open / `@` `.ai/prompt.md`.
3. Restate Steps to reproduce + Expected vs Actual briefly, then ask whether to fix.

First-run: `npx saymd setup` → `npx saymd doctor` if needed.
