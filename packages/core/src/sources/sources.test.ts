import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { KairoEvent, Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import { importFromSource, listSourceAdapters } from "./index.ts";

let root: string;
let store: EventStore;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-sources-"));
  store = new EventStore(join(root, ".kairo.db"));
});

afterEach(() => {
  store.close();
  rmSync(root, { recursive: true, force: true });
});

describe("source adapters", () => {
  it("declares first-party source metadata and transformation honesty", () => {
    const adapters = listSourceAdapters();

    expect(adapters.map((adapter) => adapter.definition.id).sort()).toEqual([
      "adrs",
      "agent-transcripts",
      "git-history",
      "kairo-sessions",
      "project-files",
      "terminal-events",
    ]);
    for (const adapter of adapters) {
      expect(adapter.definition.metadataSchema).not.toEqual({});
      expect(adapter.definition.supportedModes.length).toBeGreaterThan(0);
      expect(adapter.definition.transformations.length).toBeGreaterThan(0);
    }
    expect(source("agent-transcripts").transformations.map((item) => item.kind)).toContain(
      "truncation",
    );
    expect(source("terminal-events").privacyClass).toBe("sensitive");
    expect(source("project-files").cursorKind).toBe("content-version");
  });

  it("imports git, terminal, agent, and session evidence from real EventStore rows incrementally", () => {
    store.append(
      gitEvent({
        id: "11111111-1111-4111-8111-111111111111",
        occurredAt: "2026-05-18T10:00:00.000Z",
      }),
    );
    store.append(
      gitEvent({
        id: "22222222-2222-4222-8222-222222222222",
        occurredAt: "2026-05-18T11:00:00.000Z",
        sha: "def",
      }),
    );
    store.append(terminalEvent());
    store.append(agentEvent());
    store.appendSession(session());

    const git = importFromSource(input("git-history", "2026-05-18T10:30:00.000Z"));
    const terminal = importFromSource(input("terminal-events"));
    const agents = importFromSource(input("agent-transcripts"));
    const sessions = importFromSource(input("kairo-sessions"));

    expect(git.items).toHaveLength(1);
    expect(git.items[0]).toMatchObject({
      title: "commit def",
      evidence: [
        { kind: "commit", reference: "def" },
        { kind: "file", reference: "src/def.ts" },
      ],
    });
    expect(terminal.items[0]).toMatchObject({
      title: "pnpm test",
      metadata: { exitCode: 1 },
    });
    expect(agents.items[0]).toMatchObject({
      title: "codex activity",
      metadata: { tool: "codex", filesTouched: ["src/agent.ts"] },
    });
    expect(sessions.items[0]).toMatchObject({
      title: "Improve memory",
      metadata: { slug: "improve-memory" },
    });
  });

  it("imports ADRs from markdown and skips sensitive project files", () => {
    mkdirSync(join(root, "docs", "decisions"), { recursive: true });
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, ".git"), { recursive: true });
    writeFileSync(
      join(root, "docs", "decisions", "0001-memory.md"),
      [
        "# Store memory locally",
        "",
        "Status: accepted",
        "Date: 2026-05-18",
        "",
        "## Decision",
        "",
        "Kairo stores project memory in local SQLite.",
      ].join("\n"),
    );
    writeFileSync(join(root, "src", "index.ts"), "export const value = 1;\n");
    writeFileSync(join(root, ".env"), "TOKEN=secret\n");
    writeFileSync(join(root, ".git", "HEAD"), "ref: refs/heads/main\n");

    const adrs = importFromSource(input("adrs"));
    const files = importFromSource(input("project-files"));

    expect(adrs.items).toHaveLength(1);
    expect(adrs.items[0]).toMatchObject({
      title: "Store memory locally",
      evidence: [{ kind: "adr", reference: "adr:docs/decisions/0001-memory.md" }],
    });
    expect(files.items.map((item) => item.metadata.path)).toEqual([
      "docs/decisions/0001-memory.md",
      "src/index.ts",
    ]);
    expect(files.skipped).toEqual(expect.arrayContaining([".env", ".git/"]));
    expect(files.source.transformations.map((item) => item.kind)).toContain("redaction");
  });
});

function source(id: ReturnType<typeof listSourceAdapters>[number]["definition"]["id"]) {
  const definition = listSourceAdapters().find(
    (adapter) => adapter.definition.id === id,
  )?.definition;
  if (definition === undefined) throw new Error(`Missing source adapter ${id}`);
  return definition;
}

function input(sourceId: Parameters<typeof importFromSource>[0]["sourceId"], cursor?: string) {
  return {
    sourceId,
    projectId: "p1",
    projectRoot: root,
    store,
    ...(cursor === undefined ? {} : { cursor }),
  };
}

function gitEvent(input: { id: string; occurredAt: string; sha?: string }): KairoEvent {
  const sha = input.sha ?? "abc";
  return {
    id: input.id,
    projectId: "p1",
    occurredAt: input.occurredAt,
    observedAt: input.occurredAt,
    source: "git",
    kind: "git.commit",
    payload: {
      sha,
      parentShas: [],
      author: "Test User",
      message: `commit ${sha}`,
      files: [{ path: `src/${sha}.ts`, status: "M", additions: 1, deletions: 0 }],
    },
  };
}

function terminalEvent(): KairoEvent {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: "p1",
    occurredAt: "2026-05-18T12:00:00.000Z",
    observedAt: "2026-05-18T12:00:00.000Z",
    source: "terminal",
    kind: "terminal.command",
    payload: { command: "pnpm test", cwd: root, exitCode: 1 },
  };
}

function agentEvent(): KairoEvent {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    projectId: "p1",
    occurredAt: "2026-05-18T13:00:00.000Z",
    observedAt: "2026-05-18T13:00:00.000Z",
    source: "ai",
    kind: "ai.activity",
    payload: { tool: "codex", summary: "Updated source adapters.", filesTouched: ["src/agent.ts"] },
  };
}

function session(): Session {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: "p1",
    title: "Improve memory",
    slug: "improve-memory",
    startedAt: "2026-05-18T14:00:00.000Z",
    endedAt: "2026-05-18T14:30:00.000Z",
    intent: "feature",
    themes: ["memory"],
    affectedAreas: ["core"],
    commitShas: ["def"],
    files: ["src/agent.ts"],
    summary: "Added source adapters.",
    architectureImpact: null,
    eventIds: [],
  };
}
