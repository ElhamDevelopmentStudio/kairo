import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { askProjectMemory } from "./ask.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-ask-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("askProjectMemory", () => {
  it("returns a grounded answer from real workspace sessions", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          projectId: config.projectId,
          slug: "dashboard-routing",
          title: "Dashboard routing split",
          summary:
            "Split the dashboard into nested routes so session detail pages preserve navigation state.",
          files: ["apps/web/src/router.tsx"],
        }),
      );
    } finally {
      store.close();
    }

    const answer = askProjectMemory({ workspace }, "Why did dashboard routing change?", 5);

    expect(answer?.answer).toContain("Dashboard routing split");
    expect(answer?.citations[0]).toMatchObject({
      reference: "session:dashboard-routing",
      files: ["apps/web/src/router.tsx"],
    });
  });

  it("returns null without a workspace or question", () => {
    expect(askProjectMemory({ workspace: null }, "Why?", 5)).toBeNull();

    const workspace = new Workspace(root);
    workspace.init("demo");
    expect(askProjectMemory({ workspace }, "   ", 5)).toBeNull();
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
    files: [],
    summary: null,
    architectureImpact: null,
    eventIds: [],
    ...overrides,
  };
}
