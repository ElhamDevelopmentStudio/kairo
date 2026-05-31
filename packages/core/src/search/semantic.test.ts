import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "../event-store/index.ts";
import {
  type TextEmbedder,
  indexSessionEmbeddings,
  semanticSearchSessions,
  sessionSearchContentHash,
  sessionSearchText,
} from "./semantic.ts";

let tmp: string;
let store: EventStore;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-semantic-"));
  store = new EventStore(join(tmp, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
});

describe("semantic search", () => {
  it("builds stable session search text and content hashes", () => {
    const target = session({
      title: "Auth rewrite",
      intent: "refactor",
      themes: ["security"],
      files: ["src/auth/session.ts"],
      summary: "Moved login state into the panel",
    });

    expect(sessionSearchText(target)).toContain("Auth rewrite");
    expect(sessionSearchText(target)).toContain("src/auth/session.ts");
    expect(sessionSearchText(target)).toContain("signin");
    expect(sessionSearchContentHash(target)).toMatch(/^[a-f0-9]{64}$/);
    expect(sessionSearchContentHash(target)).toBe(sessionSearchContentHash(target));
  });

  it("indexes sessions and retrieves nearest semantic matches", async () => {
    const auth = session({
      id: "22222222-2222-4222-8222-222222222222",
      title: "Auth rewrite",
      slug: "auth-rewrite",
      summary: "Moved login state into the panel",
      themes: ["security"],
    });
    const billing = session({
      id: "33333333-3333-4333-8333-333333333333",
      title: "Billing cleanup",
      slug: "billing-cleanup",
      summary: "Removed duplicate invoice helpers",
      themes: ["finance"],
    });
    store.appendSession(auth);
    store.appendSession(billing);

    const indexed = await indexSessionEmbeddings(store, [auth, billing], fakeEmbed);
    const results = await semanticSearchSessions(
      store,
      "p1",
      "signin state migration",
      fakeEmbed,
      2,
    );

    expect(indexed).toBe(2);
    expect(results.map((result) => result.session.slug)).toEqual([
      "auth-rewrite",
      "billing-cleanup",
    ]);
    expect(results[0]).toMatchObject({
      mode: "semantic",
      model: "fake-embed",
    });
    expect(results[0]?.score).toBeGreaterThan(results[1]?.score ?? 0);
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
