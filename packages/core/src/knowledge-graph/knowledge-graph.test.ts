import type { DecisionMemory, GitCommitEvent, Session, TerminalEvent } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph, queryKnowledgeGraph } from "./knowledge-graph.ts";

describe("buildKnowledgeGraph", () => {
  it("keeps rename relationships time-correct for as-of queries", () => {
    const graph = buildKnowledgeGraph({
      projectId: "demo",
      sessions: [],
      events: [
        commitEvent({
          occurredAt: "2026-05-21T10:00:00.000Z",
          payload: {
            files: [
              {
                path: "apps/web/src/features/dashboard/dashboard-page.tsx",
                renamedFrom: "apps/web/src/features/dashboard/dashboard.tsx",
                status: "R",
                additions: 4,
                deletions: 2,
              },
            ],
          },
        }),
      ],
    });

    expect(queryKnowledgeGraph(graph, { asOf: "2026-05-20T10:00:00.000Z" }).relationships).toEqual(
      [],
    );
    expect(queryKnowledgeGraph(graph, { asOf: "2026-05-22T10:00:00.000Z" }).relationships).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "renamed_from" })]),
    );
  });

  it("uses non-empty names for directory-like file paths", () => {
    const graph = buildKnowledgeGraph({
      projectId: "demo",
      sessions: [
        session({
          files: ["apps/", "packages/core/src/"],
        }),
      ],
      events: [],
    });

    expect(graph.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalRef: "file:apps/", name: "apps" }),
        expect.objectContaining({ canonicalRef: "file:packages/core/src/", name: "src" }),
      ]),
    );
  });

  it("models superseded decisions from overlapping source files", () => {
    const graph = buildKnowledgeGraph({
      projectId: "demo",
      sessions: [],
      events: [],
      decisionMemories: [
        decision({
          id: "11111111-1111-4111-8111-111111111111",
          title: "Use direct SQLite dashboard reads",
          reference: "adr:docs/decisions/0001-dashboard-storage.md",
          occurredAt: "2026-05-18T10:00:00.000Z",
          files: ["apps/web/src/app.tsx"],
        }),
        decision({
          id: "22222222-2222-4222-8222-222222222222",
          title: "Use local API dashboard reads",
          reference: "adr:docs/decisions/0002-dashboard-storage.md",
          occurredAt: "2026-05-21T10:00:00.000Z",
          files: ["apps/web/src/app.tsx"],
        }),
      ],
    });

    const supersedes = graph.relationships.find(
      (relationship) => relationship.kind === "supersedes",
    );

    expect(supersedes).toMatchObject({
      validFrom: "2026-05-21T10:00:00.000Z",
      confidence: "medium",
      tags: expect.arrayContaining(["inferred"]),
    });
    expect(
      queryKnowledgeGraph(graph, { asOf: "2026-05-20T10:00:00.000Z" }).relationships,
    ).not.toContainEqual(expect.objectContaining({ kind: "supersedes" }));
  });

  it("connects fixes back to the error they resolved", () => {
    const terminal = terminalEvent();
    const commit = commitEvent({
      payload: {
        message: "fix: export problem memory schema",
        files: [
          {
            path: "packages/shared/src/problem.ts",
            status: "M",
            additions: 1,
            deletions: 0,
          },
        ],
      },
    });
    const graph = buildKnowledgeGraph({
      projectId: "demo",
      sessions: [
        session({
          eventIds: [terminal.id, commit.id],
          commitShas: [commit.payload.sha],
          files: ["packages/shared/src/problem.ts"],
          summary: "Exported the problem memory schema so imports resolve.",
        }),
      ],
      events: [terminal, commit],
    });

    expect(graph.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "fixes",
          confidence: "high",
        }),
      ]),
    );
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: "demo",
    title: "Fix problem schema",
    slug: "fix-problem-schema",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T10:10:00.000Z",
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

function decision(overrides: Partial<DecisionMemory> = {}): DecisionMemory {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
    memoryKind: "decision",
    title: "Decision",
    summary: "Decision summary.",
    confidence: "high",
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:00:00.000Z",
    evidence: [{ kind: "adr", reference: "adr:docs/decisions/0001.md" }],
    tags: ["decision"],
    source: "adr",
    reference: "adr:docs/decisions/0001.md",
    inferred: false,
    occurredAt: "2026-05-18T10:00:00.000Z",
    consequences: [],
    files: [],
    relatedShiftIds: [],
    ...overrides,
  };
}

function terminalEvent(): TerminalEvent {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    projectId: "demo",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 1,
      stderr: "AN_ERROR: Cannot find module @kairo/shared/problem",
    },
  };
}

function commitEvent(overrides: Partial<GitCommitEvent> = {}): GitCommitEvent {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    projectId: "demo",
    occurredAt: "2026-05-18T10:05:00.000Z",
    observedAt: "2026-05-18T10:05:01.000Z",
    source: "git",
    kind: "git.commit",
    ...overrides,
    payload: {
      sha: overrides.payload?.sha ?? "abc123def4567890",
      parentShas: overrides.payload?.parentShas ?? [],
      author: overrides.payload?.author ?? "Ada",
      message: overrides.payload?.message ?? "feat: update project memory",
      files: overrides.payload?.files ?? [],
      ...(overrides.payload?.branch === undefined ? {} : { branch: overrides.payload.branch }),
    },
  };
}
