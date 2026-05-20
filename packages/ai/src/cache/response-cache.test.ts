import { describe, expect, it } from "vitest";
import { ResponseCache, cacheKey } from "./response-cache.ts";

describe("ResponseCache", () => {
  it("keys responses by content hash", () => {
    const cache = new ResponseCache<string>();
    cache.set(["session", ["event-1"], "model-a"], "summary");

    expect(cache.get(["session", ["event-1"], "model-a"])).toBe("summary");
    expect(cache.get(["session", ["event-2"], "model-a"])).toBeNull();
    expect(cacheKey(["same"])).toBe(cacheKey(["same"]));
    expect(cacheKey(["same"])).not.toBe(cacheKey(["different"]));
  });
});
