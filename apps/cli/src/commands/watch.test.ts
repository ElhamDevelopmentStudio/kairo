import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runWatch } from "./watch.ts";

let repoRoot: string;
let commitIndex = 0;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "kairo-watch-"));
  commitIndex = 0;
  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("runWatch", () => {
  it("records file changes and new commits", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    commitFile("initial.txt", "initial\n", "initial commit");

    const handle = await runWatch({ pollInterval: 60_000 }, repoRoot);
    try {
      writeFileSync(join(repoRoot, "live.txt"), "live\n");
      await waitFor(() => {
        const store = new EventStore(workspace.dbPath);
        try {
          return store.eventsForProject(config.projectId).some((event) => {
            return event.kind === "fs.change" && event.payload.path === "live.txt";
          });
        } finally {
          store.close();
        }
      });

      commitFile("commit.txt", "commit\n", "watched commit");
      await handle.pollGitOnce();
    } finally {
      await handle.stop();
    }

    const store = new EventStore(workspace.dbPath);
    try {
      const events = store.eventsForProject(config.projectId);
      expect(
        events.some((event) => event.kind === "fs.change" && event.payload.path === "live.txt"),
      ).toBe(true);
      expect(
        events.some(
          (event) => event.kind === "git.commit" && event.payload.message === "watched commit",
        ),
      ).toBe(true);
    } finally {
      store.close();
    }
  });
});

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for condition");
}

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
