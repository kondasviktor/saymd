---
name: saymd-inbox
description: Pull voice notes sent from the phone (saymd Telegram bot) into this repo, then pick up the next task or spec (Pro Cloud)
---

# /saymd-inbox

1. Run (Pro Cloud) in the repo:

```bash
saymd inbox sync
```

First time in this repo: `saymd project add --map` registers it, so notes can be sent to it from Telegram and grounded in its files.

2. On paywall or "No saymd license" → `https://saymd.app/pricing.html?utm_source=github&utm_medium=plugin&utm_campaign=saymd` (prefer the host-agent `utm_source`).

3. Pick up the work:
   - split notes are written to `.ai/tasks/`: open the first `todo` task whose `depends_on` are all done (or call the `saymd` MCP tool `list_tasks` if it is connected);
   - single specs are written to `.ai/inbox/<date>-<title>.md`: open the newest (or call `list_inbox`).

4. Summarize it in one sentence and ask whether to implement. When a task is finished, set `status: done` (or call `mark_done`).

If sync says the inbox is empty, tell the user and stop.
