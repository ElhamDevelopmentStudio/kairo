import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, type TextEmbedder, Workspace, indexSessionEmbeddings } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runSearch } from "./search.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-cli-search-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runSearch", () => {
  it("returns semantic matches by default when embeddings are available", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const auth = session({
      projectId: config.projectId,
      slug: "auth-rewrite",
      title: "Auth rewrite",
      summary: "Moved login state into the panel",
      themes: ["security"],
    });
    const billing = session({
      id: "22222222-2222-4222-8222-222222222222",
      projectId: config.projectId,
      slug: "billing-cleanup",
      title: "Billing cleanup",
      summary: "Removed duplicate invoice helpers",
      themes: ["finance"],
    });
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(auth);
      store.appendSession(billing);
      await indexSessionEmbeddings(store, [auth, billing], fakeEmbed);
    } finally {
      store.close();
    }

    const results = await runSearch("signin state migration", { embedder: fakeEmbed }, root);

    expect(results.map((result) => result.session.slug)).toEqual([
      "auth-rewrite",
      "billing-cleanup",
    ]);
    expect(results[0]).toMatchObject({ mode: "semantic" });
  });

  it("falls back to keyword search when semantic search cannot run", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          projectId: config.projectId,
          title: "Auth rewrite",
          slug: "auth-rewrite",
          summary: "Moved login state into the panel",
        }),
      );
    } finally {
      store.close();
    }

    const results = await runSearch(
      "login",
      {
        embedder: async () => {
          throw new Error("offline");
        },
      },
      root,
    );

    expect(results).toEqual([
      expect.objectContaining({
        mode: "keyword",
        session: expect.objectContaining({ slug: "auth-rewrite" }),
      }),
    ]);
  });
});

const fakeEmbed: TextEmbedder = async (text) => ({
  model: "fake-embed",
  embedding:
    text.includes("signin") ||
    text.includes("login") ||
    text.includes("Auth") ||
    text.includes("security")
      ? [1, 0]
      : [0, 1],
});

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "p1",
    title: "Session",
    slug: "session",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T11:00:00.000Z",
    intent: "unknown",
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
