#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
if python3 scripts/build-android.py && python3 scripts/local-preview.py --wifi --restart; then
  open -R ../RoadSaathi-WiFi-debug.apk
fi
read -k 1 '?Press any key to close this window.'
