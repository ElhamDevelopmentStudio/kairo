import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, type TextEmbedder, Workspace, indexSessionEmbeddings } from "@kairohq/core";
import type { Session } from "@kairohq/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { searchSessions } from "./search.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-mcp-search-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("searchSessions", () => {
  it("returns sessions matching literal text across titles, summaries, themes, and files", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          id: "11111111-1111-4111-8111-111111111111",
          projectId: config.projectId,
          slug: "auth-rewrite",
          title: "Auth rewrite",
          summary: "Moved login state into the panel",
          themes: ["security"],
          files: ["src/auth/session.ts"],
          startedAt: "2026-05-18T09:00:00.000Z",
        }),
      );
      store.appendSession(
        session({
          id: "22222222-2222-4222-8222-222222222222",
          projectId: config.projectId,
          slug: "billing-cleanup",
          title: "Billing cleanup",
          summary: "Removed duplicate invoice helpers",
          themes: ["finance"],
          files: ["src/billing/invoice.ts"],
          startedAt: "2026-05-18T11:00:00.000Z",
        }),
      );
      store.appendSession(
        session({
          id: "33333333-3333-4333-8333-333333333333",
          projectId: "other-project",
          slug: "other-auth",
          title: "Other auth",
        }),
      );
    } finally {
      store.close();
    }

    expect((await searchSessions({ workspace }, "auth", 10)).map((s) => s.slug)).toEqual([
      "auth-rewrite",
    ]);
    expect((await searchSessions({ workspace }, "invoice.ts", 10)).map((s) => s.slug)).toEqual([
      "billing-cleanup",
    ]);
    expect((await searchSessions({ workspace }, "finance", 10)).map((s) => s.slug)).toEqual([
      "billing-cleanup",
    ]);
    expect((await searchSessions({ workspace }, "login", 10)).map((s) => s.slug)).toEqual([
      "auth-rewrite",
    ]);
  });

  it("returns semantic matches before keyword fallback when embeddings are available", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const auth = session({
      id: "11111111-1111-4111-8111-111111111111",
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

    const results = await searchSessions({ workspace }, "signin state migration", 2, fakeEmbed);

    expect(results.map((result) => result.slug)).toEqual(["auth-rewrite", "billing-cleanup"]);
    expect(results[0]).toMatchObject({ mode: "semantic" });
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
  });

  it("respects the result limit and empty-workspace behavior", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          id: "11111111-1111-4111-8111-111111111111",
          projectId: config.projectId,
          title: "Auth older",
          startedAt: "2026-05-18T09:00:00.000Z",
        }),
      );
      store.appendSession(
        session({
          id: "22222222-2222-4222-8222-222222222222",
          projectId: config.projectId,
          slug: "newer",
          title: "Auth newer",
          startedAt: "2026-05-18T11:00:00.000Z",
        }),
      );
    } finally {
      store.close();
    }

    expect((await searchSessions({ workspace }, "auth", 1)).map((s) => s.title)).toEqual([
      "Auth newer",
    ]);
    await expect(searchSessions({ workspace: null }, "auth", 10)).resolves.toEqual([]);
    await expect(searchSessions({ workspace }, "   ", 10)).resolves.toEqual([]);
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
