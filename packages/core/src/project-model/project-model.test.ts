import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { buildProjectModel } from "./project-model.ts";

let root: string;
let store: EventStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-project-model-"));
  store = new EventStore(join(root, "model.db"));
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("buildProjectModel", () => {
  it("derives current architecture, conventions, recurring failures, commands, and superseded decisions", () => {
    seedModelFixture();

    const model = buildProjectModel({
      projectId: "demo",
      projectRoot: root,
      store,
      now: "2026-05-31T12:00:00.000Z",
    });

    expect(model.architecture).toContainEqual(
      expect.objectContaining({
        title: "Dashboard service boundary",
        evidence: expect.arrayContaining([
          expect.objectContaining({
            kind: "architecture_shift",
            reference: "architecture:11111111-1111-4111-8111-111111111111",
          }),
        ]),
      }),
    );
    expect(model.conventions.map((item) => item.title)).toContain("Contributor rules");
    expect(model.preferredPatterns.map((item) => item.title)).toContain("Contributor rules");
    expect(model.recurringFailures[0]).toMatchObject({
      title: "an_error: cannot find module @kairo<path>",
      metadata: { count: 2 },
    });
    expect(model.fragileAreas[0]).toMatchObject({
      title: "packages/shared/src/problem.ts",
      metadata: { count: 2 },
    });
    expect(model.importantCommands[0]).toMatchObject({
      title: "pnpm typecheck",
      metadata: { count: 2, failures: 2 },
    });
    expect(model.supersededDecisions[0]).toMatchObject({
      title: "Use local API dashboard reads superseded Use direct SQLite dashboard reads",
      evidence: expect.arrayContaining([
        expect.objectContaining({ reference: "adr:docs/decisions/0001-dashboard-storage.md" }),
        expect.objectContaining({ reference: "adr:docs/decisions/0002-dashboard-storage.md" }),
      ]),
    });
  });

  it("updates risks after an unfixed failure appears", () => {
    store.append(
      terminalEvent("22222222-2222-4222-8222-222222222222", "BROKEN_ENV: Missing TEST_KEY"),
    );

    const model = buildProjectModel({
      projectId: "demo",
      store,
      now: "2026-05-31T12:00:00.000Z",
    });

    expect(model.activeRisks[0]).toMatchObject({
      title: "broken_env: missing test_key",
      summary: "Unfixed terminal failure: BROKEN_ENV: Missing TEST_KEY",
    });
  });
});

function seedModelFixture(): void {
  mkdirSync(join(root, "docs", "decisions"), { recursive: true });
  writeFileSync(
    join(root, "docs", "decisions", "0001-dashboard-storage.md"),
    [
      "# Use direct SQLite dashboard reads",
      "Date: 2026-05-18",
      "",
      "## Decision",
      "The dashboard reads SQLite directly from `apps/web/src/app.tsx`.",
    ].join("\n"),
  );
  writeFileSync(
    join(root, "docs", "decisions", "0002-dashboard-storage.md"),
    [
      "# Use local API dashboard reads",
      "Date: 2026-05-21",
      "",
      "## Decision",
      "The dashboard should use the local CLI API instead of direct SQLite from `apps/web/src/app.tsx`.",
      "",
      "## Rationale",
      "Prefer one storage boundary so the frontend remains optional.",
      "",
      "## Consequences",
      "- Reduces risk of duplicated EventStore queries.",
    ].join("\n"),
  );
  store.appendArchitectureShift(architectureShift());
  store.appendSession(
    session({
      id: "33333333-3333-4333-8333-333333333333",
      slug: "contributor-rules",
      title: "Contributor rules",
      summary:
        "New convention: contributors should prefer package helpers and never duplicate shared types.",
      architectureImpact: "Preferred implementation pattern is to keep apps thin.",
      files: ["AGENTS.md"],
    }),
  );
  store.append(
    terminalEvent(
      "44444444-4444-4444-8444-444444444444",
      "AN_ERROR: Cannot find module @kairo/shared/problem",
    ),
  );
  store.append(
    terminalEvent(
      "55555555-5555-4555-8555-555555555555",
      "AN_ERROR: Cannot find module @kairo/shared/problem",
    ),
  );
  store.appendSession(
    session({
      id: "66666666-6666-4666-8666-666666666666",
      slug: "fix-problem-schema",
      title: "Fix problem schema",
      summary: "Fixed repeated problem schema exports.",
      files: ["packages/shared/src/problem.ts"],
      eventIds: ["44444444-4444-4444-8444-444444444444", "55555555-5555-4555-8555-555555555555"],
    }),
  );
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    projectId: "demo",
    title: "Session",
    slug: "session",
    startedAt: "2026-05-22T09:00:00.000Z",
    endedAt: "2026-05-22T10:00:00.000Z",
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

function architectureShift(): ArchitectureShift {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "demo",
    detectedAt: "2026-05-20T09:00:00.000Z",
    kind: "modularization",
    title: "Dashboard service boundary",
    summary: "Dashboard visualization moved behind the local CLI service boundary.",
    affectedPaths: ["apps/cli/src", "apps/web/src"],
    relatedSessionIds: [],
  };
}

function terminalEvent(id: string, stderr: string): KairoEvent {
  return {
    id,
    projectId: "demo",
    occurredAt: "2026-05-22T09:00:00.000Z",
    observedAt: "2026-05-22T09:00:01.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: root,
      exitCode: 1,
      stderr,
    },
  };
}
