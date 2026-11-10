#!/usr/bin/env python3
"""Build the bundled Android debug app for this Mac's Wi-Fi address."""
import argparse
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import shutil
import subprocess
from local_network import local_address

root = Path(__file__).resolve().parents[1]
work = root.parent.parent / 'work'
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--host', help='Mac Wi-Fi IPv4 address; defaults to en0')
parser.add_argument('--sdk', type=Path, default=work / 'android-sdk')
args = parser.parse_args()
host = args.host or local_address()
address = ipaddress.ip_address(host)
if address.version != 4 or not address.is_private or address.is_loopback or address.is_unspecified:
    raise SystemExit('Use the Mac private Wi-Fi IPv4 address (not localhost or a public address).')
sdk = args.sdk.resolve()
if not (sdk / 'platforms/android-35/android.jar').exists():
    raise SystemExit('Install Android SDK platform 35 and build-tools 35.0.0 first. See docs/ANDROID.md.')
env = os.environ.copy()
env.update({
    'ANDROID_HOME': str(sdk),
    'ANDROID_USER_HOME': str(work / 'android-user'),
    'GRADLE_USER_HOME': str(work / 'gradle'),
    'ROADSAATHI_WEB_OUT_DIR': 'dist-android',
    'NATIVE_LAN_HOST': host,
    'VITE_API_BASE_URL': f'http://{host}:5173',
    'VITE_PHONE_TEST': 'true',
})
java = Path('/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home')
if java.exists(): env['JAVA_HOME'] = str(java)
for command, directory in [
    (['npm', 'run', 'build'], root),
    (['npx', 'cap', 'sync', 'android'], root / 'frontend'),
    (['./gradlew', '--no-daemon', '--console=plain', 'assembleDebug', 'lintDebug'], root / 'mobile/android'),
]:
    subprocess.run(command, cwd=directory, env=env, check=True)
source = root / 'mobile/android/app/build/outputs/apk/debug/app-debug.apk'
destination = root.parent / 'RoadSaathi-WiFi-debug.apk'
shutil.copy2(source, destination)
download = root / 'frontend/dist/downloads/RoadSaathi-WiFi-debug.apk'
download.parent.mkdir(parents=True, exist_ok=True)
shutil.copy2(source, download)
metadata = {
    'applicationId': 'in.roadsaathi.app', 'version': '1.0',
    'server': env['VITE_API_BASE_URL'], 'buildType': 'debug',
    'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
    'bytes': destination.stat().st_size,
}
(root.parent / 'RoadSaathi-APK-build.json').write_text(json.dumps(metadata, indent=2) + '\n')
subprocess.run(['node', str(root / 'scripts/prepare-download.mjs')], cwd=root, check=True, env=env)
(root / '.runtime').mkdir(exist_ok=True)
(root / '.runtime/phone-test.json').write_text(json.dumps({'host': host}) + '\n')
print(f'\nAPK ready: {destination}\nPhone download page: {metadata["server"]}/download/\nRun Start Phone Test.command to open the download page and QR code.')
