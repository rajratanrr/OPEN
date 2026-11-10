import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { telemetrySchema, withinSession } from "../src/validation.js";
const batch = () => ({
  sessionId: randomUUID(),
  samples: [
    {
      id: randomUUID(),
      recordedAt: new Date().toISOString(),
      magnitude: 10,
      jerk: 20,
      latitude: 30.9,
      longitude: 75.85,
      speed: 8,
      accuracy: 10,
    },
  ],
});
test("small phone clock skew is accepted, but out-of-session or stale samples are rejected", () => {
  const now = Date.parse("2026-11-10T12:00:00Z");
  const session = {
    startedAt: new Date(now - 10000).toISOString(),
    endedAt: new Date(now - 5000).toISOString(),
  };
  assert(withinSession(new Date(now - 10500).toISOString(), session, now));
  assert(!withinSession(new Date(now - 41000).toISOString(), session, now));
  assert(!withinSession(new Date(now + 26000).toISOString(), session, now));
  assert(
    !withinSession(
      new Date(now + 31000).toISOString(),
      { ...session, endedAt: null },
      now,
    ),
  );
  assert(
    !withinSession(
      new Date(now - 8 * 86400000).toISOString(),
      { startedAt: new Date(now - 9 * 86400000).toISOString() },
      now,
    ),
  );
});
test("valid real telemetry sample is accepted", () =>
  assert(telemetrySchema.safeParse(batch()).success));
test("unbounded and nonfinite sensor data is rejected", () => {
  const b = batch();
  b.samples[0].magnitude = Infinity;
  assert(!telemetrySchema.safeParse(b).success);
});
test("caller cannot inject an owner or privileged metadata", () => {
  const b = batch();
  b.samples[0].userId = "victim";
  assert(!telemetrySchema.safeParse(b).success);
});
test("batches and coordinates are bounded", () => {
  const b = batch();
  b.samples[0].latitude = 100;
  assert(!telemetrySchema.safeParse(b).success);
  b.samples = Array(101).fill(batch().samples[0]);
  assert(!telemetrySchema.safeParse(b).success);
});
