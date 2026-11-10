import { openDB } from "idb";
import { api, post, upload } from "./api";
import type { ReportInput, RoadReport, User } from "../types";
export interface Draft {
  id: string;
  ownerId: string;
  image: Blob;
  input: Omit<ReportInput, "evidenceId">;
  createdAt: string;
  error?: string;
  evidenceId?: string;
}
const database = () =>
  openDB("roadsaathi-offline", 1, {
    upgrade(db) {
      db.createObjectStore("reports", { keyPath: "id" });
      db.createObjectStore("meta");
      db.createObjectStore("sensor", { keyPath: "id" });
    },
  });
export const saveDraft = async (draft: Draft) => {
  const db = await database();
  await db.put("reports", draft);
  window.dispatchEvent(new Event("queue-change"));
};
export const drafts = async (ownerId: string): Promise<Draft[]> => {
  const db = await database();
  return (await db.getAll("reports")).filter((d) => d.ownerId === ownerId);
};
export const removeDraft = async (id: string) => {
  const db = await database();
  await db.delete("reports", id);
  window.dispatchEvent(new Event("queue-change"));
};
export const cacheUser = async (user: User | null) => {
  const db = await database();
  user ? await db.put("meta", user, "user") : await db.delete("meta", "user");
};
export const cachedUser = async (): Promise<User | null> => {
  const db = await database();
  return (await db.get("meta", "user")) || null;
};
let syncing: Promise<RoadReport[]> | null = null;
export function syncDrafts(ownerId: string) {
  if (syncing) return syncing;
  syncing = (async () => {
    const user = await api<User>("/auth/me");
    if (user.id !== ownerId)
      throw new Error("Sign in with the account that saved these reports.");
    const completed: RoadReport[] = [];
    for (const d of await drafts(ownerId)) {
      try {
        if (!d.evidenceId) {
          d.evidenceId = (await upload(d.image)).id;
          await saveDraft(d);
        }
        const report = await post<RoadReport>("/reports", {
          ...d.input,
          evidenceId: d.evidenceId,
        });
        completed.push(report);
        await removeDraft(d.id);
      } catch (error) {
        await saveDraft({
          ...d,
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    }
    return completed;
  })().finally(() => {
    syncing = null;
  });
  return syncing;
}
export const saveSensor = async (id: string, value: unknown) => {
  const db = await database();
  await db.put("sensor", { id, ...(value as object) });
};
export const readSensor = async (ownerId: string) => {
  const db = await database();
  return (await db.getAll("sensor")).filter((s) => s.ownerId === ownerId);
};
export const removeSensor = async (id: string) => {
  const db = await database();
  await db.delete("sensor", id);
};
