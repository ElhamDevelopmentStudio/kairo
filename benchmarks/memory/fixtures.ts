import type { EventStore, MemoryBenchmarkCase } from "../../packages/core/src/index.ts";
import type {
  DecisionMemory,
  GitCommitEvent,
  KairoEvent,
  Session,
} from "../../packages/shared/src/index.ts";

export const MEMORY_BENCHMARK_PROJECT_ID = "memory-benchmark";

export const memoryBenchmarkCases: MemoryBenchmarkCase[] = [
  {
    id: "architecture-dashboard-service-boundary",
    category: "architecture-why",
    question: "why did we split the dashboard from the local listener service?",
    expectedReferences: ["architecture:11111111-1111-4111-8111-111111111111"],
  },
  {
    id: "problem-an-error-fix",
    category: "problem-fix",
    question: "we fixed AN_ERROR before, how?",
    expectedReferences: ["problem:an_error: cannot find module @kairohq<path>"],
  },
  {
    id: "temporal-before-dashboard-split",
    category: "temporal",
    question: "what happened before the dashboard split?",
    expectedReferences: ["session:prepare-dashboard-contracts"],
  },
  {
    id: "renamed-dashboard-file",
    category: "renamed-file",
    question: "what happened to apps/web/src/features/dashboard/dashboard.tsx?",
    expectedReferences: ["event:44444444-4444-4444-8444-444444444444"],
  },
  {
    id: "exact-error-string",
    category: "exact-error",
    question: "where did MODULE_NOT_FOUND @kairohq/shared/problem happen?",
    expectedReferences: ["problem:module_not_found @kairohq<path>"],
  },
  {
    id: "agent-transcript-source-adapter",
    category: "agent-transcript",
    question: "what did codex say about dashboard-free source adapters?",
    expectedReferences: ["event:66666666-6666-4666-8666-666666666666"],
  },
  {
    id: "decision-local-api-dashboard-reads",
    category: "decision-citation",
    question: "why use local API dashboard reads?",
    expectedReferences: ["adr:docs/decisions/0002-dashboard-storage.md"],
    rerankReferences: ["adr:docs/decisions/0002-dashboard-storage.md"],
  },
  {
    id: "unsupported-payment-gateway",
    category: "unsupported",
    question: "which payment gateway did Kairo use in 2019?",
    expectedReferences: [],
    unsupported: true,
  },
];

export const memoryBenchmarkDecisions: DecisionMemory[] = [
  {
    id: "77777777-7777-4777-8777-777777777777",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    memoryKind: "decision",
    title: "Use local API dashboard reads",
    summary:
      "The dashboard reads project memory through the local CLI API instead of direct SQLite.",
    confidence: "high",
    createdAt: "2026-05-21T10:00:00.000Z",
    updatedAt: "2026-05-21T10:00:00.000Z",
    evidence: [
      {
        kind: "adr",
        reference: "adr:docs/decisions/0002-dashboard-storage.md",
        id: "docs/decisions/0002-dashboard-storage.md",
        title: "Use local API dashboard reads",
      },
    ],
    tags: ["decision", "dashboard", "storage"],
    source: "adr",
    reference: "adr:docs/decisions/0002-dashboard-storage.md",
    inferred: false,
    occurredAt: "2026-05-21T10:00:00.000Z",
    rationale: "SQLite ownership stays inside @kairohq/core and the CLI service boundary.",
    consequences: ["The web surface can stay optional and dashboard-free projects still work."],
    files: ["apps/cli/src/commands/serve.ts", "apps/web/src/features/dashboard/dashboard-page.tsx"],
    relatedShiftIds: ["11111111-1111-4111-8111-111111111111"],
  },
];

export function seedMemoryBenchmarkStore(store: EventStore): void {
  store.appendSession(
    session({
      id: "22222222-2222-4222-8222-222222222222",
      slug: "prepare-dashboard-contracts",
      title: "Prepare dashboard contracts",
      startedAt: "2026-05-18T09:00:00.000Z",
      summary: "Prepared dashboard API contracts before the dashboard split.",
      files: ["apps/web/src/features/dashboard/dashboard-page.tsx"],
    }),
  );
  store.appendSession(
    session({
      id: "33333333-3333-4333-8333-333333333333",
      slug: "dashboard-split",
      title: "Dashboard split",
      startedAt: "2026-05-20T09:00:00.000Z",
      summary: "Split the optional dashboard from the local listener and watcher service.",
      architectureImpact: "The CLI can run without any frontend layer.",
      files: ["apps/cli/src/bin.ts", "apps/web/src/app.tsx"],
    }),
  );
  store.appendArchitectureShift({
    id: "11111111-1111-4111-8111-111111111111",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "Dashboard service boundary",
    summary:
      "The dashboard was separated from the local listener service so Kairo can operate without a frontend.",
    affectedPaths: ["apps/cli/src", "apps/web/src"],
    relatedSessionIds: ["33333333-3333-4333-8333-333333333333"],
  });
  store.append(renameEvent());
  store.append(
    errorEvent(
      "55555555-5555-4555-8555-555555555555",
      "AN_ERROR: Cannot find module @kairohq/shared/problem",
    ),
  );
  store.append(
    errorEvent("88888888-8888-4888-8888-888888888888", "MODULE_NOT_FOUND @kairohq/shared/problem"),
  );
  store.append(fixCommit());
  store.append(agentEvent());
}

function session(overrides: Partial<Session>): Session {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
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

function renameEvent(): KairoEvent {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    occurredAt: "2026-05-21T09:00:00.000Z",
    observedAt: "2026-05-21T09:00:01.000Z",
    source: "fs",
    kind: "fs.change",
    payload: {
      path: "apps/web/src/features/dashboard/dashboard-page.tsx",
      renamedFrom: "apps/web/src/features/dashboard/dashboard.tsx",
      op: "rename",
    },
  };
}

function errorEvent(id: string, stderr: string): KairoEvent {
  return {
    id,
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    occurredAt: "2026-05-22T09:00:00.000Z",
    observedAt: "2026-05-22T09:00:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 1,
      stderr,
    },
  };
}

function fixCommit(): GitCommitEvent {
  return {
    id: "99999999-9999-4999-8999-999999999999",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    occurredAt: "2026-05-22T09:05:00.000Z",
    observedAt: "2026-05-22T09:05:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abcdef1234567890",
      parentShas: [],
      author: "Kairo Benchmark <benchmark@example.com>",
      message: "fix: export problem memory schema for AN_ERROR",
      branch: "main",
      files: [
        {
          path: "packages/shared/src/problem.ts",
          status: "A",
          additions: 12,
          deletions: 0,
        },
      ],
    },
  };
}

function agentEvent(): KairoEvent {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    projectId: MEMORY_BENCHMARK_PROJECT_ID,
    occurredAt: "2026-05-23T09:00:00.000Z",
    observedAt: "2026-05-23T09:00:01.000Z",
    source: "ai",
    kind: "ai.activity",
    payload: {
      tool: "codex",
      sessionRef: "source-adapters",
      summary: "Codex noted that source adapters should work in dashboard-free local projects.",
      filesTouched: ["packages/core/src/sources/adapters.ts"],
    },
  };
}
