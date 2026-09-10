#!/usr/bin/env bash
# Regenerate TTS fixtures + run Free saymd matrix (BYOK; not for CI).
set -euo pipefail

TEST_ROOT="${SAYMD_TEST_ROOT:-$HOME/Documents/saymd/saymd-test}"
CLI="${SAYMD_CLI:-$HOME/Documents/saymd/cli/packages/cli/dist/cli.js}"
FIX="$TEST_ROOT/fixtures"
OUT="$TEST_ROOT/.ai"

mkdir -p "$FIX" "$OUT"

echo "Generating fixtures in $FIX …"

say -o "$FIX/01-feature-en.aiff" \
  "Build Google OAuth login for our Next.js app. Use the App Router. Add rate limiting on the auth callback. Acceptance criteria: user can sign in and get a session cookie. Constraint: no password storage."

say -o "$FIX/02-bug-en.aiff" \
  "Bug: the login button does nothing on Safari. Steps to reproduce: open the login page, click Continue with Google. Expected: redirect to Google. Actual: blank page and a console error about cookies. Context: only happens in private browsing."

# Spell saymd to reduce "Saint" ASR errors on Free (no vocab).
say -o "$FIX/03-plan-en.aiff" \
  "Implementation plan for saymd Pro checkout — that is S A Y M D Pro. Context: private landing and Stripe on saymd.app. Step one: create Stripe annual and monthly prices. Step two: wire the webhook for checkout completed and invoice paid. Step three: show a twenty-four character activation code on the success page. Constraint: keep the MIT CLI free of Pro source code. Open question: how buyers install the Pro package."

say -o "$FIX/04-default-en.aiff" \
  "Add a dark mode toggle to the settings page. Put it next to the language picker. Persist the choice in local storage. Do not change the marketing site. Prefer CSS variables over a new UI library."

# Hungarian voice is Mariska (hu_HU). Nora is Norwegian — do not use it.
say -v Mariska -o "$FIX/05-feature-hu.aiff" \
  "Készíts Google OAuth bejelentkezést a Next.js alkalmazáshoz. App Router kell. Az auth callback legyen rate limitezve. Elfogadási feltétel: a felhasználó session cookie-t, azaz munkamenet sütit kap. Korlát: ne tároljunk jelszót."

echo "Running Free saymd matrix via $CLI (cwd=$TEST_ROOT)…"
cd "$TEST_ROOT"
node "$CLI" --file "fixtures/01-feature-en.aiff" --template feature --lang en -o ".ai/01-feature.md"
sleep 25
node "$CLI" --file "fixtures/02-bug-en.aiff" --template bug --lang en -o ".ai/02-bug.md"
sleep 25
node "$CLI" --file "fixtures/03-plan-en.aiff" --template plan --lang en -o ".ai/03-plan.md"
sleep 25
node "$CLI" --file "fixtures/04-default-en.aiff" --lang en -o ".ai/04-default.md"
sleep 25
node "$CLI" --file "fixtures/05-feature-hu.aiff" --template feature --lang hu -o ".ai/05-feature-hu.md"

echo
echo "=== Results ==="
for f in 01-feature 02-bug 03-plan 04-default 05-feature-hu; do
  echo "----- $f -----"
  cat "$OUT/$f.md"
  echo
done
