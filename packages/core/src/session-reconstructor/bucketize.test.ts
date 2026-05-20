import type { KairoEvent } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { bucketize } from "./bucketize.ts";

describe("bucketize", () => {
  it("splits events when the idle gap is exceeded", () => {
    const buckets = bucketize(
      [
        fsEvent("1", "2026-05-18T10:00:00.000Z"),
        fsEvent("2", "2026-05-18T10:10:00.000Z"),
        fsEvent("3", "2026-05-18T11:00:00.000Z"),
      ],
      30,
    );

    expect(buckets.map((bucket) => bucket.map((event) => event.id))).toEqual([["1", "2"], ["3"]]);
  });
});

function fsEvent(id: string, occurredAt: string): KairoEvent {
  return {
    id,
    projectId: "p1",
    occurredAt,
    observedAt: occurredAt,
    source: "fs",
    kind: "fs.change",
    payload: { path: "src/a.ts", op: "modify" },
  };
}
