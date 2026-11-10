# Android app and actual-device checks

Native source is in `mobile/android`. The shared React interface is packaged with Capacitor 7. `RoadMotionPlugin.java` uses Android `SensorManager`: linear acceleration when available, otherwise the hardware accelerometer. It samples at approximately 50 Hz and unregisters on stop, pause and destroy. `@capacitor/geolocation` provides foreground GPS. No background service, fabricated location, fake motion stream or automatically verified pothole is included.

The project targets Android API 35, with minimum API 23, Java 21 and Capacitor 7. SDK tools and Gradle caches for this workspace are kept under `work/`. Physical pothole detection accuracy requires a mounted phone and labeled road trials.

## First phone test on Wi-Fi

The current debug APK is available directly from [GitHub](https://github.com/rajratanrr/OPEN/raw/refs/heads/main/downloads/RoadSaathi.apk), with a [download QR code, checksum and installation guide](../downloads/README.md). Its configured server is recorded in `downloads/build.json`. Downloading from GitHub does not require the Mac to be running; using the app's server features does.

1. Connect your Android phone and this Mac to the same trusted Wi-Fi.
2. Double-click `Start Phone Test.command` on the Mac. It opens a download page with a QR code. Keep the Mac awake; databases remain private to the Mac.
3. Scan that QR code with the phone camera and tap **Download Android app**. No account is needed to download. Open `RoadSaathi.apk` from the browser's Downloads and install it. Android may ask you to allow installation from that browser. This is a debug APK for local testing. You can return to the page using **Get Android app** in the web dashboard, or `http://<Mac-Wi-Fi-IP>:5173/download/`.
4. Open **RoadSaathi**, sign in with `citizen@roadsaathi.demo` / `RoadDemo!2026`, or create a citizen account. Reports in the demo map cover Ludhiana and are labeled synthetic.
5. Choose **Report a pothole** to upload a JPEG/PNG photograph and choose GPS, a map pin or coordinates. Reports wait for review. Camera capture or the photo picker can supply the image.
6. Choose **Road monitoring**, secure the phone and start with precise foreground location enabled. Start while connected to the server. A running session queues private samples when disconnected and synchronizes when you return to the server's Wi-Fi. Backgrounding, locking the phone or leaving the monitoring screen stops this foreground-only version.

The interface and draft storage are packaged in the APK. API access needs the Mac server. If the network address changes, double-click `Rebuild Phone App.command` and install the newly built APK. Changing the packaged origin creates separate device storage, so synchronize old drafts first. If the phone cannot reach the printed address, check the Mac firewall and whether the Wi-Fi isolates connected devices. Public HTTPS hosting is needed for use across unrelated networks.

To rebuild this workspace's debug APK:

```sh
npm ci
python3 scripts/build-android.py
```

The script builds separate `dist-android` assets, synchronizes Capacitor, runs `assembleDebug` and `lintDebug`, and copies the APK into `outputs/` and the local download path. Use `--sdk /absolute/path/to/Android/sdk` or `--host <Mac-Wi-Fi-IP>` if needed. It uses a local debug signing key, not a Play Store release key. Development HTTP is allowed only by the debug manifest. The packaged origin and API share a host/scheme on different ports so HttpOnly SameSite=Strict cookies remain valid.

## What a detected bump means

The accelerometer measures phone motion; GPS supplies position, speed, accuracy and time. After baseline sampling, the detector looks for a sustained strong impact while the vehicle is moving. A qualifying event saves the nearby GPS fix as an **unverified possible bump**, privately under the monitoring session. It does not invent a photograph or publish a confirmed pothole. A speed breaker, rough surface or movement of the phone can also trigger an impact. Photo-based AI is disconnected; manual photo reports and human review work now. See the acceptance procedure below before treating this as a reliable detector.

## Configure and build

For release, serve the API over HTTPS and use two hosts under the same registrable domain. Example: the packaged app origin is `https://app.your-domain.example` and the API is `https://api.your-domain.example`. Add the exact packaged origin to Spring and gateway `ALLOWED_ORIGINS`. Keep cookies Secure and SameSite=Strict; this same-site layout avoids weakening cookie policy. Never use a production API key in the frontend environment.

```sh
npm ci
VITE_API_BASE_URL=https://api.your-domain.example npm run build
cd frontend
NATIVE_HOSTNAME=app.your-domain.example npx cap sync android
npx cap open android
```

In Android Studio, select a physical device and build/run the debug app. Configure a release signing key yourself before distributing a release APK. Do not commit signing keys, `local.properties` or credentials. The single published test APK is in `downloads/RoadSaathi.apk`; other generated Android build outputs remain ignored. The server must be reachable from the device; `127.0.0.1` on a phone means the phone, not your Mac. The release configuration rejects cleartext traffic.

The browser/PWA version can use DeviceMotion where supported. Desktop browsers may expose the API but provide no actual sensor values; the app stops after six seconds with an honest unavailable message. iOS native plugin implementation is not included.

## Stationary/controlled hardware acceptance procedure

1. Sign in on a physical Android phone. Confirm ordinary report submission works against the configured server before testing sensors.
2. While safely parked, open Road monitoring. Start only after reading the foreground/location notice. Grant foreground precise location when prompted; denying it must leave monitoring stopped without a fabricated coordinate.
3. Secure the phone and let the first thirty readings calibrate. Inspect the motion graph. At rest and walking speeds below 1.5 m/s, there must be no automatically accepted bump candidates.
4. Confirm sensor records use current coordinates, timestamp, accuracy and measured/available speed. A stale GPS fix older than five seconds, accuracy worse than 50 m, unavailable speed or implausible speed must suppress candidates.
5. Test real motion only in a controlled setting with a passenger operating the phone. Phone handling and speed breakers can cause false positives. Candidates must stay `UNVERIFIED`; inspect `/monitoring/sessions/{id}` and the authenticated telemetry endpoint for persistence.
6. Stop monitoring and verify the graph stops, the session is stopped, and no additional samples arrive. Backgrounding or leaving the screen must stop foreground sensing. Resuming the app must not silently restart it.
7. Disconnect the network during an active session, then stop. Reconnect in the foreground. Verify queued samples/events synchronize and session ownership is enforced. Never mark missing server acknowledgements as successful.
8. In a development environment, use explicitly labeled test coordinates near a verified report to exercise a proximity alert. Confirm resolved/rejected/pending reports do not trigger, repeat alerts respect cooldown, audio remains opt-in and the UI states that road-segment matching is unavailable.
9. Test permission revocation, GPS loss, app termination, another account signing in and storage failure. Verify private journeys never appear on the public map.

The impact detector uses a baseline, an exponential filter, consecutive threshold crossings, jerk, minimum speed, GPS quality, a three-second time cooldown and a fifteen-meter spatial cooldown. These are engineering heuristics, not a trained or accuracy-certified pothole classifier. Tune on labeled device data before relying on them operationally.

Native integration follows the [Capacitor Android plugin documentation](https://next.capacitorjs.com/docs/plugins/android). The source avoids relying on the web-only implementation of the standard Motion plugin for Android accelerometer access.
