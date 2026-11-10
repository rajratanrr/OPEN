import { newId } from "./id";
import { api, patch, post } from "./api";
import { readSensor, removeSensor, saveSensor } from "./offline";
export async function queueSensor(
  ownerId: string,
  sessionId: string,
  kind: "events" | "telemetry" | "stop",
  body: unknown,
) {
  const id = newId();
  await saveSensor(id, {
    ownerId,
    sessionId,
    kind,
    body,
    createdAt: Date.now(),
  });
  return id;
}
let running: Promise<void> | null = null;
const requested = new Set<string>();
export function syncSensorQueue(ownerId: string) {
  requested.add(ownerId);
  if (running) return running;
  running = (async () => {
    // A stop marker may arrive while an earlier batch is in flight. Drain that
    // explicitly requested pass too; failed batches wait for a later retry.
    while (requested.size) {
      const owner = requested.values().next().value!;
      requested.delete(owner);
      for (const item of (await readSensor(owner)).sort(
        (a, b) => a.createdAt - b.createdAt,
      )) {
        try {
          if (
            item.kind !== "stop" &&
            Date.now() - item.createdAt > 7 * 86400000
          ) {
            await removeSensor(item.id);
            continue;
          }
          if (item.kind === "events")
            await post(
              "/monitoring/sessions/" + item.sessionId + "/events",
              item.body,
            );
          else if (item.kind === "telemetry")
            await post("/telemetry/samples", item.body);
          else await patch("/monitoring/sessions/" + item.sessionId + "/stop");
          await removeSensor(item.id);
        } catch {
          /* Retain failed batches until the next authenticated foreground retry. */
        }
      }
    }
  })().finally(() => {
    running = null;
  });
  return running;
}
