#!/usr/bin/env bash
# Optional live smoke — requires API keys in env. Not run in CI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CLI="$ROOT/packages/cli/dist/cli.js"
FIXTURE="${1:-}"

if [[ -z "${FIXTURE}" ]]; then
  echo "Usage: scripts/live-smoke.sh path/to/audio.m4a"
  exit 1
fi

run_provider() {
  local provider="$1"
  local key_var="$2"
  if [[ -z "${!key_var:-}" ]]; then
    echo "skip $provider ($key_var not set)"
    return 0
  fi
  echo "=== $provider ==="
  node "$CLI" --provider "$provider" --file "$FIXTURE" --raw --stdout 2>/dev/null | head -c 200
  echo ""
}

run_provider gemini GEMINI_API_KEY
run_provider openai OPENAI_API_KEY
run_provider deepgram DEEPGRAM_API_KEY
run_provider elevenlabs ELEVENLABS_API_KEY

echo "Done."
