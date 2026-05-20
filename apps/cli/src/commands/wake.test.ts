import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderWakeBriefing, runWake } from "./wake.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-wake-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runWake", () => {
  it("prints recent session context as an AI prose briefing", async () => {
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

    const output = await runWake(
      {
        days: 7,
        now: new Date("2026-05-20T10:00:00.000Z"),
        proser: async (context) =>
          `You spent the last week on ${context.sessions[0]?.title}, mainly moving auth context into MCP-backed project memory.`,
      },
      root,
    );

    expect(output).toMatchInlineSnapshot(`
      "# Kairo Wake Briefing

      You spent the last week on Auth rewrite, mainly moving auth context into MCP-backed project memory.
      "
    `);
    expect(output).not.toContain("- ");
  });

  it("falls back to deterministic prose when AI prose is unavailable", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          projectId: config.projectId,
          slug: "auth-rewrite",
          title: "Auth rewrite",
          startedAt: "2026-05-19T10:00:00.000Z",
          intent: "feature",
          summary: "moved login state into the panel",
          themes: ["auth", "sessions"],
          affectedAreas: ["apps/mcp"],
          files: ["apps/mcp/src/tools/search.ts"],
          architectureImpact: "MCP now reads project memory through the store.",
        }),
      );
    } finally {
      store.close();
    }

    const output = await runWake(
      {
        days: 7,
        now: new Date("2026-05-20T10:00:00.000Z"),
        proser: async () => {
          throw new Error("provider unavailable");
        },
      },
      root,
    );

    expect(output).toContain("Over the last 7 days, demo had 1 recorded development session");
    expect(output).toContain('The latest session was "Auth rewrite"');
    expect(output).not.toContain("- Slug:");
  });

  it("prints an empty-window prose message", async () => {
    const workspace = new Workspace(root);
    workspace.init("demo");

    await expect(
      runWake({ days: 1, now: new Date("2026-05-20T10:00:00.000Z") }, root),
    ).resolves.toContain("There is no recorded Kairo activity for demo in the last 1 day.");
  });
});

describe("renderWakeBriefing", () => {
  it("renders a colleague-style paragraph from session evidence", () => {
    const briefing = renderWakeBriefing({
      projectName: "demo",
      days: 7,
      generatedAt: "2026-05-20T10:00:00.000Z",
      sessions: [
        session({
          title: "Auth rewrite",
          summary: "moved login state into the panel",
          themes: ["auth", "sessions"],
          files: ["apps/mcp/src/tools/search.ts"],
        }),
      ],
    });

    expect(briefing).toContain("Over the last 7 days");
    expect(briefing).toContain("auth and sessions");
    expect(briefing).not.toContain("\n- ");
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
