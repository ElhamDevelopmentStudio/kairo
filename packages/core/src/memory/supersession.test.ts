import type { DecisionMemory, GitCommitEvent, KairoEvent, Session } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { buildKnowledgeGraph } from "../knowledge-graph/index.ts";
import { extractSupersessionMemories } from "./supersession.ts";

describe("extractSupersessionMemories", () => {
  it("extracts explicit and inferred supersession for project facts and conventions", () => {
    const memories = extractSupersessionMemories({
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
          summary: "Use local API dashboard reads. This supersedes direct SQLite dashboard reads.",
          occurredAt: "2026-05-21T10:00:00.000Z",
          files: ["apps/web/src/app.tsx"],
        }),
        decision({
          id: "33333333-3333-4333-8333-333333333333",
          title: "Setup command uses npm install",
          reference: "adr:docs/decisions/0003-setup.md",
          occurredAt: "2026-05-22T10:00:00.000Z",
          files: ["README.md"],
        }),
        decision({
          id: "44444444-4444-4444-8444-444444444444",
          title: "Setup command uses pnpm install",
          reference: "adr:docs/decisions/0004-setup.md",
          occurredAt: "2026-05-23T10:00:00.000Z",
          files: ["README.md"],
        }),
        decision({
          id: "55555555-5555-4555-8555-555555555555",
          title: "Use OPENAI_API_KEY for answers",
          reference: "adr:docs/decisions/0005-env.md",
          occurredAt: "2026-05-24T10:00:00.000Z",
          files: [".env.example"],
        }),
        decision({
          id: "66666666-6666-4666-8666-666666666666",
          title: "Use KAIRO_AI_API_KEY for answers",
          reference: "adr:docs/decisions/0006-env.md",
          occurredAt: "2026-05-25T10:00:00.000Z",
          files: [".env.example"],
        }),
        decision({
          id: "77777777-7777-4777-8777-777777777777",
          title: "Use lodash for path normalization",
          reference: "adr:docs/decisions/0007-package.md",
          occurredAt: "2026-05-26T10:00:00.000Z",
          files: ["package.json"],
        }),
        decision({
          id: "88888888-8888-4888-8888-888888888888",
          title: "Use node:path for path normalization",
          reference: "adr:docs/decisions/0008-package.md",
          occurredAt: "2026-05-27T10:00:00.000Z",
          files: ["package.json"],
        }),
        decision({
          id: "99999999-9999-4999-8999-999999999999",
          title: "Apps may own shared types locally",
          reference: "adr:docs/decisions/0009-conventions.md",
          occurredAt: "2026-05-28T10:00:00.000Z",
          files: ["AGENTS.md"],
        }),
        decision({
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Shared types live in packages/shared",
          reference: "adr:docs/decisions/0010-conventions.md",
          occurredAt: "2026-05-29T10:00:00.000Z",
          files: ["AGENTS.md"],
        }),
      ],
    });

    expect(memories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          olderTitle: "Use direct SQLite dashboard reads",
          newerTitle: "Use local API dashboard reads",
          source: "explicit",
          inferred: false,
        }),
        expect.objectContaining({
          olderTitle: "Setup command uses npm install",
          newerTitle: "Setup command uses pnpm install",
          source: "inferred",
          inferred: true,
        }),
        expect.objectContaining({
          olderTitle: "Use OPENAI_API_KEY for answers",
          newerTitle: "Use KAIRO_AI_API_KEY for answers",
        }),
        expect.objectContaining({
          olderTitle: "Use lodash for path normalization",
          newerTitle: "Use node:path for path normalization",
        }),
        expect.objectContaining({
          olderTitle: "Apps may own shared types locally",
          newerTitle: "Shared types live in packages/shared",
        }),
      ]),
    );
  });

  it("keeps renamed module facts traceable in the graph", () => {
    const graph = buildKnowledgeGraph({
      projectId: "demo",
      sessions: [],
      events: [
        commitEvent({
          files: [
            {
              path: "packages/core/src/project-model/project-model.ts",
              renamedFrom: "packages/core/src/project-model/model.ts",
              status: "R",
              additions: 10,
              deletions: 2,
            },
          ],
        }),
      ],
    });

    expect(graph.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "renamed_from",
          confidence: "high",
        }),
      ]),
    );
  });
});

function decision(overrides: Partial<DecisionMemory> = {}): DecisionMemory {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
    memoryKind: "decision",
    title: "Decision",
    source: "adr",
    reference: "adr:docs/decisions/0001.md",
    summary: "Decision summary.",
    confidence: "high",
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:00:00.000Z",
    evidence: [{ kind: "adr", reference: "adr:docs/decisions/0001.md" }],
    tags: ["decision"],
    inferred: false,
    occurredAt: "2026-05-18T10:00:00.000Z",
    consequences: [],
    files: [],
    relatedShiftIds: [],
    ...overrides,
  };
}

function commitEvent(overrides: Partial<GitCommitEvent["payload"]> = {}): KairoEvent {
  return {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    projectId: "demo",
    occurredAt: "2026-05-20T09:00:00.000Z",
    observedAt: "2026-05-20T09:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abcdef1234567890",
      parentShas: [],
      author: "Kairo Test <test@example.com>",
      message: "refactor: rename project model module",
      branch: "main",
      files: [],
      ...overrides,
    },
  };
}
