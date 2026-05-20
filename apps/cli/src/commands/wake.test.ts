import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runWake } from "./wake.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-wake-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runWake", () => {
  it("prints recent session context as markdown", () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          id: "11111111-1111-4111-8111-111111111111",
          projectId: config.projectId,
          slug: "auth-rewrite",
          title: "Auth rewrite",
          startedAt: "2026-05-19T10:00:00.000Z",
          endedAt: "2026-05-19T11:00:00.000Z",
          intent: "feature",
          summary: "Moved login state into the panel.",
          themes: ["auth", "sessions"],
          affectedAreas: ["apps/mcp"],
          files: ["apps/mcp/src/tools/search.ts"],
          commitShas: ["abcdef1234567890"],
          architectureImpact: "MCP now reads project memory through the store.",
        }),
      );
      store.appendSession(
        session({
          id: "22222222-2222-4222-8222-222222222222",
          projectId: config.projectId,
          slug: "old-session",
          title: "Old session",
          startedAt: "2026-05-01T10:00:00.000Z",
        }),
      );
    } finally {
      store.close();
    }

    expect(
      runWake({ days: 7, now: new Date("2026-05-20T10:00:00.000Z") }, root),
    ).toMatchInlineSnapshot(`
      "# Kairo Wake Context

      Project: demo
      Window: last 7 days
      Generated: 2026-05-20T10:00:00.000Z

      ## Recent Sessions

      ### 2026-05-19 — Auth rewrite

      - Slug: \`auth-rewrite\`
      - Intent: feature
      - Time: 2026-05-19T10:00:00.000Z → 2026-05-19T11:00:00.000Z
      - Summary: Moved login state into the panel.
      - Themes: \`auth\`, \`sessions\`
      - Areas: \`apps/mcp\`
      - Files: \`apps/mcp/src/tools/search.ts\`
      - Commits: \`abcdef1\`
      - Architecture impact: MCP now reads project memory through the store.

      ## Architecture Shifts

      No architecture shifts recorded yet.
      "
    `);
  });

  it("prints an empty-window message", () => {
    const workspace = new Workspace(root);
    workspace.init("demo");

    expect(runWake({ days: 1, now: new Date("2026-05-20T10:00:00.000Z") }, root)).toContain(
      "No sessions recorded in this window.",
    );
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
