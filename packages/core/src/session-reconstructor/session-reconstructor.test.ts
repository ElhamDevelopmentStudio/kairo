import type { KairoEvent } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { SessionReconstructor } from "./session-reconstructor.ts";

function fsEvent(occurredAt: string, path = "src/a.ts"): KairoEvent {
  return {
    id: crypto.randomUUID(),
    projectId: "p1",
    occurredAt,
    observedAt: occurredAt,
    source: "fs",
    kind: "fs.change",
    payload: { path, op: "modify" },
  };
}

function stableFsEvent(id: string, occurredAt: string, path = "src/a.ts"): KairoEvent {
  return {
    ...fsEvent(occurredAt, path),
    id,
  };
}

describe("SessionReconstructor", () => {
  it("returns no sessions for empty input", () => {
    const r = new SessionReconstructor("p1");
    expect(r.reconstruct([])).toEqual([]);
  });

  it("buckets consecutive events into a single session", () => {
    const r = new SessionReconstructor("p1", { idleGapMinutes: 30, minEventsForSession: 3 });
    const events = [
      fsEvent("2026-05-18T10:00:00.000Z"),
      fsEvent("2026-05-18T10:05:00.000Z"),
      fsEvent("2026-05-18T10:20:00.000Z"),
    ];
    const sessions = r.reconstruct(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.startedAt).toBe("2026-05-18T10:00:00.000Z");
    expect(sessions[0]?.endedAt).toBe("2026-05-18T10:20:00.000Z");
  });

  it("splits when an idle gap exceeds the threshold", () => {
    const r = new SessionReconstructor("p1", { idleGapMinutes: 30, minEventsForSession: 3 });
    const events = [
      fsEvent("2026-05-18T10:00:00.000Z"),
      fsEvent("2026-05-18T10:05:00.000Z"),
      fsEvent("2026-05-18T10:10:00.000Z"),
      // 2-hour gap
      fsEvent("2026-05-18T12:10:00.000Z"),
      fsEvent("2026-05-18T12:15:00.000Z"),
      fsEvent("2026-05-18T12:20:00.000Z"),
    ];
    const sessions = r.reconstruct(events);
    expect(sessions).toHaveLength(2);
  });

  it("drops buckets below the min-events threshold", () => {
    const r = new SessionReconstructor("p1", { idleGapMinutes: 30, minEventsForSession: 3 });
    const events = [fsEvent("2026-05-18T10:00:00.000Z"), fsEvent("2026-05-18T10:05:00.000Z")];
    expect(r.reconstruct(events)).toHaveLength(0);
  });

  it("collects unique file paths", () => {
    const r = new SessionReconstructor("p1", { idleGapMinutes: 30, minEventsForSession: 2 });
    const events = [
      fsEvent("2026-05-18T10:00:00.000Z", "src/a.ts"),
      fsEvent("2026-05-18T10:05:00.000Z", "src/b.ts"),
      fsEvent("2026-05-18T10:10:00.000Z", "src/a.ts"),
    ];
    const sessions = r.reconstruct(events);
    expect(sessions[0]?.files.sort()).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("generates stable session IDs for the same event bucket", () => {
    const r = new SessionReconstructor("p1", { idleGapMinutes: 30, minEventsForSession: 2 });
    const events = [
      stableFsEvent("11111111-1111-4111-8111-111111111111", "2026-05-18T10:00:00.000Z"),
      stableFsEvent("22222222-2222-4222-8222-222222222222", "2026-05-18T10:05:00.000Z"),
    ];

    const first = r.reconstruct(events);
    const second = r.reconstruct(events);

    expect(second[0]?.id).toBe(first[0]?.id);
    expect(first[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
