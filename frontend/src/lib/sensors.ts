export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number | null;
  timestamp: number;
}
export const distanceMeters = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) => {
  const rad = Math.PI / 180,
    dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
};
export class BumpDetector {
  private baseline: number[] = [];
  private previous = 0;
  private previousTime = 0;
  private lastEvent = 0;
  private lastPlace: Position | null = null;
  private consecutive = 0;
  private smoothed = 0;
  constructor(private threshold = 8) {}
  sample(magnitude: number, time: number, position: Position | null) {
    const dt = (time - this.previousTime) / 1000;
    const jerk =
      this.previousTime && dt >= 0.01 && dt < 1
        ? Math.abs(magnitude - this.previous) / dt
        : 0;
    this.previous = magnitude;
    this.previousTime = time;
    if (!Number.isFinite(magnitude) || magnitude < 0 || magnitude > 200)
      return { magnitude: 0, jerk: 0, event: false, calibrated: false };
    this.smoothed = 0.45 * magnitude + 0.55 * this.smoothed;
    if (this.baseline.length < 30) {
      this.baseline.push(magnitude);
      return {
        magnitude: this.smoothed,
        jerk,
        event: false,
        calibrated: false,
      };
    }
    const sorted = [...this.baseline].sort((a, b) => a - b);
    const threshold = Math.max(this.threshold, sorted[15] + 5);
    this.consecutive = this.smoothed > threshold ? this.consecutive + 1 : 0;
    const usable =
      position &&
      time - position.timestamp <= 5000 &&
      position.accuracy <= 50 &&
      position.accuracy >= 0 &&
      position.speed !== null &&
      position.speed >= 1.5 &&
      position.speed <= 60;
    const event =
      !!usable &&
      this.consecutive >= 2 &&
      jerk >= 5 &&
      jerk <= 2000 &&
      time - this.lastEvent > 3000 &&
      (!this.lastPlace || distanceMeters(position!, this.lastPlace) >= 15);
    if (event) {
      this.lastEvent = time;
      this.lastPlace = position;
      this.consecutive = 0;
    }
    return { magnitude: this.smoothed, jerk, event, calibrated: true };
  }
}
