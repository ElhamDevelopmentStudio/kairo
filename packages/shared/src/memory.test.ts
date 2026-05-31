import { describe, expect, it } from "vitest";
import {
  AgentRunMemory,
  ArchitectureShiftMemory,
  DecisionMemory,
  FixMemory,
  ProblemMemory,
  SessionMemory,
  StoredMemoryRecord,
  SymbolMemory,
} from "./memory.ts";

describe("memory record schemas", () => {
  it("validates every first-class memory record with raw evidence anchors", () => {
    const records = [
      SessionMemory.parse({
        ...base("session"),
        sessionId: "11111111-1111-4111-8111-111111111111",
        slug: "api-boundary",
        startedAt: "2026-05-18T10:00:00.000Z",
        endedAt: null,
        files: ["apps/cli/src/commands/serve.ts"],
        commitShas: ["abc123"],
      }),
      DecisionMemory.parse({
        ...base("decision"),
        source: "adr",
        reference: "adr:docs/decisions/0001-web-data-source.md",
        inferred: false,
        occurredAt: "2026-05-18T10:00:00.000Z",
        path: "docs/decisions/0001-web-data-source.md",
      }),
      ProblemMemory.parse({
        ...base("problem"),
        errorSignature: "cannot find module",
        errorMessage: "Cannot find module @kairo/shared",
        command: "pnpm typecheck",
        cwd: "/repo",
        occurredAt: "2026-05-18T10:00:00.000Z",
        status: "fixed",
        files: ["packages/shared/src/index.ts"],
        eventIds: ["22222222-2222-4222-8222-222222222222"],
      }),
      FixMemory.parse({
        ...base("fix"),
        fixedAt: "2026-05-18T10:05:00.000Z",
        files: ["packages/shared/src/index.ts"],
        commitShas: ["abc123"],
        eventIds: ["22222222-2222-4222-8222-222222222222"],
      }),
      ArchitectureShiftMemory.parse({
        ...base("architecture_shift"),
        shiftId: "33333333-3333-4333-8333-333333333333",
        detectedAt: "2026-05-18T10:10:00.000Z",
        shiftKind: "api_redesign",
        affectedPaths: ["apps/cli/src/commands/serve.ts"],
      }),
      SymbolMemory.parse({
        ...base("symbol"),
        symbolName: "apps/cli/src/commands/serve.ts",
        symbolKind: "module",
        files: ["apps/cli/src/commands/serve.ts"],
      }),
      AgentRunMemory.parse({
        ...base("agent_run"),
        agent: "codex",
        runRef: "run-1",
        files: ["packages/core/src/memory/answer.ts"],
        eventIds: ["44444444-4444-4444-8444-444444444444"],
      }),
    ];

    expect(records.map((record) => StoredMemoryRecord.parse(record).memoryKind)).toEqual([
      "session",
      "decision",
      "problem",
      "fix",
      "architecture_shift",
      "symbol",
      "agent_run",
    ]);
    expect(records.every((record) => record.evidence.length > 0)).toBe(true);
  });
});

function base(memoryKind: string) {
  return {
    id: ids[memoryKind] ?? "99999999-9999-4999-8999-999999999999",
    projectId: "demo",
    memoryKind,
    title: `${memoryKind} memory`,
    summary: `${memoryKind} summary`,
    confidence: "medium",
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:00:00.000Z",
    evidence: [{ kind: "event", reference: "event:11111111-1111-4111-8111-111111111111" }],
    tags: [memoryKind],
  };
}

const ids: Record<string, string> = {
  session: "11111111-1111-4111-8111-111111111111",
  decision: "22222222-2222-4222-8222-222222222222",
  problem: "33333333-3333-4333-8333-333333333333",
  fix: "44444444-4444-4444-8444-444444444444",
  architecture_shift: "55555555-5555-4555-8555-555555555555",
  symbol: "66666666-6666-4666-8666-666666666666",
  agent_run: "77777777-7777-4777-8777-777777777777",
};
