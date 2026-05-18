import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KairoEvent } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "./event-store.ts";

let tmp: string;
let store: EventStore;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-store-"));
  store = new EventStore(join(tmp, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
});

function commitEvent(overrides: Partial<KairoEvent> = {}): KairoEvent {
  return {
    id: crypto.randomUUID(),
    projectId: "p1",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123",
      parentShas: [],
      author: "test",
      message: "test commit",
      files: [],
    },
    ...overrides,
  } as KairoEvent;
}

describe("EventStore", () => {
  it("appends and reads events back", () => {
    const ev = commitEvent();
    store.append(ev);
    const out = store.recentEvents("p1");
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe(ev.id);
    expect(out[0]?.kind).toBe("git.commit");
  });

  it("scopes by projectId", () => {
    store.append(commitEvent({ projectId: "p1" }));
    store.append(commitEvent({ projectId: "p2" }));
    expect(store.recentEvents("p1")).toHaveLength(1);
    expect(store.recentEvents("p2")).toHaveLength(1);
  });

  it("returns most recent first", () => {
    store.append(commitEvent({ occurredAt: "2026-05-18T09:00:00.000Z" }));
    store.append(commitEvent({ occurredAt: "2026-05-18T11:00:00.000Z" }));
    const out = store.recentEvents("p1");
    expect(out[0]?.occurredAt).toBe("2026-05-18T11:00:00.000Z");
    expect(out[1]?.occurredAt).toBe("2026-05-18T09:00:00.000Z");
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) {
      store.append(commitEvent({ occurredAt: new Date(2026, 4, 18, i).toISOString() }));
    }
    expect(store.recentEvents("p1", 2)).toHaveLength(2);
  });

  it("loads all project events oldest first", () => {
    store.append(commitEvent({ occurredAt: "2026-05-18T11:00:00.000Z" }));
    store.append(commitEvent({ id: crypto.randomUUID(), occurredAt: "2026-05-18T09:00:00.000Z" }));

    const out = store.eventsForProject("p1");

    expect(out).toHaveLength(2);
    expect(out[0]?.occurredAt).toBe("2026-05-18T09:00:00.000Z");
    expect(out[1]?.occurredAt).toBe("2026-05-18T11:00:00.000Z");
  });

  it("returns the latest ingested git commit SHA", () => {
    store.append(
      commitEvent({
        occurredAt: "2026-05-18T09:00:00.000Z",
        payload: {
          sha: "older",
          parentShas: [],
          author: "test",
          message: "older commit",
          files: [],
        },
      }),
    );
    store.append(
      commitEvent({
        id: crypto.randomUUID(),
        occurredAt: "2026-05-18T11:00:00.000Z",
        payload: {
          sha: "newer",
          parentShas: ["older"],
          author: "test",
          message: "newer commit",
          files: [],
        },
      }),
    );

    expect(store.latestGitCommitSha("p1")).toBe("newer");
    expect(store.latestGitCommitSha("missing")).toBeNull();
  });
});
