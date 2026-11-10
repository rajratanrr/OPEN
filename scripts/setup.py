#!/usr/bin/env python3
"""Create local development credentials without printing or overwriting them."""
from pathlib import Path
import os
import secrets

root=Path(__file__).resolve().parents[1]
target=root/'.env'
if target.exists():
    raise SystemExit('.env already exists; nothing was changed.')
values={key:secrets.token_hex(32 if key!='JWT_SECRET' else 48) for key in
        ['DATABASE_PASSWORD','JWT_SECRET','MONGO_ROOT_PASSWORD','MONGO_PASSWORD']}
lines=[]
for line in (root/'.env.example').read_text().splitlines():
    key=line.split('=',1)[0]
    lines.append(key+'='+values[key] if key in values else line)
fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
with os.fdopen(fd,'w') as handle:
    handle.write('\n'.join(lines)+'\n')
print('Created .env with private development credentials. AI remains disconnected.')
print('Next: docker compose up --build -d')
