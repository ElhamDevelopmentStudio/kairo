import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairohq/core";
import type { Session } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { recentSessions } from "./recent-sessions.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-recent-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("recentSessions", () => {
  it("returns real recent sessions from the workspace EventStore", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          id: "11111111-1111-4111-8111-111111111111",
          projectId: config.projectId,
          slug: "older",
          title: "Older session",
          startedAt: "2026-05-18T09:00:00.000Z",
        }),
      );
      store.appendSession(
        session({
          id: "22222222-2222-4222-8222-222222222222",
          projectId: config.projectId,
          slug: "newer",
          title: "Newer session",
          startedAt: "2026-05-18T11:00:00.000Z",
          summary: "Implemented live observation",
          files: ["apps/cli/src/commands/watch.ts"],
        }),
      );
      store.appendSession(
        session({
          id: "33333333-3333-4333-8333-333333333333",
          projectId: "other-project",
          slug: "other",
          title: "Other project",
          startedAt: "2026-05-18T12:00:00.000Z",
        }),
      );
    } finally {
      store.close();
    }

    const sessions = recentSessions({ workspace }, 1);

    expect(sessions).toEqual([
      expect.objectContaining({
        slug: "newer",
        title: "Newer session",
        summary: "Implemented live observation",
        files: ["apps/cli/src/commands/watch.ts"],
      }),
    ]);
  });

  it("returns an empty array when no workspace is available", () => {
    expect(recentSessions({ workspace: null }, 10)).toEqual([]);
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
