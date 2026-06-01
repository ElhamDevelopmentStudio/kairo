import type { ArchitectureShift, KairoEvent, Session } from "@kairohq/shared";
import { describe, expect, it } from "vitest";
import { extractDecisionMemories } from "./decisions.ts";
import { rebuildMemoryRecords } from "./records.ts";

describe("rebuildMemoryRecords", () => {
  it("rebuilds first-class records from raw evidence without losing citation anchors", () => {
    const events: KairoEvent[] = [terminalEvent(), commitEvent(), agentEvent()];
    const sessions = [
      session({
        eventIds: events.map((event) => event.id),
        commitShas: ["abc123def456"],
        files: ["packages/shared/src/index.ts"],
        summary: "Exported the missing schema and documented the API boundary.",
      }),
    ];
    const architectureShifts = [architectureShift()];
    const decisions = extractDecisionMemories({
      projectId: "demo",
      architectureShifts,
    });

    const records = rebuildMemoryRecords({
      projectId: "demo",
      sessions,
      events,
      architectureShifts,
      decisionMemories: decisions,
      now: "2026-05-19T10:00:00.000Z",
    });

    expect(records.map((record) => record.memoryKind)).toEqual(
      expect.arrayContaining([
        "session",
        "decision",
        "problem",
        "fix",
        "architecture_shift",
        "symbol",
        "agent_run",
      ]),
    );
    expect(
      records.flatMap((record) => record.evidence).map((evidence) => evidence.reference),
    ).toEqual(
      expect.arrayContaining([
        "session:fix-shared-export",
        "commit:abc123def456",
        "event:11111111-1111-4111-8111-111111111111",
        "architecture:44444444-4444-4444-8444-444444444444",
        "file:packages/shared/src/index.ts",
      ]),
    );
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: "demo",
    title: "Fix shared export",
    slug: "fix-shared-export",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T10:15:00.000Z",
    intent: "bugfix",
    themes: ["shared"],
    affectedAreas: ["packages/shared"],
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
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 1,
      stderr: "Error: Cannot find module @kairohq/shared/problem",
    },
  };
}

function commitEvent(): KairoEvent {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: "demo",
    occurredAt: "2026-05-18T10:05:00.000Z",
    observedAt: "2026-05-18T10:05:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123def456",
      parentShas: [],
      author: "Ada",
      message: "fix: export shared problem schema",
      files: [
        {
          path: "packages/shared/src/index.ts",
          status: "M",
          additions: 1,
          deletions: 0,
        },
      ],
    },
  };
}

function agentEvent(): KairoEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "demo",
    occurredAt: "2026-05-18T10:07:00.000Z",
    observedAt: "2026-05-18T10:07:01.000Z",
    source: "ai",
    kind: "ai.activity",
    payload: {
      tool: "codex",
      sessionRef: "run-1",
      summary: "Inspected and fixed shared exports.",
      filesTouched: ["packages/shared/src/index.ts"],
    },
  };
}

function architectureShift(): ArchitectureShift {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "demo",
    detectedAt: "2026-05-18T10:10:00.000Z",
    kind: "api_redesign",
    title: "Shared schema boundary",
    summary: "Shared schemas became the boundary for memory records.",
    affectedPaths: ["packages/shared/src"],
    relatedSessionIds: ["55555555-5555-4555-8555-555555555555"],
  };
}
