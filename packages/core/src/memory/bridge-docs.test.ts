import type { KairoEvent, Session } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { generateSessionBridgeDocuments } from "./bridge-docs.ts";

describe("generateSessionBridgeDocuments", () => {
  it("creates retrieval-only bridge docs mapped back to session evidence", () => {
    const docs = generateSessionBridgeDocuments({
      session: session({
        title: "Dashboard split",
        summary: "Separated visualization from the independent CLI listener.",
        architectureImpact: "Frontend visualization moved behind an optional boundary.",
        files: ["apps/web/src/app.tsx", "apps/cli/src/bin.ts"],
        commitShas: ["abc123"],
        eventIds: ["11111111-1111-4111-8111-111111111111"],
      }),
      events: [terminalEvent()],
    });

    expect(docs.map((doc) => doc.id)).toContain(
      "bridge:session:22222222-2222-4222-8222-222222222222:decisions",
    );
    expect(docs.every((doc) => doc.sourceKind === "session")).toBe(true);
    expect(docs.every((doc) => doc.sourceId === "22222222-2222-4222-8222-222222222222")).toBe(true);
    expect(docs.map((doc) => doc.text).join("\n")).toContain("decoupling");
    expect(docs.map((doc) => doc.text).join("\n")).toContain("typecheck");
    expect(docs.flatMap((doc) => doc.files)).toContain("apps/web/src/app.tsx");
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: "demo",
    title: "Session",
    slug: "session",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T11:00:00.000Z",
    intent: "refactor",
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

function terminalEvent(): KairoEvent {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
    occurredAt: "2026-05-18T10:03:00.000Z",
    observedAt: "2026-05-18T10:03:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 0,
    },
  };
}
