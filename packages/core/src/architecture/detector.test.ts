import type { KairoEvent, Session } from "@kairohq/shared";
import { describe, expect, it } from "vitest";
import { detectArchitectureShifts } from "./detector.ts";

type GitFile = Extract<KairoEvent, { kind: "git.commit" }>["payload"]["files"][number];

describe("detectArchitectureShifts", () => {
  it("detects package extraction from newly added package manifests", () => {
    const input = inputFor([
      commit("extract shared package", [
        file("packages/shared/package.json", "A", 20, 0),
        file("packages/shared/src/index.ts", "A", 12, 0),
      ]),
    ]);

    expect(detectArchitectureShifts(input)).toContainEqual(
      expect.objectContaining({
        kind: "package_extraction",
        title: "Package extraction: packages/shared",
        affectedPaths: ["packages/shared"],
      }),
    );
  });

  it("detects directory restructures from rename-heavy sessions", () => {
    const input = inputFor([
      commit("move modules into feature folders", [
        file("src/auth/index.ts", "R", 0, 0, "src/auth.ts"),
        file("src/billing/index.ts", "R", 0, 0, "src/billing.ts"),
        file("src/users/index.ts", "R", 0, 0, "src/users.ts"),
      ]),
    ]);

    expect(detectArchitectureShifts(input)).toContainEqual(
      expect.objectContaining({
        kind: "directory_restructure",
        affectedPaths: ["src"],
      }),
    );
  });

  it("detects framework migrations from migration intent and framework surfaces", () => {
    const input = inputFor([
      commit("migrate from Next.js to Vite", [
        file("package.json", "M", 8, 8),
        file("next.config.js", "D", 0, 20),
        file("vite.config.ts", "A", 30, 0),
      ]),
    ]);

    expect(detectArchitectureShifts(input)).toContainEqual(
      expect.objectContaining({
        kind: "framework_migration",
        affectedPaths: ["next.config.js", "package.json", "vite.config.ts"],
      }),
    );
  });

  it("detects dependency shifts from manifest and lockfile churn", () => {
    const input = inputFor([
      commit("upgrade dependencies", [
        file("package.json", "M", 5, 5),
        file("pnpm-lock.yaml", "M", 100, 80),
      ]),
    ]);

    expect(detectArchitectureShifts(input)).toContainEqual(
      expect.objectContaining({
        kind: "dependency_shift",
        title: "Dependency shift",
        affectedPaths: ["package.json", "pnpm-lock.yaml"],
      }),
    );
  });
});

function inputFor(events: KairoEvent[]) {
  return {
    projectId: "p1",
    events,
    sessions: [
      session({
        eventIds: events.map((event) => event.id),
        files: events.flatMap((event) =>
          event.kind === "git.commit" ? event.payload.files.map((file) => file.path) : [],
        ),
      }),
    ],
  };
}

function commit(message: string, files: GitFile[]): KairoEvent {
  return {
    id: crypto.randomUUID(),
    projectId: "p1",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: crypto.randomUUID(),
      parentShas: [],
      author: "test",
      message,
      files,
    },
  };
}

function file(
  path: string,
  status: GitFile["status"],
  additions: number,
  deletions: number,
  renamedFrom?: string,
): GitFile {
  return {
    path,
    status,
    additions,
    deletions,
    ...(renamedFrom !== undefined ? { renamedFrom } : {}),
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "p1",
    title: "Session",
    slug: "session",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T10:30:00.000Z",
    intent: "refactor",
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
