import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import summaryFixture from "./fixtures/session-summary.json";
import { runSweep } from "./sweep.ts";

let repoRoot: string;
let commitIndex = 0;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "kairo-sweep-"));
  commitIndex = 0;
  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("runSweep", () => {
  it("ingests git history and renders timeline plus session markdown", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    mkdirSync(join(repoRoot, "src"));
    commitFile("src/one.ts", "export const one = 1;\n", "add one");
    commitFile("src/two.ts", "export const two = 2;\n", "add two");
    commitFile("src/three.ts", "export const three = 3;\n", "add three");

    const result = await runSweep({ summarize: false }, repoRoot);

    expect(result).toEqual({ eventsIngested: 3, sessionsRendered: 1 });
    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.eventsForProject(config.projectId)).toHaveLength(3);
      expect(store.recentSessions(config.projectId)).toHaveLength(1);
    } finally {
      store.close();
    }

    const timeline = readFileSync(workspace.timelinePath, "utf8");
    expect(timeline).toContain("# Project Timeline");
    expect(timeline).toContain("[full session ->](sessions/");

    const sessionFiles = readdirSync(join(workspace.dir, "sessions"));
    expect(sessionFiles).toHaveLength(1);
    const session = readFileSync(join(workspace.dir, "sessions", sessionFiles[0] ?? ""), "utf8");
    expect(session).toContain("commits: 3");
    expect(session).toContain("- commit");
    expect(session).toContain("src/one.ts");
    expect(session).toContain("src/two.ts");
    expect(session).toContain("src/three.ts");
  });

  it("writes structured session summaries when a summarizer is available", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    mkdirSync(join(repoRoot, "src"));
    commitFile("src/one.ts", "export const one = 1;\n", "add one");
    commitFile("src/two.ts", "export const two = 2;\n", "add two");
    commitFile("src/three.ts", "export const three = 3;\n", "add three");

    const result = await runSweep(
      {
        summarizer: async (_session, events) => {
          expect(events).toHaveLength(3);
          return summaryFixture;
        },
      },
      repoRoot,
    );

    expect(result).toEqual({ eventsIngested: 3, sessionsRendered: 1 });
    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.recentSessions(config.projectId)[0]).toMatchObject({
        title: "Module Setup",
        intent: "feature",
        themes: ["module-setup", "exports"],
        affectedAreas: ["src"],
        summary: "Added three source modules and established the initial exported code shape.",
        architectureImpact:
          "The new source files create a small module boundary that later packages can build on.",
      });
    } finally {
      store.close();
    }

    const sessionFiles = readdirSync(join(workspace.dir, "sessions"));
    const session = readFileSync(join(workspace.dir, "sessions", sessionFiles[0] ?? ""), "utf8");
    const timeline = readFileSync(workspace.timelinePath, "utf8");
    expect(session).toContain("# Module Setup");
    expect(session).toContain("intent: feature");
    expect(session).toContain("Added three source modules");
    expect(session).toContain("The new source files create a small module boundary");
    expect(timeline).toContain("Module Setup");
    expect(timeline).toContain("Added three source modules");
  });

  it("uses the latest ingested commit as the default starting point", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    commitFile("one.txt", "one\n", "add one");
    commitFile("two.txt", "two\n", "add two");
    commitFile("three.txt", "three\n", "add three");
    await runSweep({ summarize: false }, repoRoot);

    const secondRun = await runSweep({ summarize: false }, repoRoot);

    expect(secondRun.eventsIngested).toBe(0);
    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.eventsForProject(config.projectId)).toHaveLength(3);
      expect(store.recentSessions(config.projectId)).toHaveLength(1);
    } finally {
      store.close();
    }
  });

  it("stores architecture shifts detected from git history", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    mkdirSync(join(repoRoot, "packages", "shared", "src"), { recursive: true });
    commitFile(
      "packages/shared/package.json",
      '{"name":"@demo/shared"}\n',
      "extract shared package",
    );
    commitFile("packages/shared/src/index.ts", "export const shared = true;\n", "add package code");
    commitFile("packages/shared/src/types.ts", "export interface Shared {}\n", "add package types");

    await runSweep({ summarize: false }, repoRoot);

    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.recentArchitectureShifts(config.projectId)).toMatchObject([
        {
          kind: "package_extraction",
          title: "Package extraction: packages/shared",
          affectedPaths: ["packages/shared"],
        },
      ]);
    } finally {
      store.close();
    }
  });

  it("indexes session embeddings when an embedder is provided", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    mkdirSync(join(repoRoot, "src"));
    commitFile("src/auth.ts", "export const auth = true;\n", "add auth module");
    commitFile("src/session.ts", "export const session = true;\n", "add session module");
    commitFile("src/login.ts", "export const login = true;\n", "add login module");

    await runSweep(
      {
        summarize: false,
        embedder: async (text) => ({
          model: "fake-embed",
          embedding: text.includes("auth") ? [1, 0] : [0, 1],
        }),
      },
      repoRoot,
    );

    const store = new EventStore(workspace.dbPath);
    try {
      expect(
        store.searchSessionEmbeddings(config.projectId, [1, 0], 1)[0]?.session.files,
      ).toContain("src/auth.ts");
    } finally {
      store.close();
    }
  });
});

function commitFile(path: string, content: string, message: string): void {
  writeFileSync(join(repoRoot, path), content);
  git("add", path);
  git("commit", "-m", message);
}

function git(...args: string[]): string {
  commitIndex += args[0] === "commit" ? 1 : 0;
  const minute = String(commitIndex).padStart(2, "0");
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: `2026-05-18T10:${minute}:00Z`,
      GIT_COMMITTER_DATE: `2026-05-18T10:${minute}:00Z`,
    },
  }).trim();
}
