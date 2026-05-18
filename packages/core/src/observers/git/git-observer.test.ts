import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GitObserver } from "./git-observer.ts";

let repoRoot: string;

beforeEach(() => {
  repoRoot = mkdtempSync(join(tmpdir(), "kairo-git-"));
  git("init");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
});

afterEach(() => {
  rmSync(repoRoot, { recursive: true, force: true });
});

describe("GitObserver", () => {
  it("returns parent SHAs and file-level diff stats", async () => {
    writeFileSync(join(repoRoot, "changed.txt"), "one\n");
    writeFileSync(join(repoRoot, "deleted.txt"), "remove me\n");
    git("add", ".");
    git("commit", "-m", "initial commit");
    const initialSha = git("rev-parse", "HEAD");

    writeFileSync(join(repoRoot, "changed.txt"), "one\ntwo\n");
    writeFileSync(join(repoRoot, "added.txt"), "new\n");
    rmSync(join(repoRoot, "deleted.txt"));
    git("add", ".");
    git("commit", "-m", "second commit");
    const secondSha = git("rev-parse", "HEAD");

    const observer = new GitObserver("project-1", repoRoot);
    const events = await observer.commitsSince(initialSha);

    expect(events).toHaveLength(1);
    expect(events[0]?.payload).toMatchObject({
      sha: secondSha,
      parentShas: [initialSha],
      author: "Test User",
      message: "second commit",
    });
    expect(events[0]?.payload.files).toEqual(
      expect.arrayContaining([
        { path: "added.txt", status: "A", additions: 1, deletions: 0 },
        { path: "changed.txt", status: "M", additions: 1, deletions: 0 },
        { path: "deleted.txt", status: "D", additions: 0, deletions: 1 },
      ]),
    );
  });

  it("records rename source paths", async () => {
    mkdirSync(join(repoRoot, "src"));
    writeFileSync(join(repoRoot, "src", "old-name.ts"), "export const value = 1;\n");
    git("add", ".");
    git("commit", "-m", "add source file");

    git("mv", "src/old-name.ts", "src/new-name.ts");
    git("commit", "-m", "rename source file");

    const observer = new GitObserver("project-1", repoRoot);
    const events = await observer.commitsSince();
    const renameEvent = events.find((event) => event.payload.message === "rename source file");

    expect(renameEvent?.payload.files).toEqual([
      {
        path: "src/new-name.ts",
        renamedFrom: "src/old-name.ts",
        status: "R",
        additions: 0,
        deletions: 0,
      },
    ]);
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
