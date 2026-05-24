import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairo/core";
import type { KairoEvent } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runIngest, runIngestAgents } from "./ingest.ts";

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

  it("finalizes and renders the current session on pre-compact AI ingest", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    const firstEvent: KairoEvent = {
      id: "11111111-1111-4111-8111-111111111111",
      projectId: config.projectId,
      occurredAt: "2026-05-18T10:00:00.000Z",
      observedAt: "2026-05-18T10:00:01.000Z",
      source: "fs",
      kind: "fs.change",
      payload: { path: "src/a.ts", op: "modify" },
    };
    const secondEvent: KairoEvent = {
      id: "22222222-2222-4222-8222-222222222222",
      projectId: config.projectId,
      occurredAt: "2026-05-18T10:05:00.000Z",
      observedAt: "2026-05-18T10:05:01.000Z",
      source: "fs",
      kind: "fs.change",
      payload: { path: "src/b.ts", op: "modify" },
    };

    try {
      store.append(firstEvent);
      store.append(secondEvent);
    } finally {
      store.close();
    }

    const event = await runIngest(
      "ai",
      {
        payload: JSON.stringify({
          kind: "pre-compact",
          tool: "claude",
          summary: "Compacting conversation",
          filesTouched: ["src/c.ts"],
          occurredAt: "2026-05-18T10:10:00.000Z",
        }),
      },
      repoRoot,
    );

    const reopened = new EventStore(workspace.dbPath);
    try {
      const sessions = reopened.recentSessions(config.projectId);
      expect(event).toMatchObject({
        projectId: config.projectId,
        source: "ai",
        kind: "ai.activity",
        payload: {
          tool: "claude",
          summary: "Compacting conversation",
          filesTouched: ["src/c.ts"],
        },
      });
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.eventIds).toEqual([firstEvent.id, secondEvent.id, event.id]);
      expect(sessions[0]?.endedAt).toBe("2026-05-18T10:10:00.000Z");
      expect(sessions[0]?.files.sort()).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"]);

      const session = sessions[0];
      expect(session).toBeDefined();
      if (!session) return;

      const sessionPath = workspace.sessionPath(session.slug);
      expect(existsSync(sessionPath)).toBe(true);
      expect(readFileSync(sessionPath, "utf8")).toContain("- claude: Compacting conversation");
      expect(readFileSync(sessionPath, "utf8")).toContain("- touched `src/c.ts`");
      expect(readFileSync(workspace.timelinePath, "utf8")).toContain(session.slug);
    } finally {
      reopened.close();
    }
  });

  it("imports Claude Code JSONL transcripts into rendered sessions", async () => {
    const workspace = new Workspace(repoRoot);
    const config = workspace.init("demo", {
      agentIngest: { enabled: true, providers: ["claude-code"] },
    });
    const home = mkdtempSync(join(tmpdir(), "kairo-agent-home-"));
    const claudeProject = join(
      home,
      ".claude",
      "projects",
      repoRoot.replaceAll("/", "-").replaceAll(":", "-"),
    );
    mkdirSync(claudeProject, { recursive: true });
    writeFileSync(
      join(claudeProject, "session.jsonl"),
      [
        JSON.stringify({
          timestamp: "2026-05-18T10:00:00.000Z",
          message: { role: "user", content: `Please edit ${join(repoRoot, "src/a.ts")}` },
        }),
        JSON.stringify({
          timestamp: "2026-05-18T10:05:00.000Z",
          message: { role: "assistant", content: "Updated the module." },
        }),
      ].join("\n"),
    );

    try {
      const result = await runIngestAgents({ homeDir: home }, repoRoot);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toMatchObject({
        projectId: config.projectId,
        kind: "ai.activity",
        payload: {
          tool: "claude-code",
          filesTouched: ["src/a.ts"],
        },
      });

      const store = new EventStore(workspace.dbPath);
      try {
        const [session] = store.recentSessions(config.projectId);
        expect(session).toBeDefined();
        if (!session) return;
        expect(readFileSync(workspace.sessionPath(session.slug), "utf8")).toContain("claude-code");
      } finally {
        store.close();
      }
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
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
