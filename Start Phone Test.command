#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "$(dirname -- "$0")" || exit 1
python3 scripts/local-preview.py --wifi --restart
if [[ $? == 0 ]]; then
  open http://127.0.0.1:5173/download/
fi
read -k 1 '?Press any key to close this window.'
