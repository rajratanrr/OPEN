# Download RoadSaathi for Android

**[Download RoadSaathi.apk](https://github.com/rajratanrr/OPEN/raw/refs/heads/main/downloads/RoadSaathi.apk)** — 5.2 MB, version 1.0, debug build for local testing.

Scan this QR code with your Android phone to download the same APK from GitHub:

![Download RoadSaathi APK](install-qr.png)

1. Download the APK and open it from your browser's Downloads. Allow installation from that browser if Android asks, then tap **Install**.
2. Start **Start Phone Test.command** in the prepared project folder on the original Mac. Keep the Mac awake and connect the phone to the same Wi-Fi.
3. Open **RoadSaathi**, choose **Citizen**, then tap **Sign in** to try the demo. You can also create your own citizen account.

Downloading from GitHub works without the Mac. Signing in, submitting reports and syncing require the app's configured server: `http://10.227.18.22:5173`. This is a local test build; the backend has not been deployed publicly. If the Mac's address changes, run **Rebuild Phone App.command** on the original Mac and reinstall the rebuilt APK. A fresh clone on another computer needs the [server setup](../README.md#run-on-another-machine-with-docker) and [Android build configuration](../docs/ANDROID.md).

**Automatic monitoring:** motion and GPS can record a strong impact as a private, unverified possible bump. Speed breakers and phone movement can also trigger it. Monitoring runs in the foreground and stops when the app is backgrounded. Physical road accuracy still needs calibration.

**Manual reports:** choose **Report a pothole**, add a photograph and mark the location. Offline drafts synchronize when the server is reachable. AI image recognition remains disconnected.

The APK was tested on an Android 15 emulator. Build metadata is in [build.json](build.json); verify the APK with [SHA256SUMS](SHA256SUMS):

```sh
cd downloads
shasum -a 256 -c SHA256SUMS
```

The published APK contains no API keys or database credentials. Signing keys and local user data are not included in this repository.
