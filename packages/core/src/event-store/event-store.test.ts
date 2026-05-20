import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ArchitectureShift, KairoEvent, Session } from "@kairo/shared";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EventStore } from "./event-store.ts";

let tmp: string;
let store: EventStore;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "kairo-store-"));
  store = new EventStore(join(tmp, "test.db"));
});

afterEach(() => {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
});

function commitEvent(overrides: Partial<KairoEvent> = {}): KairoEvent {
  return {
    id: crypto.randomUUID(),
    projectId: "p1",
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123",
      parentShas: [],
      author: "test",
      message: "test commit",
      files: [],
    },
    ...overrides,
  } as KairoEvent;
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: "p1",
    title: "Session one",
    slug: "session-one",
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

function architectureShift(overrides: Partial<ArchitectureShift> = {}): ArchitectureShift {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    projectId: "p1",
    detectedAt: "2026-05-18T11:00:00.000Z",
    kind: "directory_restructure",
    title: "Directory restructure",
    summary: "Moved modules into feature folders",
    affectedPaths: ["src"],
    relatedSessionIds: ["11111111-1111-4111-8111-111111111111"],
    ...overrides,
  };
}

describe("EventStore", () => {
  it("appends and reads events back", () => {
    const ev = commitEvent();
    store.append(ev);
    const out = store.recentEvents("p1");
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe(ev.id);
    expect(out[0]?.kind).toBe("git.commit");
  });

  it("redacts secrets in payloads on append", () => {
    store.append(
      commitEvent({
        payload: {
          sha: "abc123",
          parentShas: [],
          author: "test",
          message: "rotate token ghp_abcdefghijklmnopqrstuvwxyz0123456789",
          files: [],
        },
      }),
    );
    const [event] = store.recentEvents("p1");
    if (event?.kind !== "git.commit") throw new Error("expected git.commit");
    expect(event.payload.message).toContain("<REDACTED>");
    expect(event.payload.message).not.toContain("ghp_");
  });

  it("rejects malformed event rows at read time", () => {
    const raw = new Database(join(tmp, "test.db"));
    raw
      .prepare(
        `INSERT INTO events (id, project_id, occurred_at, observed_at, source, kind, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "00000000-0000-4000-8000-000000000000",
        "p1",
        "2026-05-18T10:00:00.000Z",
        "2026-05-18T10:00:01.000Z",
        "git",
        "git.commit",
        JSON.stringify({ wrong: "shape" }),
      );
    raw.close();

    expect(() => store.recentEvents("p1")).toThrow();
  });

  it("is idempotent on duplicate event id", () => {
    const ev = commitEvent();
    store.append(ev);
    store.append(ev);
    expect(store.recentEvents("p1")).toHaveLength(1);
  });

  it("scopes by projectId", () => {
    store.append(commitEvent({ projectId: "p1" }));
    store.append(commitEvent({ projectId: "p2" }));
    expect(store.recentEvents("p1")).toHaveLength(1);
    expect(store.recentEvents("p2")).toHaveLength(1);
  });

  it("returns most recent first", () => {
    store.append(commitEvent({ occurredAt: "2026-05-18T09:00:00.000Z" }));
    store.append(commitEvent({ occurredAt: "2026-05-18T11:00:00.000Z" }));
    const out = store.recentEvents("p1");
    expect(out[0]?.occurredAt).toBe("2026-05-18T11:00:00.000Z");
    expect(out[1]?.occurredAt).toBe("2026-05-18T09:00:00.000Z");
  });

  it("respects limit", () => {
    for (let i = 0; i < 5; i++) {
      store.append(commitEvent({ occurredAt: new Date(2026, 4, 18, i).toISOString() }));
    }
    expect(store.recentEvents("p1", 2)).toHaveLength(2);
  });

  it("loads all project events oldest first", () => {
    store.append(commitEvent({ occurredAt: "2026-05-18T11:00:00.000Z" }));
    store.append(commitEvent({ id: crypto.randomUUID(), occurredAt: "2026-05-18T09:00:00.000Z" }));

    const out = store.eventsForProject("p1");

    expect(out).toHaveLength(2);
    expect(out[0]?.occurredAt).toBe("2026-05-18T09:00:00.000Z");
    expect(out[1]?.occurredAt).toBe("2026-05-18T11:00:00.000Z");
  });

  it("returns the latest ingested git commit SHA", () => {
    store.append(
      commitEvent({
        occurredAt: "2026-05-18T09:00:00.000Z",
        payload: {
          sha: "older",
          parentShas: [],
          author: "test",
          message: "older commit",
          files: [],
        },
      }),
    );
    store.append(
      commitEvent({
        id: crypto.randomUUID(),
        occurredAt: "2026-05-18T11:00:00.000Z",
        payload: {
          sha: "newer",
          parentShas: ["older"],
          author: "test",
          message: "newer commit",
          files: [],
        },
      }),
    );

    expect(store.latestGitCommitSha("p1")).toBe("newer");
    expect(store.latestGitCommitSha("missing")).toBeNull();
  });

  it("upserts and reads sessions by id", () => {
    const first = session();
    store.appendSession(first);
    store.appendSession({ ...first, title: "Updated session", summary: "updated" });

    expect(store.getSession(first.id)).toMatchObject({
      id: first.id,
      title: "Updated session",
      summary: "updated",
    });
    expect(store.recentSessions("p1")).toHaveLength(1);
  });

  it("reads sessions by project and slug", () => {
    store.appendSession(session({ slug: "same-slug", title: "Project one" }));
    store.appendSession(
      session({
        id: "22222222-2222-4222-8222-222222222222",
        projectId: "p2",
        slug: "same-slug",
        title: "Project two",
      }),
    );

    expect(store.getSessionBySlug("p1", "same-slug")?.title).toBe("Project one");
    expect(store.getSessionBySlug("p2", "same-slug")?.title).toBe("Project two");
    expect(store.getSessionBySlug("p1", "missing")).toBeNull();
  });

  it("searches sessions by literal title, summary, themes, and files", () => {
    store.appendSession(
      session({
        id: "22222222-2222-4222-8222-222222222222",
        title: "Auth rewrite",
        summary: "Moved login state into the panel",
        themes: ["security"],
        files: ["src/auth/session.ts"],
        startedAt: "2026-05-18T09:00:00.000Z",
      }),
    );
    store.appendSession(
      session({
        id: "33333333-3333-4333-8333-333333333333",
        title: "Billing cleanup",
        summary: "Removed duplicate invoice helpers",
        themes: ["finance"],
        files: ["src/billing/invoice.ts"],
        startedAt: "2026-05-18T11:00:00.000Z",
      }),
    );
    store.appendSession(
      session({
        id: "44444444-4444-4444-8444-444444444444",
        projectId: "p2",
        title: "Auth in another project",
      }),
    );

    expect(store.searchSessions("p1", "auth").map((s) => s.title)).toEqual(["Auth rewrite"]);
    expect(store.searchSessions("p1", "login").map((s) => s.title)).toEqual(["Auth rewrite"]);
    expect(store.searchSessions("p1", "finance").map((s) => s.title)).toEqual(["Billing cleanup"]);
    expect(store.searchSessions("p1", "invoice.ts").map((s) => s.title)).toEqual([
      "Billing cleanup",
    ]);
  });

  it("treats LIKE wildcard characters as literal search text", () => {
    store.appendSession(session({ title: "Fix 100_percent coverage" }));
    store.appendSession(
      session({
        id: "22222222-2222-4222-8222-222222222222",
        title: "Fix 100Xpercent coverage",
      }),
    );

    expect(store.searchSessions("p1", "100_percent").map((s) => s.title)).toEqual([
      "Fix 100_percent coverage",
    ]);
  });

  it("returns recent sessions newest first and scoped by project", () => {
    store.appendSession(
      session({
        id: "22222222-2222-4222-8222-222222222222",
        startedAt: "2026-05-18T09:00:00.000Z",
      }),
    );
    store.appendSession(
      session({
        id: "33333333-3333-4333-8333-333333333333",
        startedAt: "2026-05-18T11:00:00.000Z",
      }),
    );
    store.appendSession(
      session({
        id: "44444444-4444-4444-8444-444444444444",
        projectId: "p2",
        startedAt: "2026-05-18T12:00:00.000Z",
      }),
    );

    const out = store.recentSessions("p1");

    expect(out).toHaveLength(2);
    expect(out[0]?.startedAt).toBe("2026-05-18T11:00:00.000Z");
    expect(out[1]?.startedAt).toBe("2026-05-18T09:00:00.000Z");
    expect(store.getSession("missing")).toBeNull();
  });

  it("upserts and reads architecture shifts newest first", () => {
    store.appendArchitectureShift(
      architectureShift({
        id: "55555555-5555-4555-8555-555555555555",
        detectedAt: "2026-05-18T09:00:00.000Z",
        title: "Older restructure",
      }),
    );
    store.appendArchitectureShift(
      architectureShift({
        id: "66666666-6666-4666-8666-666666666666",
        detectedAt: "2026-05-18T11:00:00.000Z",
        kind: "package_extraction",
        title: "Package extraction",
      }),
    );
    store.appendArchitectureShift(
      architectureShift({
        id: "55555555-5555-4555-8555-555555555555",
        detectedAt: "2026-05-18T09:00:00.000Z",
        title: "Updated restructure",
      }),
    );

    expect(store.recentArchitectureShifts("p1").map((shift) => shift.title)).toEqual([
      "Package extraction",
      "Updated restructure",
    ]);
    expect(store.recentArchitectureShifts("missing")).toEqual([]);
  });
});
