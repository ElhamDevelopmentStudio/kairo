import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  ArchitectureShift,
  DecisionMemory,
  FileChangeEvent,
  GitCommitEvent,
  Session,
  TerminalEvent,
} from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { retrieveMemoryCandidates } from "./retrieval.ts";

let tmp: string;
let store: EventStore;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-memory-retrieval-"));
  store = new EventStore(join(tmp, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("retrieveMemoryCandidates", () => {
  it("uses temporal anchors for questions about work before a split", () => {
    store.appendSession(
      session({
        id: "11111111-1111-4111-8111-111111111111",
        slug: "prepare-dashboard-api-contracts",
        title: "Prepare dashboard API contracts",
        startedAt: "2026-05-18T09:00:00.000Z",
        summary: "Prepared dashboard routes and API contracts ahead of the frontend separation.",
        files: ["apps/web/src/features/dashboard/dashboard-page.tsx"],
      }),
    );
    store.appendSession(
      session({
        id: "22222222-2222-4222-8222-222222222222",
        slug: "dashboard-split",
        title: "Dashboard split",
        startedAt: "2026-05-20T09:00:00.000Z",
        summary: "Split dashboard visualization from the independent CLI service.",
        architectureImpact: "Separated frontend visualization from local listener and watcher.",
        files: ["apps/web/src/app.tsx", "apps/cli/src/bin.ts"],
      }),
    );
    store.appendSession(
      session({
        id: "33333333-3333-4333-8333-333333333333",
        slug: "dashboard-empty-state-polish",
        title: "Dashboard empty state polish",
        startedAt: "2026-05-25T09:00:00.000Z",
        summary: "Polished dashboard empty states after the split.",
      }),
    );

    const [top] = retrieveMemoryCandidates(
      store,
      "demo",
      "what happened before the dashboard split?",
    );

    expect(top).toMatchObject({
      kind: "session",
      item: expect.objectContaining({ slug: "prepare-dashboard-api-contracts" }),
    });
  });

  it("uses recency for last-week questions instead of keyword score alone", () => {
    store.appendSession(
      session({
        id: "44444444-4444-4444-8444-444444444444",
        slug: "old-routing-change",
        title: "Routing change",
        startedAt: "2026-05-10T09:00:00.000Z",
        summary: "Changed routing rules for dashboard navigation.",
      }),
    );
    store.appendSession(
      session({
        id: "55555555-5555-4555-8555-555555555555",
        slug: "recent-memory-sweep",
        title: "Memory sweep",
        startedAt: "2026-05-28T09:00:00.000Z",
        summary: "Captured recent project context and updated session memory.",
      }),
    );

    const [top] = retrieveMemoryCandidates(store, "demo", "what changed last week?", {
      now: "2026-05-31T12:00:00.000Z",
    });

    expect(top).toMatchObject({
      kind: "session",
      item: expect.objectContaining({ slug: "recent-memory-sweep" }),
    });
  });

  it("promotes architecture shifts for architecture why questions", () => {
    store.appendSession(
      session({
        id: "66666666-6666-4666-8666-666666666666",
        slug: "dashboard-routing-notes",
        title: "Dashboard routing notes",
        summary: "Mentioned dashboard split routing details.",
      }),
    );
    store.appendArchitectureShift(
      architectureShift({
        id: "77777777-7777-4777-8777-777777777777",
        title: "Dashboard routing split",
        summary:
          "Dashboard routes moved behind a separate visualization boundary so the CLI can remain independent.",
        affectedPaths: ["apps/web/src/features/dashboard", "apps/cli/src"],
      }),
    );

    const [top] = retrieveMemoryCandidates(
      store,
      "demo",
      "why did the dashboard architecture split?",
    );

    expect(top).toMatchObject({
      kind: "architecture_shift",
      item: expect.objectContaining({ title: "Dashboard routing split" }),
    });
  });

  it("promotes explicit decision memories over inferred architecture shifts", () => {
    store.appendArchitectureShift(
      architectureShift({
        id: "77777777-7777-4777-8777-777777777777",
        title: "Dashboard API boundary",
        summary: "Dashboard data moved behind a local API boundary.",
        affectedPaths: ["apps/cli/src/commands/serve.ts"],
      }),
    );

    const [top] = retrieveMemoryCandidates(store, "demo", "why use a local API boundary?", {
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
          consequences: [],
          files: ["apps/cli/src/commands/serve.ts"],
          relatedShiftIds: [],
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          projectId: "demo",
          title: "Dashboard API boundary",
          source: "architecture_shift",
          reference: "architecture:77777777-7777-4777-8777-777777777777",
          summary: "Dashboard data moved behind a local API boundary.",
          inferred: true,
          occurredAt: "2026-05-20T09:00:00.000Z",
          consequences: [],
          files: ["apps/cli/src/commands/serve.ts"],
          relatedShiftIds: ["77777777-7777-4777-8777-777777777777"],
        },
      ],
    });

    expect(top).toMatchObject({
      kind: "decision",
      item: expect.objectContaining({
        source: "adr",
        reference: "adr:docs/decisions/0001-web-data-source.md",
      }),
    });
  });

  it("promotes recurring problem memories over raw keyword matches", () => {
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
        id: "88888888-8888-4888-8888-888888888888",
        slug: "fix-problem-memory-schema-export",
        title: "Fix problem memory schema export",
        startedAt: "2026-05-20T09:05:00.000Z",
        summary: "Exported the problem memory schema so imports resolve.",
        files: ["packages/shared/src/problem.ts"],
        commitShas: [fix.payload.sha],
        eventIds: [terminal.id, fix.id],
      }),
    );

    const [top] = retrieveMemoryCandidates(store, "demo", "we fixed AN_ERROR before, how?");

    expect(top).toMatchObject({
      kind: "problem",
      item: expect.objectContaining({
        errorSignature: "an_error: cannot find module @kairo<path>",
        files: ["packages/shared/src/problem.ts"],
        confidence: "high",
      }),
    });
  });

  it("uses path and renamed-file terms as ranking anchors", () => {
    store.appendSession(
      session({
        id: "99999999-9999-4999-8999-999999999999",
        slug: "app-shell-routing",
        title: "App shell routing",
        summary: "Updated routing behavior for the React app shell.",
        files: ["apps/web/src/app.tsx"],
      }),
    );
    store.append(
      fileChangeEvent({
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        payload: {
          path: "apps/web/src/features/dashboard/dashboard-page.tsx",
          renamedFrom: "apps/web/src/features/dashboard/dashboard.tsx",
          op: "rename",
        },
      }),
    );

    const [pathTop] = retrieveMemoryCandidates(store, "demo", "apps/web/src/app.tsx routing");
    const [renameTop] = retrieveMemoryCandidates(
      store,
      "demo",
      "what happened to apps/web/src/features/dashboard/dashboard.tsx?",
    );

    expect(pathTop).toMatchObject({
      kind: "session",
      item: expect.objectContaining({ slug: "app-shell-routing" }),
    });
    expect(renameTop).toMatchObject({
      kind: "event",
      item: expect.objectContaining({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
    });
  });

  it("allows semantic session scores to lift synonym matches", () => {
    store.appendSession(
      session({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        slug: "queue-ranking",
        title: "Adaptive queue ranking",
        summary: "Adjusted urgency and confidence weights.",
      }),
    );
    store.appendSession(
      session({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        slug: "checkpoint-resume",
        title: "Checkpoint resume",
        summary: "Persisted agent run checkpoints for restoration after interruption.",
      }),
    );

    const [top] = retrieveMemoryCandidates(store, "demo", "state restore", {
      semanticSessionScores: new Map([["cccccccc-cccc-4ccc-8ccc-cccccccccccc", 0.95]]),
    });

    expect(top).toMatchObject({
      kind: "session",
      item: expect.objectContaining({ slug: "checkpoint-resume" }),
    });
  });

  it("uses bridge documents to retrieve sessions through different wording", () => {
    store.appendSession(
      session({
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        slug: "cli-frontend-boundary",
        title: "Kairo service separation",
        summary: "Listener and watcher can run without the optional web surface.",
        architectureImpact: "Visualization moved behind an installable frontend boundary.",
        files: ["apps/cli/src/bin.ts", "apps/web/src/app.tsx"],
      }),
    );

    const [top] = retrieveMemoryCandidates(
      store,
      "demo",
      "why did we decouple the ui visualization from the local service?",
    );

    expect(top).toMatchObject({
      kind: "session",
      item: expect.objectContaining({ slug: "cli-frontend-boundary" }),
    });
  });

  it("uses relationship graph facts for supersession questions", () => {
    const [top] = retrieveMemoryCandidates(
      store,
      "demo",
      "what superseded direct sqlite dashboard reads?",
      {
        decisionMemories: [
          decisionMemory({
            id: "11111111-1111-4111-8111-111111111111",
            title: "Use direct SQLite dashboard reads",
            reference: "adr:docs/decisions/0001-dashboard-storage.md",
            occurredAt: "2026-05-18T10:00:00.000Z",
            files: ["apps/web/src/app.tsx"],
          }),
          decisionMemory({
            id: "22222222-2222-4222-8222-222222222222",
            title: "Use local API dashboard reads",
            reference: "adr:docs/decisions/0002-dashboard-storage.md",
            occurredAt: "2026-05-21T10:00:00.000Z",
            files: ["apps/web/src/app.tsx"],
          }),
        ],
      },
    );

    expect(top).toMatchObject({
      kind: "relationship",
      item: {
        relationship: expect.objectContaining({ kind: "supersedes" }),
        from: expect.objectContaining({ name: "Use local API dashboard reads" }),
        to: expect.objectContaining({ name: "Use direct SQLite dashboard reads" }),
      },
    });
  });
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "00000000-0000-4000-8000-000000000001",
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

function architectureShift(overrides: Partial<ArchitectureShift> = {}): ArchitectureShift {
  return {
    id: "00000000-0000-4000-8000-000000000002",
    projectId: "demo",
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "Architecture shift",
    summary: "Architecture shifted.",
    affectedPaths: [],
    relatedSessionIds: [],
    ...overrides,
  };
}

function terminalEvent(overrides: Partial<TerminalEvent["payload"]> = {}): TerminalEvent {
  return {
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
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

function commitEvent(overrides: Partial<GitCommitEvent["payload"]> = {}): GitCommitEvent {
  return {
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
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

function fileChangeEvent(overrides: Partial<FileChangeEvent> = {}): FileChangeEvent {
  return {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    projectId: "demo",
    occurredAt: "2026-05-21T09:00:00.000Z",
    observedAt: "2026-05-21T09:00:01.000Z",
    source: "fs",
    kind: "fs.change",
    payload: {
      path: "apps/web/src/app.tsx",
      op: "modify",
    },
    ...overrides,
  };
}

function decisionMemory(overrides: Partial<DecisionMemory> = {}): DecisionMemory {
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
