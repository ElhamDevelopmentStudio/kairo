import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitCommitEvent, Session, TerminalEvent } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { answerProjectMemory } from "./answer.ts";

let tmp: string;
let store: EventStore;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-memory-answer-"));
  store = new EventStore(join(tmp, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("answerProjectMemory", () => {
  it("answers from stored sessions and architecture shifts with citations", () => {
    store.appendSession(
      session({
        slug: "graphql-migration",
        title: "GraphQL migration",
        summary:
          "Switched the public API from REST controllers to GraphQL resolvers to reduce duplicate request shaping.",
        themes: ["api", "graphql"],
        affectedAreas: ["apps/api", "packages/shared"],
        files: ["apps/api/src/graphql/schema.ts", "apps/api/src/rest/users.ts"],
        commitShas: ["abc1234"],
      }),
    );
    store.appendArchitectureShift({
      id: "22222222-2222-4222-8222-222222222222",
      projectId: "demo",
      detectedAt: "2026-05-19T09:00:00.000Z",
      kind: "api_redesign",
      title: "REST to GraphQL API redesign",
      summary: "API boundary moved from REST routes to GraphQL schema and resolver modules.",
      affectedPaths: ["apps/api/src/graphql"],
      relatedSessionIds: ["11111111-1111-4111-8111-111111111111"],
    });

    const answer = answerProjectMemory(store, "demo", "Why did we switch from REST to GraphQL?");

    expect(answer.answer).toContain("GraphQL");
    expect(answer.answer).not.toContain("session:graphql-migration");
    expect(answer.answer).not.toContain("commit:abc1234");
    expect(answer.answer).not.toContain("file:apps/api/src/graphql/schema.ts");
    expect(answer.confidence).toBe("medium");
    expect(answer.citations).toEqual([
      expect.objectContaining({
        kind: "architecture_shift",
        title: "REST to GraphQL API redesign",
      }),
      expect.objectContaining({
        kind: "session",
        reference: "session:graphql-migration",
        eventIds: [],
        files: ["apps/api/src/graphql/schema.ts", "apps/api/src/rest/users.ts"],
        commitShas: ["abc1234"],
      }),
    ]);
  });

  it("abstains when stored evidence does not match the question", () => {
    store.appendSession(
      session({
        title: "Dashboard polish",
        summary: "Adjusted dashboard spacing and chart labels.",
      }),
    );

    const answer = answerProjectMemory(store, "demo", "How did we fix payment CORS?");

    expect(answer.confidence).toBe("low");
    expect(answer.citations).toEqual([]);
    expect(answer.answer).toContain("does not have enough stored project evidence");
  });

  it("answers from real stored commit events before AI summaries exist", () => {
    store.append(
      commitEvent({
        message: "refactor: switch REST API to GraphQL resolvers because duplicate request shaping",
        files: [
          {
            path: "apps/api/src/graphql/schema.ts",
            status: "A",
            additions: 8,
            deletions: 0,
          },
          {
            path: "apps/api/src/rest/users.ts",
            status: "M",
            additions: 1,
            deletions: 12,
          },
        ],
      }),
    );

    const answer = answerProjectMemory(store, "demo", "Why did we switch from REST to GraphQL?");

    expect(answer.answer).toContain("GraphQL");
    expect(answer.answer).not.toContain("commit:abcdef123456");
    expect(answer.answer).not.toContain("event:33333333-3333-4333-8333-333333333333");
    expect(answer.answer).not.toContain("file:apps/api/src/graphql/schema.ts");
    expect(answer.confidence).toBe("medium");
    expect(answer.citations[0]).toMatchObject({
      kind: "commit",
      reference: "commit:abcdef123456",
      eventIds: ["33333333-3333-4333-8333-333333333333"],
      files: ["apps/api/src/graphql/schema.ts", "apps/api/src/rest/users.ts"],
      commitShas: ["abcdef1234567890"],
    });
  });

  it("answers decision questions from explicit ADR memories", () => {
    const answer = answerProjectMemory(store, "demo", "Why use a local API boundary?", {
      decisionMemories: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          projectId: "demo",
          title: "Web Data Source",
          source: "adr",
          reference: "adr:docs/decisions/0001-web-data-source.md",
          summary: "Kairo v1 will use an in-process local API for the web dashboard.",
          rationale: "SQLite ownership stays in @kairo/core.",
          inferred: false,
          occurredAt: "2026-05-20T00:00:00.000Z",
          consequences: ["apps/web remains static"],
          files: ["apps/cli/src/commands/serve.ts"],
          relatedShiftIds: [],
        },
      ],
    });

    expect(answer.answer).toContain("decision memory");
    expect(answer.answer).not.toContain("adr:docs/decisions/0001-web-data-source.md");
    expect(answer.answer).toContain("SQLite ownership stays in @kairo/core");
    expect(answer.citations[0]).toMatchObject({
      kind: "decision",
      reference: "adr:docs/decisions/0001-web-data-source.md",
      files: ["apps/cli/src/commands/serve.ts"],
    });
  });

  it("labels architecture-shift decision answers as inference", () => {
    const answer = answerProjectMemory(store, "demo", "Why did dashboard architecture split?", {
      decisionMemories: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          projectId: "demo",
          title: "Dashboard boundary split",
          source: "architecture_shift",
          reference: "architecture:33333333-3333-4333-8333-333333333333",
          summary: "Dashboard visualization moved behind an optional frontend boundary.",
          inferred: true,
          occurredAt: "2026-05-20T09:00:00.000Z",
          consequences: [],
          files: ["apps/web/src", "apps/cli/src"],
          relatedShiftIds: ["33333333-3333-4333-8333-333333333333"],
        },
      ],
    });

    expect(answer.answer).toContain("Inference from architecture shift");
    expect(answer.citations[0]).toMatchObject({
      kind: "decision",
      reference: "architecture:33333333-3333-4333-8333-333333333333",
    });
  });

  it("explains superseded stale decisions without exposing citation mechanics", () => {
    const answer = answerProjectMemory(
      store,
      "demo",
      "what superseded direct sqlite dashboard reads?",
      {
        decisionMemories: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            projectId: "demo",
            title: "Use direct SQLite dashboard reads",
            source: "adr",
            reference: "adr:docs/decisions/0001-dashboard-storage.md",
            summary: "The dashboard reads SQLite directly.",
            inferred: false,
            occurredAt: "2026-05-18T10:00:00.000Z",
            consequences: [],
            files: ["apps/web/src/app.tsx"],
            relatedShiftIds: [],
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            projectId: "demo",
            title: "Use local API dashboard reads",
            source: "adr",
            reference: "adr:docs/decisions/0002-dashboard-storage.md",
            summary:
              "The dashboard reads through the local API. This supersedes direct SQLite dashboard reads.",
            inferred: false,
            occurredAt: "2026-05-21T10:00:00.000Z",
            consequences: [],
            files: ["apps/web/src/app.tsx"],
            relatedShiftIds: [],
          },
        ],
      },
    );

    expect(answer.answer).toContain("Use direct SQLite dashboard reads used to be true");
    expect(answer.answer).toContain("superseded by Use local API dashboard reads");
    expect(answer.answer).not.toContain("relationship:");
    expect(answer.citations[0]).toMatchObject({
      kind: "relationship",
      title: "Use local API dashboard reads supersedes Use direct SQLite dashboard reads",
    });
  });

  it("recalls how a previously observed terminal error was fixed", () => {
    const terminal = terminalEvent({
      stderr: "AN_ERROR: Cannot find module @kairo/shared/problem",
      exitCode: 1,
    });
    const fix = commitEvent({
      message: "fix: resolve AN_ERROR by exporting problem memory schema",
      files: [
        {
          path: "packages/shared/src/problem.ts",
          status: "A",
          additions: 12,
          deletions: 0,
        },
      ],
    });
    store.append(terminal);
    store.append(fix);
    store.appendSession(
      session({
        title: "Fix problem memory schema export",
        slug: "fix-problem-memory-schema-export",
        summary: "Exported the problem memory schema so imports resolve.",
        files: ["packages/shared/src/problem.ts"],
        commitShas: [fix.payload.sha],
        eventIds: [terminal.id, fix.id],
      }),
    );

    const answer = answerProjectMemory(store, "demo", "we fixed AN_ERROR before, how?");

    expect(answer.answer).toContain("seen this problem before");
    expect(answer.answer).not.toContain("problem:an_error");
    expect(answer.answer).not.toContain("event:44444444-4444-4444-8444-444444444444");
    expect(answer.answer).toContain("Exported the problem memory schema");
    expect(answer.confidence).toBe("high");
    expect(answer.citations[0]).toMatchObject({
      kind: "problem",
      files: ["packages/shared/src/problem.ts"],
      commitShas: [fix.payload.sha],
      eventIds: [terminal.id, fix.id],
    });
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
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

function commitEvent(overrides: Partial<GitCommitEvent["payload"]> = {}): GitCommitEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "demo",
    occurredAt: "2026-05-20T09:00:00.000Z",
    observedAt: "2026-05-20T09:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abcdef1234567890",
      parentShas: [],
      author: "Kairo Smoke <kairo-smoke@example.com>",
      message: "feat: add project memory",
      branch: "main",
      files: [],
      ...overrides,
    },
  };
}

function terminalEvent(overrides: Partial<TerminalEvent["payload"]> = {}): TerminalEvent {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "demo",
    occurredAt: "2026-05-20T08:55:00.000Z",
    observedAt: "2026-05-20T08:55:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      ...overrides,
    },
  };
}
