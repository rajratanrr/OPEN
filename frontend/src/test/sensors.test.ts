import { describe, it, expect } from "vitest";
import { BumpDetector, distanceMeters } from "../lib/sensors";
const position = {
  latitude: 30.9,
  longitude: 75.85,
  accuracy: 8,
  speed: 10,
  timestamp: 100000,
};
function calibrated() {
  const d = new BumpDetector(8);
  for (let i = 0; i < 30; i++) d.sample(0.2, 99000 + i * 20, position);
  return d;
}
describe("conservative road sensing", () => {
  it("does not turn ordinary movement into a pothole", () => {
    const d = calibrated();
    for (let i = 0; i < 100; i++)
      expect(
        d.sample(Math.sin(i) * 0.3 + 0.4, 100000 + i * 20, position).event,
      ).toBe(false);
  });
  it("requires a valid speed, accurate and fresh GPS", () => {
    for (const p of [
      { ...position, speed: null },
      { ...position, accuracy: 100 },
      { ...position, timestamp: 80000 },
      { ...position, speed: 0.2 },
    ]) {
      const d = calibrated();
      for (let i = 0; i < 5; i++)
        expect(d.sample(30 + i * 2, 100000 + i * 20, p).event).toBe(false);
    }
  });
  it("flags a sustained impact, then suppresses repeats at the same location", () => {
    const d = calibrated();
    d.sample(30, 100000, position);
    expect(d.sample(32, 100020, position).event).toBe(true);
    for (let i = 1; i < 12; i++)
      expect(d.sample(30 + i, 100020 + i * 20, position).event).toBe(false);
  });
  it("does not use arbitrary coordinates for a missing fix", () => {
    const d = calibrated();
    expect(d.sample(30, 100000, null).event).toBe(false);
    expect(d.sample(32, 100020, null).event).toBe(false);
  });
  it("computes real geographic distances", () => {
    expect(distanceMeters(position, position)).toBe(0);
    expect(
      distanceMeters(position, { ...position, latitude: 30.901 }),
    ).toBeCloseTo(111.195, 1);
  });
});
