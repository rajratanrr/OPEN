#!/bin/zsh
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if python3 scripts/local-preview.py; then
  open "http://127.0.0.1:5173/"
else
  read "reply?Press Return to close."
fi
