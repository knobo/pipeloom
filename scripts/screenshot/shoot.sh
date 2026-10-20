#!/usr/bin/env bash
# Screenshots for the README: records your current PipeWire graph (anonymized) and renders each tab
# in headless Chrome. Usage: scripts/screenshot/shoot.sh [--reuse]   (--reuse keeps the existing dump.json)
set -euo pipefail
cd "$(dirname "$0")/../.."
dir=scripts/screenshot
[ "${1:-}" = --reuse ] || pw-dump | python3 -I "$dir/sanitize.py" > "$dir/dump.json"
chrome=$(command -v google-chrome || command -v chromium || command -v chromium-browser)

npx vite --port 1421 --strictPort >/dev/null 2>&1 &
vite=$!
trap 'kill $vite' EXIT
until curl -sf http://localhost:1421/ >/dev/null; do sleep 0.3; done

for theme in light dark; do
for tab in graph devices settings; do
  flags=(); [ $theme = dark ] && flags=(--force-dark-mode --blink-settings=preferredColorScheme=0)
  "$chrome" "${flags[@]}" --headless=new --disable-gpu --hide-scrollbars --lang=en-US --force-device-scale-factor=2 \
    --window-size=1440,900 --virtual-time-budget=8000 --run-all-compositor-stages-before-draw \
    --screenshot="$PWD/docs/$tab-$theme.png" "http://localhost:1421/$dir/index.html#$tab" 2>/dev/null
  echo "docs/$tab-$theme.png"
done
done
