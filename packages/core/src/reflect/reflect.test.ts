import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchitectureShift, GitCommitEvent, Session, TerminalEvent } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { reflectProject } from "./reflect.ts";

let root: string;
let store: EventStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-reflect-"));
  store = new EventStore(join(root, "reflect.db"));
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("reflectProject", () => {
  it("generates deterministic evidence-backed reports for every reflection mode", () => {
    seedFixture();

    const base = {
      projectId: "demo",
      store,
      now: "2026-05-31T12:00:00.000Z",
      limit: 3,
    };

    expect(reflectProject({ ...base, mode: "risks" })).toMatchObject({
      title: "Project risks",
      confidence: "low",
      items: expect.arrayContaining([
        expect.objectContaining({
          title: "an_error: cannot find module @kairohq<path>",
          citations: expect.arrayContaining([
            expect.objectContaining({ reference: "event:11111111-1111-4111-8111-111111111111" }),
          ]),
        }),
      ]),
    });
    expect(reflectProject({ ...base, mode: "architecture" })).toMatchObject({
      title: "Architecture reflection",
      items: expect.arrayContaining([
        expect.objectContaining({ title: "Dashboard local API boundary" }),
      ]),
    });
    expect(reflectProject({ ...base, mode: "repeated-errors" })).toMatchObject({
      title: "Repeated errors",
      items: [
        expect.objectContaining({
          title: "an_error: cannot find module @kairohq<path>",
          summary: expect.stringContaining("2 times"),
        }),
      ],
    });
    expect(reflectProject({ ...base, mode: "contributor-map" })).toMatchObject({
      title: "Contributor map",
      items: expect.arrayContaining([
        expect.objectContaining({
          title: "Ada <ada@example.com>",
          citations: expect.arrayContaining([
            expect.objectContaining({ reference: "commit:abc123abc123" }),
          ]),
        }),
      ]),
    });
    expect(reflectProject({ ...base, mode: "release-readiness" })).toMatchObject({
      title: "Release readiness",
      items: expect.arrayContaining([
        expect.objectContaining({ title: "an_error: cannot find module @kairohq<path>" }),
      ]),
    });
  });

  it("reports evidence gaps without inventing recommendations", () => {
    const report = reflectProject({
      projectId: "demo",
      store,
      mode: "repeated-errors",
      now: "2026-05-31T12:00:00.000Z",
    });

    expect(report).toMatchObject({
      confidence: "low",
      items: [],
      unsupported: ["Repeated-error reflection needs multiple observed matching failures."],
    });
  });
});

function seedFixture(): void {
  store.append(terminalEvent("11111111-1111-4111-8111-111111111111", "2026-05-31T09:00:00.000Z"));
  store.append(terminalEvent("22222222-2222-4222-8222-222222222222", "2026-05-31T09:05:00.000Z"));
  store.append(commitEvent());
  store.appendSession(session());
  store.appendArchitectureShift(architectureShift());
}

function terminalEvent(id: string, occurredAt: string): TerminalEvent {
  return {
    id,
    projectId: "demo",
    occurredAt,
    observedAt: occurredAt,
    source: "terminal",
    kind: "terminal.command",
    payload: {
      command: "pnpm typecheck",
      cwd: "/repo",
      exitCode: 1,
      stderr: "AN_ERROR: Cannot find module @kairohq/shared/problem",
    },
  };
}

function commitEvent(): GitCommitEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "demo",
    occurredAt: "2026-05-31T09:10:00.000Z",
    observedAt: "2026-05-31T09:10:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123abc123abc123",
      parentShas: [],
      author: "Ada <ada@example.com>",
      message: "feat: expose dashboard local API boundary",
      files: [
        {
          path: "apps/cli/src/commands/serve.ts",
          status: "M",
          additions: 12,
          deletions: 2,
        },
      ],
    },
  };
}

function session(): Session {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "demo",
    title: "Dashboard API boundary",
    slug: "dashboard-api-boundary",
    startedAt: "2026-05-31T09:10:00.000Z",
    endedAt: "2026-05-31T09:20:00.000Z",
    intent: "feature",
    themes: ["dashboard"],
    affectedAreas: ["apps/cli"],
    commitShas: ["abc123abc123abc123"],
    files: ["apps/cli/src/commands/serve.ts"],
    summary: "Implemented the dashboard local API boundary.",
    architectureImpact: "Dashboard reads now go through the local API boundary.",
    eventIds: ["33333333-3333-4333-8333-333333333333"],
  };
}

function architectureShift(): ArchitectureShift {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: "demo",
    detectedAt: "2026-05-31T09:20:00.000Z",
    kind: "api_redesign",
    title: "Dashboard local API boundary",
    summary: "Dashboard data moved behind the CLI local API.",
    affectedPaths: ["apps/cli/src/commands/serve.ts", "apps/web/src"],
    relatedSessionIds: ["44444444-4444-4444-8444-444444444444"],
  };
}
