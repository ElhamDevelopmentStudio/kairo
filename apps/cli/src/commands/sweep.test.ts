import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

    const result = await runSweep({}, repoRoot);

    expect(result).toEqual({ eventsIngested: 3, sessionsRendered: 1 });
    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.eventsForProject(config.projectId)).toHaveLength(3);
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

  it("uses the latest ingested commit as the default starting point", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    commitFile("one.txt", "one\n", "add one");
    commitFile("two.txt", "two\n", "add two");
    commitFile("three.txt", "three\n", "add three");
    await runSweep({}, repoRoot);

    const secondRun = await runSweep({}, repoRoot);

    expect(secondRun.eventsIngested).toBe(0);
    const store = new EventStore(workspace.dbPath);
    try {
      expect(store.eventsForProject(config.projectId)).toHaveLength(3);
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
