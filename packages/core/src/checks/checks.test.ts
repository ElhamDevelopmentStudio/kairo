import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchitectureShift, Session, TerminalEvent } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { checkProjectMemory } from "./checks.ts";

let root: string;
let store: EventStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-checks-"));
  store = new EventStore(join(root, "checks.db"));
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("checkProjectMemory", () => {
  it("flags repeated errors and fragile changed files with citations", () => {
    seedRepeatedFailure();

    const report = checkProjectMemory({
      projectId: "demo",
      store,
      changedFiles: ["packages/core/src/memory/answer.ts"],
      now: "2026-06-01T08:00:00.000Z",
    });

    expect(report.status).toBe("advisory");
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "repeated-error",
          citations: expect.arrayContaining([
            expect.objectContaining({ reference: "event:11111111-1111-4111-8111-111111111111" }),
          ]),
        }),
        expect.objectContaining({
          code: "fragile-area-touched",
          title: "Changed fragile area: packages/core/src/memory/answer.ts",
        }),
      ]),
    );
  });

  it("flags broad architecture shifts without matching explicit ADRs", () => {
    store.appendArchitectureShift(architectureShift());

    const report = checkProjectMemory({
      projectId: "demo",
      store,
      projectRoot: root,
      now: "2026-06-01T08:00:00.000Z",
    });

    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "missing-decision-record",
        title: "Missing ADR for Dashboard data source migration",
      }),
    );
  });

  it("flags setup docs that omit repeatedly observed commands", () => {
    writeFileSync(join(root, "README.md"), "# Demo\n\nRun npm test.\n");
    store.append(commandEvent("11111111-1111-4111-8111-111111111111"));
    store.append(commandEvent("22222222-2222-4222-8222-222222222222"));

    const report = checkProjectMemory({
      projectId: "demo",
      store,
      projectRoot: root,
      now: "2026-06-01T08:00:00.000Z",
    });

    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: "stale-setup-doc",
        title: "Setup docs may be stale for pnpm typecheck",
      }),
    );
  });

  it("stays quiet when memory has no advisory findings", () => {
    mkdirSync(join(root, "docs", "decisions"), { recursive: true });
    writeFileSync(join(root, "README.md"), "# Demo\n\nRun pnpm typecheck.\n");
    writeFileSync(
      join(root, "docs", "decisions", "0001-dashboard-data-source.md"),
      [
        "# Dashboard data source migration",
        "date: 2026-06-01",
        "",
        "## Decision",
        "Dashboard data source migration keeps reads behind the local API boundary.",
        "",
        "## Consequences",
        "- Applies to `apps/cli/src/commands/serve.ts` and `apps/web/src/features/dashboard`.",
      ].join("\n"),
    );
    store.appendArchitectureShift(architectureShift());
    store.append(commandEvent("11111111-1111-4111-8111-111111111111"));
    store.append(commandEvent("22222222-2222-4222-8222-222222222222"));

    const report = checkProjectMemory({
      projectId: "demo",
      store,
      projectRoot: root,
      now: "2026-06-01T08:00:00.000Z",
    });

    expect(report).toMatchObject({
      status: "pass",
      issues: [],
    });
  });
});

function seedRepeatedFailure(): void {
  store.append(failingEvent("11111111-1111-4111-8111-111111111111", "2026-06-01T07:00:00.000Z"));
  store.append(failingEvent("22222222-2222-4222-8222-222222222222", "2026-06-01T07:05:00.000Z"));
  store.appendSession({
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "demo",
    title: "Memory answer failure",
    slug: "memory-answer-failure",
    startedAt: "2026-06-01T07:00:00.000Z",
    endedAt: "2026-06-01T07:10:00.000Z",
    intent: "bugfix",
    themes: ["memory"],
    affectedAreas: ["packages/core"],
    commitShas: [],
    files: ["packages/core/src/memory/answer.ts"],
    summary: "Investigated repeated memory answer failures.",
    architectureImpact: null,
    eventIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
  } satisfies Session);
}

function failingEvent(id: string, occurredAt: string): TerminalEvent {
  return {
    id,
    projectId: "demo",
    occurredAt,
    observedAt: occurredAt,
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm --filter @kairohq/core test answer",
      cwd: "/repo",
      exitCode: 1,
      stderr: "AN_ERROR: Cannot read project memory answer",
    },
  };
}

function commandEvent(id: string): TerminalEvent {
  return {
    id,
    projectId: "demo",
    occurredAt: "2026-06-01T07:00:00.000Z",
    observedAt: "2026-06-01T07:00:00.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 0,
    },
  };
}

function architectureShift(): ArchitectureShift {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "demo",
    detectedAt: "2026-06-01T07:30:00.000Z",
    kind: "api_redesign",
    title: "Dashboard data source migration",
    summary: "Dashboard reads moved from local fixtures into the CLI API boundary.",
    affectedPaths: [
      "apps/cli/src/commands/serve.ts",
      "apps/web/src/features/dashboard/dashboard-page.tsx",
      "packages/core/src/event-store/event-store.ts",
    ],
    relatedSessionIds: [],
  };
}
