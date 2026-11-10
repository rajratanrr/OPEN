import { beforeEach, describe, it, expect, vi } from "vitest";
import { deleteDB } from "idb";
const mocks = vi.hoisted(() => ({
  api: vi.fn(),
  post: vi.fn(),
  upload: vi.fn(),
}));
vi.mock("../lib/api", () => mocks);
import { saveDraft, drafts, syncDrafts, removeDraft } from "../lib/offline";
import type { Draft } from "../lib/offline";
const make = (id: string, ownerId = "user-a"): Draft => ({
  id,
  ownerId,
  image: new Blob(["test"]),
  createdAt: new Date().toISOString(),
  input: {
    clientRequestId: id,
    roadName: "Test road",
    description: "Offline road damage",
    latitude: 30.9,
    longitude: 75.85,
    gpsAccuracyMeters: null,
    damageType: "POTHOLE",
    severity: "UNKNOWN",
    aiAnalysisId: null,
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.api.mockResolvedValue({ id: "user-a" });
  mocks.upload.mockResolvedValue({ id: "evidence-1" });
});
describe("offline report outbox", () => {
  it("keeps unsuccessful reports and their idempotency key", async () => {
    await saveDraft(make("failed"));
    mocks.post.mockRejectedValue(new Error("Network failed"));
    await syncDrafts("user-a");
    const pending = await drafts("user-a");
    expect(pending.find((d) => d.id === "failed")?.input.clientRequestId).toBe(
      "failed",
    );
    expect(pending.find((d) => d.id === "failed")?.evidenceId).toBe(
      "evidence-1",
    );
    await removeDraft("failed");
  });
  it("removes a draft only after the server confirms persistence", async () => {
    await saveDraft(make("success"));
    mocks.post.mockResolvedValue({ id: "server-id" });
    const result = await syncDrafts("user-a");
    expect(result).toEqual([{ id: "server-id" }]);
    expect(await drafts("user-a")).toHaveLength(0);
    expect(mocks.post).toHaveBeenCalledWith(
      "/reports",
      expect.objectContaining({
        clientRequestId: "success",
        evidenceId: "evidence-1",
      }),
    );
  });
  it("never syncs another account’s private drafts", async () => {
    await saveDraft(make("private", "user-b"));
    await expect(syncDrafts("user-b")).rejects.toThrow("account");
    expect(mocks.upload).not.toHaveBeenCalled();
    await removeDraft("private");
  });
});
