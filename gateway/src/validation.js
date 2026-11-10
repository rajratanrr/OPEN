import { z } from "zod";
export function withinSession(recordedAt, session, now = Date.now()) {
  const time = Date.parse(recordedAt);
  const skew = 30000;
  return (
    Number.isFinite(time) &&
    time >=
      Math.max(now - 7 * 86400000, Date.parse(session.startedAt) - skew) &&
    time <=
      Math.min(
        now + skew,
        session.endedAt ? Date.parse(session.endedAt) + skew : Infinity,
      )
  );
}
export const telemetrySchema = z
  .object({
    sessionId: z.uuid(),
    samples: z
      .array(
        z
          .object({
            id: z.uuid(),
            recordedAt: z.iso.datetime(),
            magnitude: z.number().min(0).max(200),
            jerk: z.number().min(0).max(2000),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            speed: z.number().min(0).max(60).nullable(),
            accuracy: z.number().min(0).max(5000),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
