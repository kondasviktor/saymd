# Marketplace distribution plan (Phase 2)

**Status:** Not started — wait until CLI + Stripe checkout E2E works and `SAYMD_PUBLIC=1`.

All wrappers call the **local MIT CLI**. No second STT stack, no marketplace billing, no hosted keys.

**Publisher ID (locked):** `kondasviktor`  
**Display name:** Viktor Kondás / Vibe Coder's Life

Every Pro CTA uses UTM tracking:

```
https://saymd.app/?utm_source=cursor
https://saymd.app/?utm_source=claude
https://saymd.app/?utm_source=codex
https://saymd.app/?utm_source=gemini
https://saymd.app/?utm_source=vscode
https://saymd.app/?utm_source=huggingface
```

---

## Shared skill text

One reusable skill package (`skills/saymd/`):

> Run local `saymd`, then @ the generated `.ai/prompt.md` in your agent.

Manifests differ per vendor; the engine does not.

**Never in wrappers:** mic capture fork, extra key storage, webviews, history DB.

---

## Launch order

### 1. Gemini CLI extension (easiest)

- `gemini-extension.json` in public `kondasviktor/saymd` repo
- GitHub topic: `gemini-cli-extension` (crawler discovery)
- Skill: install CLI + run `saymd setup`

### 2. Cursor Marketplace

- Public repo + `plugin.json`
- Manual review
- Commands: Record / Open `.ai/prompt.md`
- Pro commands deep-link to `saymd.app?utm_source=cursor`

### 3. Claude Code plugin

- Git marketplace install
- Same skill text as Cursor
- UTM: `utm_source=claude`

### 4. Codex plugin

- Reuse skill/command package from Claude
- UTM: `utm_source=codex`

### 5. VS Code extension (Cursor can reuse)

- Publisher: `kondasviktor` (cannot change later)
- Thin extension: Record / Open prompt
- Pro commands → site with `utm_source=vscode`

### 6. Hugging Face (free account)

- **No Space** (needs Pro/compute)
- Org or **collection page** + model-card-style README
- Describes free MIT CLI, links GitHub + saymd.app
- Paid conversion happens off-Hub
- UTM: `utm_source=huggingface`

---

## Prerequisites before any listing

- [ ] `kondasviktor/saymd` repo is **public**
- [ ] `SAYMD_PUBLIC=1` on saymd.app
- [ ] Stripe checkout + license delivery tested E2E
- [ ] CLI v1.1 with multi-provider STT shipped on npm

---

## Repo layout (future)

```text
wrappers/
  gemini-cli/       gemini-extension.json
  cursor/           plugin.json
  claude-code/      plugin manifest
  codex/            plugin manifest
  vscode/           package.json + extension.ts
  huggingface/      README collection card (no Space)
skills/
  saymd/            SKILL.md — shared agent instructions
```

Keep wrappers in the public `saymd` repo or a thin `saymd-wrappers` repo — TBD at launch.

---

## Funnel goal

Free MIT CLI in marketplaces → GitHub stars + installs → `saymd.app` Pro conversion.

No free Pro trials. Pro is paid only (€39/yr default, €5/mo).
