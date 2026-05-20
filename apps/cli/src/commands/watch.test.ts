import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

    const handle = await runWatch({ pollInterval: 60_000, sessionCheckIntervalMs: 0 }, repoRoot);
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
      writeFileSync(join(repoRoot, "live-two.txt"), "live two\n");
      await waitForEvent(workspace.dbPath, config.projectId, "live-two.txt");
      writeFileSync(join(repoRoot, "live-three.txt"), "live three\n");
      await waitForEvent(workspace.dbPath, config.projectId, "live-three.txt");

      commitFile("commit.txt", "commit\n", "watched commit");
      await handle.pollGitOnce();
      handle.flushSessions(new Date(Date.now() + 31 * 60_000));
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

      const [session] = store.recentSessions(config.projectId);
      if (!session) throw new Error("Expected watch to finalize a live session");
      expect(session?.files).toEqual(
        expect.arrayContaining(["live.txt", "live-two.txt", "live-three.txt"]),
      );
      expect(existsSync(workspace.sessionPath(session.slug))).toBe(true);
      const sessionMarkdown = readFileSync(workspace.sessionPath(session.slug), "utf8");
      expect(sessionMarkdown).toContain("- create `live.txt`");
      expect(sessionMarkdown).toContain("- create `live-two.txt`");
      expect(sessionMarkdown).not.toContain("`.kairo/");
      expect(sessionMarkdown).not.toContain("`.git/");
      expect(readFileSync(workspace.timelinePath, "utf8")).toContain(
        `[full session ->](sessions/${session.slug}.md)`,
      );
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

async function waitForEvent(dbPath: string, projectId: string, path: string): Promise<void> {
  await waitFor(() => {
    const store = new EventStore(dbPath);
    try {
      return store.eventsForProject(projectId).some((event) => {
        return event.kind === "fs.change" && event.payload.path === path;
      });
    } finally {
      store.close();
    }
  });
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
