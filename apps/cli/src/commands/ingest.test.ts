import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngest } from "./ingest.ts";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "kairo-ingest-"));
  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("runIngest", () => {
  it("validates a git payload and writes one event row to SQLite", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    writeFileSync(join(repoRoot, "README.md"), "# Demo\n");
    git("add", "README.md");
    git("commit", "-m", "initial commit");
    const sha = git("rev-parse", "HEAD");

    const event = await runIngest("git", { payload: JSON.stringify({ sha }) }, repoRoot);

    const store = new EventStore(workspace.dbPath);
    try {
      const events = store.recentEvents(config.projectId);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        id: event.id,
        projectId: config.projectId,
        source: "git",
        kind: "git.commit",
        payload: {
          sha,
          author: "Test User",
          message: "initial commit",
          files: [{ path: "README.md", status: "A", additions: 1, deletions: 0 }],
        },
      });
    } finally {
      store.close();
    }
  });

  it("finds the workspace from a nested directory", async () => {
    const workspace = new Workspace(repoRoot);
    workspace.init("demo");
    writeFileSync(join(repoRoot, "README.md"), "# Demo\n");
    git("add", "README.md");
    git("commit", "-m", "initial commit");
    const sha = git("rev-parse", "HEAD");
    const nested = join(repoRoot, "src", "feature");
    mkdirSync(nested, { recursive: true });

    await expect(
      runIngest("git", { payload: JSON.stringify({ sha }) }, nested),
    ).resolves.toMatchObject({
      kind: "git.commit",
    });
  });
});

function git(...args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-05-18T10:00:00Z",
      GIT_COMMITTER_DATE: "2026-05-18T10:00:00Z",
    },
  }).trim();
}
