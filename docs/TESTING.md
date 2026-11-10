# Verification record

Verified locally on **10 November 2026**. These results are from executing the implementation, not from simulated API responses.

| Check | Actual result |
| --- | --- |
| TypeScript + Vite production build | Passed |
| Spring Boot / Maven verify on Java 21 | Passed |
| Flyway foundation migration on PostgreSQL 18.6 + PostGIS 3.6 | Passed, including a separate fresh database |
| JUnit + Mockito | 12 tests passed |
| Vitest + React Testing Library | 12 tests passed |
| Express/Zod Node tests | 5 tests passed |
| Playwright on installed Chrome | 3 complete scenarios passed |
| Full-stack HTTP smoke test | 23 checks passed against actual PostgreSQL and MongoDB |
| Production bootstrap | Fresh database, first administrator login, demo disabled and zero reports verified |
| npm audit | 0 vulnerabilities reported for the installed dependency tree |
| Android build and lint | `assembleDebug` and `lintDebug` passed; no lint errors (dependency/template warnings remain) |
| APK signature | v1 and v2 verification passed; debug signing |
| Installed Android 15 emulator | Seven end-to-end checks passed through the actual APK WebView and native bridges |
| Responsive inspection | Desktop and 390 px phone viewport inspected; core mobile pages have no horizontal overflow |
| Docker Compose | YAML parsed; container execution unavailable on this host |

## Browser scenarios

1. Register a new citizen, see the empty-account dashboard, submit a real validated test photograph, persist a report, filter its public map marker, open details, reject a citizen's privileged request with HTTP 403, verify/assign/start repair as an officer, upload completion evidence, resolve it and confirm the citizen sees the five-step timeline and repair photograph.
2. Create a report with the browser offline, save image and input in IndexedDB, reload offline through the production service worker, reconnect, sync and verify exactly one persisted report.
3. Render the citizen dashboard and core citizen routes at 390 px; verify no page overflow or uncaught page errors; open municipal analytics and the administrator screen. Screenshots are in `docs/screenshots`.

The browser checks uncovered and drove fixes for session-cache restoration, offline lazy-module caching, accessible field labels and Leaflet animation during page teardown. The final tests wait for persisted outcomes rather than treating a button click as success.

## Installed APK checks

`scripts/android-smoke.mjs` uses Playwright's Android WebView driver against the debug APK installed on a dedicated Android 15 ARM64 emulator, with the actual Spring/Express/PostgreSQL/MongoDB server. It verifies sign-in and reload, manual photo report persistence and image rendering, offline app reload with a retained photo draft and exactly-once synchronization, native GPS/motion callbacks and explicit stop, background stop with persisted stopped sessions, GPS-tagged raw readings persisted in private MongoDB storage, and a dashboard without uncaught page errors. There is no simulated API response. Emulator GPS/sensor input is test data; this does not establish real-road detection accuracy.

These checks found and fixed Vite intercepting API preflights, image resource-policy handling across ports, an in-flight sensor queue/stop race, and the Android lifecycle not always producing the browser visibility event. The native pause event now stops both the hardware and the JavaScript monitoring session. A measured 0.3-second phone/server clock difference exposed rejected first samples; both stores now accept a bounded 30-second session clock tolerance, with out-of-window timestamps tested and rejected. Local Android builds also use secure random IDs when HTTP lacks `crypto.randomUUID`.

Run on the dedicated emulator after installing/launching the APK:

```sh
PHONE_TEST_SERVER=http://<Mac-local-IP>:5173 node scripts/android-smoke.mjs
```

## Full-stack HTTP coverage

The smoke test verifies health, registration, HttpOnly session use, refresh rotation, role isolation, real JPEG normalization, rejection of forged image bytes, the disconnected-AI response, report idempotency, meter-based spatial inclusion/exclusion, municipal verification, deduplicated confirmations and rewards, assignment, repair-state constraints, completion evidence, public map updates, notifications, SQL analytics, private monitoring ownership, PostgreSQL sensor-event persistence, MongoDB sample persistence, audit records and logout revocation.

JUnit checks legal/illegal transitions, AI response validation, session secrets, signing-key strength, image resizing/encoding, forged content, pixel limits, path traversal, evidence ownership and file cleanup when a database write fails. Frontend tests exercise auth form errors, retained input, offline ownership/retry/acknowledgement behavior and sensor filtering/cooldowns. Gateway tests exercise raw-sample validation, finite bounds, batch size and rejected owner injection.

All QA accounts and reports are explicitly synthetic. The final local workspace retains labeled demo data and any user-created records; only records generated by these QA scripts are removed after validation.

## Not claimed as tested

- Live OpenAI analysis or model accuracy: no API key was connected, as requested. The missing-key fallback is tested.
- Physical Android accelerometer/GPS accuracy and camera/permission dialogs on a real phone remain unverified. Emulator GPS was deliberately injected as test data and permissions were granted via ADB. Follow `ANDROID.md` for physical acceptance.
- Docker startup, MinIO/S3 uploads, external SMTP delivery, a public HTTPS deployment, load testing or independent security review.
- The optional AI assistant, AI duplicate-image comparison, description summarization, trained object-detection service and road-segment map matching are deferred, not mocked.

PostgreSQL 18 emits a Flyway compatibility warning because the bundled Flyway release lists PostgreSQL 17 as its newest tested version. Both initial and repeat migrations succeeded locally; Compose intentionally uses PostgreSQL 17.
