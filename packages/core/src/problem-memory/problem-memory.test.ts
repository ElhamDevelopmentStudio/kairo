import type { GitCommitEvent, Session, TerminalEvent } from "@kairohq/shared";
import { describe, expect, it } from "vitest";
import { extractProblemMemories } from "./problem-memory.ts";

describe("extractProblemMemories", () => {
  it("links a terminal error to the later fix commit and session", () => {
    const terminal = terminalEvent({
      stderr: "AN_ERROR: Cannot find module @kairohq/shared/problem",
      exitCode: 1,
    });
    const commit = commitEvent({
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
    const session: Session = {
      id: "33333333-3333-4333-8333-333333333333",
      projectId: "demo",
      title: "Fix problem memory schema export",
      slug: "fix-problem-memory-schema-export",
      startedAt: "2026-05-18T10:00:00.000Z",
      endedAt: "2026-05-18T10:20:00.000Z",
      intent: "fix terminal failure",
      themes: ["problem-memory"],
      affectedAreas: ["packages/shared"],
      commitShas: [commit.payload.sha],
      files: ["packages/shared/src/problem.ts"],
      summary: "Exported the problem memory schema so imports resolve.",
      architectureImpact: null,
      eventIds: [terminal.id, commit.id],
    };

    const [memory] = extractProblemMemories("demo", [terminal, commit], [session]);

    expect(memory).toMatchObject({
      projectId: "demo",
      errorMessage: "AN_ERROR: Cannot find module @kairohq/shared/problem",
      command: "pnpm typecheck",
      status: "fixed",
      fixSummary: "Exported the problem memory schema so imports resolve.",
      relatedSessionIds: [session.id],
      relatedCommitShas: [commit.payload.sha],
      files: ["packages/shared/src/problem.ts"],
      confidence: "high",
    });
  });
});

function terminalEvent(overrides: Partial<TerminalEvent["payload"]> = {}): TerminalEvent {
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
      ...overrides,
    },
  };
}

function commitEvent(overrides: Partial<GitCommitEvent["payload"]> = {}): GitCommitEvent {
  return {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: "demo",
    occurredAt: "2026-05-18T10:10:00.000Z",
    observedAt: "2026-05-18T10:10:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abcdef1234567890",
      parentShas: [],
      author: "Kairo Smoke <kairo-smoke@example.com>",
      message: "fix: resolve problem",
      branch: "main",
      files: [],
      ...overrides,
    },
  };
}
