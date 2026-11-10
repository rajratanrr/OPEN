import type { CapacitorConfig } from "@capacitor/cli";

// LAN settings are only used by scripts/build-android.py for a debug APK.
// Packaged assets use the same host/scheme as the API, on a different port.
// Production remains HTTPS; see docs/ANDROID.md.
const lanHost = process.env.NATIVE_LAN_HOST;
const config: CapacitorConfig = {
  appId: "in.roadsaathi.app",
  appName: "RoadSaathi",
  webDir: process.env.ROADSAATHI_WEB_OUT_DIR || "dist",
  loggingBehavior: "none",
  android: {
    path: "../mobile/android",
    allowMixedContent: false,
    adjustMarginsForEdgeToEdge: "auto",
  },
  server: {
    hostname:
      lanHost || process.env.NATIVE_HOSTNAME || "app.roadsaathi.example",
    androidScheme: lanHost ? "http" : "https",
    cleartext: false,
  },
};
export default config;
