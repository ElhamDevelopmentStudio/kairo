import type { KairoEvent } from "@kairohq/shared";
import { describe, expect, it } from "vitest";
import { LiveSession } from "./live-session.ts";

describe("LiveSession", () => {
  it("finalizes the current session after an idle flush", () => {
    const live = new LiveSession("p1", { idleGapMinutes: 30, minEventsForSession: 2 });
    live.observe(fsEvent("1", "2026-05-18T10:00:00.000Z", "src/a.ts"));
    live.observe(fsEvent("2", "2026-05-18T10:05:00.000Z", "src/b.ts"));

    const finalized = live.flush(new Date("2026-05-18T10:36:00.000Z"));

    expect(finalized).toHaveLength(1);
    expect(finalized[0]?.session.files.sort()).toEqual(["src/a.ts", "src/b.ts"]);
    expect(finalized[0]?.events.map((event) => event.id)).toEqual(["1", "2"]);
  });

  it("does not finalize before idle timeout or below min events", () => {
    const live = new LiveSession("p1", { idleGapMinutes: 30, minEventsForSession: 2 });
    live.observe(fsEvent("1", "2026-05-18T10:00:00.000Z"));

    expect(live.flush(new Date("2026-05-18T10:40:00.000Z"))).toEqual([]);
  });

  it("finalizes the previous session when a new event arrives after an idle gap", () => {
    const live = new LiveSession("p1", { idleGapMinutes: 30, minEventsForSession: 2 });
    live.observe(fsEvent("1", "2026-05-18T10:00:00.000Z"));
    live.observe(fsEvent("2", "2026-05-18T10:05:00.000Z"));

    const finalized = live.observe(fsEvent("3", "2026-05-18T11:00:00.000Z"));

    expect(finalized).toHaveLength(1);
    expect(finalized[0]?.events.map((event) => event.id)).toEqual(["1", "2"]);
    expect(live.flush(new Date("2026-05-18T11:40:00.000Z"))).toEqual([]);
  });
});

function fsEvent(id: string, occurredAt: string, path = "src/a.ts"): KairoEvent {
  return {
    id,
    projectId: "p1",
    occurredAt,
    observedAt: occurredAt,
    source: "fs",
    kind: "fs.change",
    payload: { path, op: "modify" },
  };
}
