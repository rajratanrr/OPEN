/** Run against an installed debug APK on the dedicated QA emulator.
 * Uses Playwright's Android WebView driver. No production devices.
 */
import { _android, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const run = promisify(execFile);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const adb =
  process.env.ADB || resolve(root, "../../work/android-sdk/platform-tools/adb");
const serial = process.env.ANDROID_SERIAL || "emulator-5554";
if (!serial.startsWith("emulator-"))
  throw Error("This script only operates the dedicated QA emulator.");
const server = process.env.PHONE_TEST_SERVER;
if (!server)
  throw Error("Set PHONE_TEST_SERVER to the Mac's local Wi-Fi test URL.");
const origin = new URL(server).origin.replace(":5173", "");
const device = (await _android.devices()).find((d) => d.serial() === serial);
if (!device) throw Error("Start the dedicated QA emulator first.");
const page = await (await device.webView({ pkg: "in.roadsaathi.app" })).page();
const context = page.context();
page.setDefaultTimeout(25000);
const checks = [],
  errors = [],
  sessions = [];
page.on("pageerror", (e) => errors.push(e.message));
const api = (path) =>
  page.evaluate(
    async ({ url }) => {
      const r = await fetch(url, {
        credentials: "include",
        headers: { "X-Roadsaathi": "1" },
      });
      if (!r.ok) throw Error(`HTTP ${r.status}`);
      return r.json();
    },
    { url: server + "/api/v1" + path },
  );
const command = (...args) => run(adb, ["-s", serial, ...args]);
let gpsTimer;
await mkdir(resolve(root, "test-results"), { recursive: true });
try {
  await page.goto(origin + "/login");
  expect(await page.evaluate(() => window.Capacitor?.isNativePlatform())).toBe(
    true,
  );
  await page.getByRole("button", { name: "Citizen", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Hello, Aarav." }),
  ).toBeVisible();
  checks.push(
    "Installed APK opens; native bridge present; cookie sign-in survives reload",
  );

  const first = (await api("/reports?pageSize=1")).items[0];
  const photo = Buffer.from(
    await (
      await fetch(server + "/api/v1/evidence/" + first.evidenceId)
    ).arrayBuffer(),
  );
  async function fill(name) {
    await page
      .getByLabel("Road photograph")
      .setInputFiles({
        name: "synthetic-road.jpg",
        mimeType: "image/jpeg",
        buffer: photo,
      });
    await page.getByLabel("Road or landmark").fill(name);
    await page
      .getByLabel("What did you notice?")
      .fill(
        "Synthetic browser test of the civic reporting and repair workflow.",
      );
    await page.getByLabel("Latitude", { exact: true }).fill("30.9025");
    await page.getByLabel("Longitude", { exact: true }).fill("75.8545");
  }
  await page.goto(origin + "/report");
  const road = "Browser QA " + randomUUID().slice(0, 8);
  await fill(road);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Submit report", exact: true })
    .click();
  await expect(page).toHaveURL(/\/reports\/[0-9a-f-]{36}$/);
  await expect(
    page.getByRole("heading", { name: road, exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator("img.detail-photo").evaluate((img) => img.naturalWidth),
    )
    .toBeGreaterThan(0);
  checks.push(
    "Manual map coordinates, photo upload, persisted pending report and report image load",
  );

  await page.goto(origin + "/report");
  await expect(page.getByLabel("Road photograph")).toBeVisible();
  await context.setOffline(true);
  const offline = "Offline QA " + randomUUID().slice(0, 8);
  await fill(offline);
  await page
    .getByRole("button", { name: "Save to outbox", exact: true })
    .click();
  await page.getByRole("button", { name: /Offline outbox/ }).click();
  await expect(page.getByText(offline, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Offline outbox/ }).click();
  await expect(page.getByText(offline, { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByRole("heading", { name: "Your outbox is clear" }),
  ).toBeVisible();
  expect(
    (await api("/users/me/reports?q=" + encodeURIComponent(offline))).total,
  ).toBe(1);
  checks.push(
    "Bundled APK reloads offline, retains photo draft and synchronizes exactly once",
  );

  const before = new Set((await api("/monitoring/sessions")).map((s) => s.id));
  await command(
    "shell",
    "pm",
    "grant",
    "in.roadsaathi.app",
    "android.permission.ACCESS_COARSE_LOCATION",
  );
  await command(
    "shell",
    "pm",
    "grant",
    "in.roadsaathi.app",
    "android.permission.ACCESS_FINE_LOCATION",
  );
  await command("shell", "cmd", "location", "set-location-enabled", "true");
  const injectTestGps = () =>
    command("emu", "geo", "fix", "75.8545", "30.9025").catch(() => {});
  await injectTestGps();
  gpsTimer = setInterval(injectTestGps, 1500);
  await page.goto(origin + "/monitor");
  await page
    .getByRole("button", { name: "Start monitoring", exact: true })
    .click();
  await expect(
    page.getByText("Sensor calibrated. Possible impacts remain unverified."),
  ).toBeVisible({ timeout: 30000 });
  await page
    .getByRole("button", { name: "Stop monitoring", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start monitoring", exact: true }),
  ).toBeEnabled();
  checks.push(
    "Native GPS and accelerometer bridge deliver emulator readings; explicit stop works",
  );
  await page
    .getByRole("button", { name: "Start monitoring", exact: true })
    .click();
  await expect(
    page.getByText("Sensor calibrated. Possible impacts remain unverified."),
  ).toBeVisible({ timeout: 30000 });
  await command("shell", "input", "keyevent", "KEYCODE_HOME");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  await command(
    "shell",
    "am",
    "start",
    "-n",
    "in.roadsaathi.app/.MainActivity",
  );
  await expect(
    page.getByRole("button", { name: "Start monitoring", exact: true }),
  ).toBeEnabled();
  await expect
    .poll(async () => {
      const made = (await api("/monitoring/sessions")).filter(
        (s) => !before.has(s.id),
      );
      return made.length === 2 && made.every((s) => s.status === "STOPPED");
    })
    .toBe(true);
  sessions.push(
    ...(await api("/monitoring/sessions"))
      .filter((s) => !before.has(s.id))
      .map((s) => s.id),
  );
  checks.push(
    "Backgrounding pauses monitoring and persists stopped sessions without silent restart",
  );
  for (const id of sessions) {
    const raw = await api("/telemetry/sessions/" + id);
    expect(raw.length).toBeGreaterThan(0);
    expect(raw.every(sample => sample.sessionId === id && Number.isFinite(sample.latitude) && Number.isFinite(sample.longitude))).toBe(true);
  }
  checks.push("Actual emulator readings persist with GPS coordinates in private MongoDB telemetry");
  await page.goto(origin + "/dashboard");
  await expect(
    page.getByRole("heading", { name: "Hello, Aarav." }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(root, "docs/screenshots/android-emulator.png"),
  });
  expect(errors).toEqual([]);
  checks.push("Android dashboard screenshot captured; no uncaught page errors");
  await writeFile(
    resolve(root, "test-results/android-smoke.json"),
    JSON.stringify(
      { checks, sessions, server, physicalSensorAccuracyTested: false },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      { checks, sessions, physicalSensorAccuracyTested: false },
      null,
      2,
    ),
  );
} catch (error) {
  await page
    .screenshot({ path: resolve(root, "test-results/android-failure.png") })
    .catch(() => {});
  console.error("Android check failed:", error.message, "Completed checks:", checks, "Page errors:", errors);
  process.exitCode = 1;
} finally {
  clearInterval(gpsTimer);
  await context.setOffline(false).catch(() => {});
  await device.close();
}
