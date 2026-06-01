import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairohq/core";
import type { KairoEvent, Session } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { sessionDetail } from "./session-detail.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-detail-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("sessionDetail", () => {
  it("returns one session by slug with ordered events and markdown", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const first = fsEvent({
      id: "11111111-1111-4111-8111-111111111111",
      projectId: config.projectId,
      occurredAt: "2026-05-18T10:00:00.000Z",
      payload: { path: "src/a.ts", op: "modify" },
    });
    const second = fsEvent({
      id: "22222222-2222-4222-8222-222222222222",
      projectId: config.projectId,
      occurredAt: "2026-05-18T10:05:00.000Z",
      payload: { path: "src/b.ts", op: "modify" },
    });
    const target = session({
      projectId: config.projectId,
      slug: "target-session",
      title: "Target session",
      eventIds: [second.id, first.id],
    });
    const store = new EventStore(workspace.dbPath);
    try {
      store.append(first);
      store.append(second);
      store.appendSession(target);
      store.appendSession(
        session({
          id: "33333333-3333-4333-8333-333333333333",
          projectId: "other-project",
          slug: "target-session",
          title: "Wrong project",
        }),
      );
    } finally {
      store.close();
    }
    writeFileSync(workspace.sessionPath(target.slug), "# Stored markdown\n");

    const detail = sessionDetail({ workspace }, "target-session");

    expect(detail?.session.title).toBe("Target session");
    expect(detail?.events.map((event) => event.id)).toEqual([second.id, first.id]);
    expect(detail?.markdown).toBe("# Stored markdown\n");
  });

  it("renders markdown from the store when no session file exists", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const event = fsEvent({ projectId: config.projectId });
    const storedSession = session({
      projectId: config.projectId,
      slug: "rendered-session",
      eventIds: [event.id],
    });
    const store = new EventStore(workspace.dbPath);
    try {
      store.append(event);
      store.appendSession(storedSession);
    } finally {
      store.close();
    }

    const detail = sessionDetail({ workspace }, "rendered-session");

    expect(detail?.markdown).toContain("# Session");
    expect(detail?.markdown).toContain("- modify `src/a.ts`");
  });

  it("returns null when no workspace or session is available", () => {
    const workspace = new Workspace(root);
    workspace.init("demo");

    expect(sessionDetail({ workspace: null }, "missing")).toBeNull();
    expect(sessionDetail({ workspace }, "missing")).toBeNull();
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "p1",
    title: "Session",
    slug: "session",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T11:00:00.000Z",
    intent: "unknown",
    themes: [],
    affectedAreas: [],
    commitShas: [],
    files: ["src/a.ts"],
    summary: null,
    architectureImpact: null,
    eventIds: [],
    ...overrides,
  };
}

function fsEvent(overrides: Partial<KairoEvent> = {}): KairoEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "p1",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "fs",
    kind: "fs.change",
    payload: { path: "src/a.ts", op: "modify" },
    ...overrides,
  } as KairoEvent;
}
