import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GitCommitEvent, Session } from "@kairo/shared";
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
    expect(answer.confidence).toBe("medium");
    expect(answer.citations).toEqual([
      expect.objectContaining({
        kind: "session",
        reference: "session:graphql-migration",
        files: ["apps/api/src/graphql/schema.ts", "apps/api/src/rest/users.ts"],
        commitShas: ["abc1234"],
      }),
      expect.objectContaining({
        kind: "architecture_shift",
        title: "REST to GraphQL API redesign",
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
    expect(answer.confidence).toBe("medium");
    expect(answer.citations[0]).toMatchObject({
      kind: "commit",
      reference: "commit:abcdef123456",
      files: ["apps/api/src/graphql/schema.ts", "apps/api/src/rest/users.ts"],
      commitShas: ["abcdef1234567890"],
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
