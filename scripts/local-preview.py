#!/usr/bin/env python3
"""Restart this workspace's local demo without printing credentials.

For portable installations use docker-compose.yml. This convenience launcher
uses the native database tools prepared in the parent workspace's work/ folder.
"""
from pathlib import Path
import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.request
from local_network import local_address

root=Path(__file__).resolve().parents[1]
work=root.parent.parent/'work'
runtime=root/'.runtime'
runtime.mkdir(exist_ok=True)
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--wifi', action='store_true', help='Expose the frontend on this Mac Wi-Fi for the debug APK')
parser.add_argument('--restart', action='store_true', help='Restart only this project\'s application processes')
args=parser.parse_args()
env=os.environ.copy()
config=root/'.env.local'
if not config.exists():
    raise SystemExit('This local launcher needs the prepared .env.local. On another machine, follow the Docker instructions in README.md.')
for line in config.read_text().splitlines():
    if line and not line.startswith('#') and '=' in line:
        key,value=line.split('=',1);env[key]=value
host='127.0.0.1'
if args.wifi:
    host=local_address()
    origins=set(env.get('ALLOWED_ORIGINS','http://localhost:5173,http://127.0.0.1:5173').split(','))
    origins.update([f'http://{host}',f'http://{host}:5173'])
    env['ALLOWED_ORIGINS']=','.join(sorted(origins))
    env['COOKIE_SECURE']='false'  # Local HTTP demo only; production defaults stay secure.
    env['FRONTEND_URL']=f'http://{host}:5173'
    manifest=runtime/'phone-test.json'
    if manifest.exists() and json.loads(manifest.read_text()).get('host')!=host:
        raise SystemExit('Your Wi-Fi address changed. Rebuild the APK with python3 scripts/build-android.py before starting this phone test.')

def listening(port):
    try:
        with socket.create_connection(('127.0.0.1',port),timeout=.5):return True
    except OSError:return False

def wait_for(port,timeout=50):
    end=time.monotonic()+timeout
    while time.monotonic()<end:
        if listening(port):return
        time.sleep(.5)
    raise SystemExit(f'Service on port {port} did not start. Check {runtime} for logs.')

def background(name,command,port):
    if listening(port):
        print(f'{name}: already running on {port}')
        return
    with open(runtime/(name+'.log'),'a') as log:
        process=subprocess.Popen([str(v) for v in command],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
    (runtime/(name+'.pid')).write_text(str(process.pid))
    wait_for(port)
    print(f'{name}: started on {port}')

if args.restart:
    for port in [5173,3000,8080]:
        pids=subprocess.run(['lsof','-nP',f'-iTCP:{port}','-sTCP:LISTEN','-t'],capture_output=True,text=True).stdout.split()
        for pid in set(pids):
            cwd=subprocess.run(['lsof','-a','-p',pid,'-d','cwd','-Fn'],capture_output=True,text=True).stdout
            paths=[Path(line[1:]).resolve() for line in cwd.splitlines() if line.startswith('n')]
            if not any(path==root or root in path.parents for path in paths):
                raise SystemExit(f'Port {port} belongs to another project; it was not stopped.')
            os.kill(int(pid),signal.SIGTERM)
        for _ in range(40):
            if not listening(port):break
            time.sleep(.25)
        if listening(port):raise SystemExit(f'Port {port} is still in use. Close the previous RoadSaathi process and retry.')

if not listening(55432):
    pg=work/'tools/Postgres.app/Contents/Versions/18/bin/pg_ctl'
    data=work/'runtime/postgres'
    if not pg.exists() or not data.exists():
        raise SystemExit('Prepared PostgreSQL tools were not found. Use the Docker quick start in README.md.')
    subprocess.run([str(pg),'-D',str(data),'-l',str(work/'runtime/postgres.log'),'-o',f'-h 127.0.0.1 -p 55432 -k "{work / "runtime"}"','start'],check=True,env=env,stdout=subprocess.DEVNULL)
    wait_for(55432)

mongod=work/'tools/mongodb-macos-aarch64-8.0.5/bin/mongod'
background('mongo',[mongod,'--dbpath',work/'runtime/mongodb','--bind_ip','127.0.0.1','--port','57017','--logpath',work/'runtime/mongodb.log'],57017)

if not (root/'backend/target/roadsaathi-api-1.0.0.jar').exists():
    raise SystemExit('Build the backend first: cd backend && ./mvnw verify')
if not (root/'frontend/dist/index.html').exists():
    raise SystemExit('Build the frontend first: npm ci && npm run build')

background('backend',[sys.executable,root/'scripts/run-backend.py'],8080)
node=shutil.which('node')
if not node:
    for directory in ['/opt/homebrew/bin','/usr/local/bin']:
        candidate=Path(directory)/'node'
        if candidate.exists():node=str(candidate);break
if not node:raise SystemExit('Node.js is needed. Install Node 24 and run this launcher again.')
if args.wifi and (root.parent/'RoadSaathi-APK-build.json').exists():
    subprocess.run([node,root/'scripts/prepare-download.mjs'],cwd=root,env=env,check=True)
background('gateway',[node,root/'gateway/src/server.js'],3000)
background('frontend',[node,root/'node_modules/vite/bin/vite.js','preview','--config',root/'frontend/vite.config.ts',root/'frontend','--host','0.0.0.0' if args.wifi else '127.0.0.1','--port','5173','--strictPort'],5173)

with urllib.request.urlopen('http://127.0.0.1:5173/api/v1/config',timeout=10) as response:
    result=json.load(response)
if result.get('city')!='Ludhiana':raise SystemExit('Port 5173 is occupied by a different application.')
print('\nRoadSaathi is ready: http://127.0.0.1:5173')
print('Demo sign-in: citizen@roadsaathi.demo / RoadDemo!2026')
if args.wifi:print(f'Phone download page: http://{host}:5173/download/ — scan its QR code with your phone. Keep this Mac awake on the same Wi-Fi.')
