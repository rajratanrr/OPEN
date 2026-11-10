import { afterEach, expect, it, vi } from "vitest";
import { newId } from "../lib/id";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("creates unique v4 identifiers when the HTTP WebView has no randomUUID", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: globalThis.crypto.getRandomValues.bind(globalThis.crypto),
  });
  const ids = Array.from({ length: 64 }, newId);
  expect(new Set(ids).size).toBe(64);
  for (const id of ids)
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
});
