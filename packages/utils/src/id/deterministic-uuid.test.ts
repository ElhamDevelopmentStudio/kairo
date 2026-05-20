import { describe, expect, it } from "vitest";
import { deterministicUuid } from "./deterministic-uuid.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

describe("deterministicUuid", () => {
  it("returns a UUID-shaped string", () => {
    expect(deterministicUuid("git.commit", "p1", "abc123")).toMatch(UUID_PATTERN);
  });

  it("is stable for the same inputs", () => {
    const a = deterministicUuid("git.commit", "p1", "abc123");
    const b = deterministicUuid("git.commit", "p1", "abc123");
    expect(a).toBe(b);
  });

  it("differs when any input changes", () => {
    const base = deterministicUuid("git.commit", "p1", "abc123");
    expect(deterministicUuid("git.commit", "p1", "abc124")).not.toBe(base);
    expect(deterministicUuid("git.commit", "p2", "abc123")).not.toBe(base);
    expect(deterministicUuid("git.branch", "p1", "abc123")).not.toBe(base);
  });

  it("treats unambiguous input boundaries (avoids concatenation collisions)", () => {
    expect(deterministicUuid("ab", "c")).not.toBe(deterministicUuid("a", "bc"));
  });
});
