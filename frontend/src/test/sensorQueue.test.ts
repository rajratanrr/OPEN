import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  patch: vi.fn(),
  api: vi.fn(),
}));
vi.mock("../lib/api", () => mocks);
import { queueSensor, syncSensorQueue } from "../lib/sensorQueue";
import { readSensor } from "../lib/offline";

it("drains a stop queued while an earlier telemetry upload is still in flight", async () => {
  let finish!: () => void;
  mocks.post.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  mocks.patch.mockResolvedValue({});
  await queueSensor("queue-race-test", "session-test", "telemetry", {
    samples: [],
  });
  const first = syncSensorQueue("queue-race-test");
  await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
  await queueSensor("queue-race-test", "session-test", "stop", {});
  const second = syncSensorQueue("queue-race-test");
  finish();
  await Promise.all([first, second]);
  expect(mocks.patch).toHaveBeenCalledWith(
    "/monitoring/sessions/session-test/stop",
  );
  expect(await readSensor("queue-race-test")).toEqual([]);
});
