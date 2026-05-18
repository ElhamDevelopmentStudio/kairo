import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitTailer } from "./tailer.ts";

let repoRoot: string;
let commitIndex = 0;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "kairo-tailer-"));
  commitIndex = 0;
  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("GitTailer", () => {
  it("polls commits after the configured SHA", async () => {
    commitFile("one.txt", "one\n", "add one");
    const initialSha = git("rev-parse", "HEAD");
    commitFile("two.txt", "two\n", "add two");

    const tailer = new GitTailer("project-1", repoRoot, { sinceSha: initialSha });
    const seen = await tailer.pollOnce(() => {});

    expect(seen).toHaveLength(1);
    expect(seen[0]?.payload.message).toBe("add two");
    expect(seen[0]?.payload.files).toEqual([
      { path: "two.txt", status: "A", additions: 1, deletions: 0 },
    ]);
  });

  it("starts from current HEAD by default", async () => {
    commitFile("one.txt", "one\n", "add one");
    const tailer = new GitTailer("project-1", repoRoot);
    await tailer.start(() => {});
    commitFile("two.txt", "two\n", "add two");

    const seen = await tailer.pollOnce(() => {});
    tailer.stop();

    expect(seen.map((event) => event.payload.message)).toEqual(["add two"]);
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
