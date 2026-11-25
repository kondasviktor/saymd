---
name: saymd-bug
description: Record a bug-report voice prompt into .ai/prompt.md (--template bug)
---

# /saymd-bug

1. Run:

```bash
npx saymd@1.0.0 -o .ai/prompt.md --template bug
```

Or: `npx saymd@1.0.0 --file bug.m4a -o .ai/prompt.md --template bug`

2. Open / `@` `.ai/prompt.md`.
3. Restate Steps to reproduce + Expected vs Actual briefly, then ask whether to fix.

First-run: `npx saymd@1.0.0 setup` → `npx saymd@1.0.0 doctor` if needed.
