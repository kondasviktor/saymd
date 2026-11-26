---
name: saymd-split
description: Split one long voice memo into ordered task files in .ai/tasks/, grounded in this repo (Pro --split --ground)
---

# /saymd-split

1. Run (Pro), with a recording or the mic:

```bash
saymd --split --ground --file walk.m4a
```

Without `--file` it records from the mic (Enter to stop; up to 10 minutes). `--dry-run` previews the tasks without writing.

2. On paywall → `https://saymd.app/pricing.html?utm_source=github&utm_medium=plugin&utm_campaign=saymd` (prefer the host-agent `utm_source`).

3. Open / `@` `.ai/tasks/README.md`, list the tasks in run order in one line each, then open the first task whose `depends_on` are all done and ask whether to start it.

If an `@path` is flagged under **Open questions** as missing, ask the user about it before implementing that part.
