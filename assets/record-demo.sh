#!/usr/bin/env bash
# Record a live saymd --file demo to assets/demo.cast (requires working STT key).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"
CLI="$ROOT/packages/cli/dist/cli.js"
export PATH="${HOME}/Library/Python/3.9/bin:${PATH}"

if ! command -v asciinema >/dev/null 2>&1; then
  echo "Install asciinema first: pip3 install --user asciinema" >&2
  exit 1
fi

if [[ ! -f "$CLI" ]]; then
  (cd "$ROOT" && npm run build -w saymd)
fi

WAV="$ASSETS/demo-idea.wav"
if [[ ! -f "$WAV" ]]; then
  echo "Missing $WAV — generate with macOS say + ffmpeg (see assets/README.md)" >&2
  exit 1
fi

OUT="$(mktemp -d)/prompt.md"
cd "$ASSETS"
asciinema rec demo.cast --overwrite \
  -c "node \"$CLI\" --file \"$WAV\" --template feature -o \"$OUT\" && echo && echo '─── .ai/prompt.md ───' && head -40 \"$OUT\" && echo && echo 'Open .ai/prompt.md and @ it in your agent.'"
echo "Saved $ASSETS/demo.cast"
