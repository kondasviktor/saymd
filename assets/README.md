# Marketplace assets (Phase 4)

Prep for Cursor / Claude / Gemini / Codex listings. Not used on the homepage carousel.

| File | Use |
|------|-----|
| `icon-512.png` | Square listing icon (512×512), brand mark `md` on `#2563eb` |
| `demo.gif` | Short terminal demo: `saymd --file` → structured `.ai/prompt.md` |
| `demo.cast` | Source asciicast for regenerating the GIF with [agg](https://github.com/asciinema/agg) |

## Regenerate GIF (live STT)

Needs a working BYOK key in `~/.saymd/config.json`:

```bash
# from repo root
./assets/record-demo.sh
```

Then:

```bash
./assets/agg --font-size 16 --theme monokai --speed 1.15 --idle-time-limit 1.5 \
  assets/demo.cast assets/demo.gif
```

(`agg` binary is gitignored — download from asciinema/agg releases if missing.)
