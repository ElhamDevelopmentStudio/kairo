import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EventStore, Workspace } from "@kairohq/core";
import type { ArchitectureShift, GitCommitEvent, Session } from "@kairohq/shared";
import { describe, expect, it } from "vitest";
import { createDashboardApp } from "./serve.ts";

describe("createDashboardApp", () => {
  it("exposes project health and timeline data from EventStore", async () => {
    const { workspace, session, shift } = createWorkspaceFixture();
    const app = createDashboardApp({ workspace });

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      projectId: session.projectId,
      projectName: "Serve Fixture",
    });

    const timeline = await app.request("/api/timeline");
    expect(timeline.status).toBe(200);
    await expect(timeline.json()).resolves.toMatchObject({
      sessions: [{ id: session.id, slug: session.slug, title: session.title }],
      architectureShifts: [{ id: shift.id, title: shift.title }],
    });
  });

  it("returns session detail with related events and rendered markdown", async () => {
    const { workspace, session, event } = createWorkspaceFixture();
    const app = createDashboardApp({ workspace });

    const response = await app.request(`/api/sessions/${session.slug}`);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { id: session.id, slug: session.slug },
      events: [{ id: event.id, kind: "git.commit" }],
      markdown: expect.stringContaining("# API Boundary"),
    });
  });

  it("returns 404 for missing sessions", async () => {
    const { workspace } = createWorkspaceFixture();
    const app = createDashboardApp({ workspace });

    const response = await app.request("/api/sessions/missing");
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Session not found" });
  });

  it("returns a structured API error when workspace data is unavailable", async () => {
    const workspace = new Workspace(mkdtempSync(join(tmpdir(), "kairo-serve-unready-")));
    const app = createDashboardApp({ workspace });

    const response = await app.request("/api/health");
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: "Dashboard data unavailable",
    });
  });

  it("falls back to the database project when workspace config is missing", async () => {
    const { workspace, session } = createWorkspaceFixture();
    unlinkSync(workspace.configPath);
    const app = createDashboardApp({ workspace });

    const health = await app.request("/api/health");
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toMatchObject({
      ok: true,
      projectId: session.projectId,
    });

    const sessions = await app.request("/api/sessions");
    expect(sessions.status).toBe(200);
    await expect(sessions.json()).resolves.toMatchObject({
      sessions: [{ id: session.id }],
    });
  });

  it("searches sessions by text and clamps invalid limits", async () => {
    const { workspace, session } = createWorkspaceFixture();
    const app = createDashboardApp({ workspace });

    const empty = await app.request("/api/search?q=");
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toEqual({ sessions: [] });

    const result = await app.request("/api/search?q=dashboard&limit=nope");
    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({
      sessions: [{ id: session.id, title: session.title }],
    });
  });

  it("answers dashboard memory questions with cited project evidence", async () => {
    const { workspace, event, session } = createWorkspaceFixture();
    const app = createDashboardApp({ workspace });

    const empty = await app.request("/api/ask", {
      body: JSON.stringify({ question: " " }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(empty.status).toBe(400);
    await expect(empty.json()).resolves.toEqual({ error: "Question is required" });

    const response = await app.request("/api/ask", {
      body: JSON.stringify({ question: "Why did we add the local dashboard API?" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      answer: expect.stringContaining("Local dashboard API"),
      question: "Why did we add the local dashboard API?",
    });
    expect(body.citations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventIds: [event.id],
          reference: `session:${session.slug}`,
        }),
      ]),
    );
  });

  it("answers dashboard memory questions from workspace ADR files", async () => {
    const { workspace } = createWorkspaceFixture();
    mkdirSync(join(workspace.root, "docs", "decisions"), { recursive: true });
    writeFileSync(
      join(workspace.root, "docs", "decisions", "0001-web-data-source.md"),
      `# Web Data Source

## Decision

Kairo v1 will use an in-process local API for the web dashboard.

## Rationale

SQLite ownership stays in \`@kairohq/core\`, where migrations and EventStore reads already live.
`,
    );
    const app = createDashboardApp({ workspace });

    const response = await app.request("/api/ask", {
      body: JSON.stringify({ question: "Why use a local API for the dashboard?" }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.answer).toContain("SQLite ownership stays in `@kairohq/core`");
    expect(body.citations[0]).toMatchObject({
      kind: "decision",
      reference: "adr:docs/decisions/0001-web-data-source.md",
    });
  });

  it("serves static dashboard files when a build directory is available", async () => {
    const { workspace } = createWorkspaceFixture();
    const webDistPath = mkdtempSync(join(tmpdir(), "kairo-web-dist-"));
    mkdirSync(join(webDistPath, "assets"));
    writeFileSync(join(webDistPath, "index.html"), "<main>Kairo dashboard</main>");
    writeFileSync(join(webDistPath, "assets", "app.js"), "console.log('kairo');");
    const app = createDashboardApp({ workspace, webDistPath });

    const index = await app.request("/");
    expect(index.status).toBe(200);
    expect(index.headers.get("content-type")).toBe("text/html; charset=utf-8");
    await expect(index.text()).resolves.toContain("Kairo dashboard");

    const asset = await app.request("/assets/app.js");
    expect(asset.status).toBe(200);
    expect(asset.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    await expect(asset.text()).resolves.toContain("kairo");

    const spaFallback = await app.request("/timeline/api-boundary");
    expect(spaFallback.status).toBe(200);
    await expect(spaFallback.text()).resolves.toContain("Kairo dashboard");

    const traversal = await app.request("/../package.json");
    expect(traversal.status).toBe(404);

    const malformedPath = await app.request("/%E0%A4%A");
    expect(malformedPath.status).toBe(404);
  });
});

function createWorkspaceFixture(): {
  workspace: Workspace;
  session: Session;
  event: GitCommitEvent;
  shift: ArchitectureShift;
} {
  const root = mkdtempSync(join(tmpdir(), "kairo-serve-"));
  const workspace = new Workspace(root);
  const config = workspace.init("Serve Fixture");
  const store = new EventStore(workspace.dbPath);

  const event: GitCommitEvent = {
    id: "11111111-1111-4111-8111-111111111111",
    projectId: config.projectId,
    occurredAt: "2026-05-18T10:00:00.000Z",
    observedAt: "2026-05-18T10:00:01.000Z",
    source: "git",
    kind: "git.commit",
    payload: {
      sha: "abc123",
      parentShas: [],
      author: "Ada",
      message: "feat: add local dashboard api",
      files: [{ path: "apps/cli/src/commands/serve.ts", status: "A", additions: 90, deletions: 0 }],
    },
  };

  const session: Session = {
    id: "22222222-2222-4222-8222-222222222222",
    projectId: config.projectId,
    title: "API Boundary",
    slug: "api-boundary",
    startedAt: "2026-05-18T10:00:00.000Z",
    endedAt: "2026-05-18T10:20:00.000Z",
    intent: "feature",
    themes: ["dashboard"],
    affectedAreas: ["apps/cli"],
    commitShas: ["abc123"],
    files: ["apps/cli/src/commands/serve.ts"],
    summary: "Added the dashboard API boundary.",
    architectureImpact: "Browser reads through a local API instead of opening SQLite directly.",
    eventIds: [event.id],
  };

  const shift: ArchitectureShift = {
    id: "33333333-3333-4333-8333-333333333333",
    projectId: config.projectId,
    detectedAt: "2026-05-18T10:25:00.000Z",
    kind: "api_redesign",
    title: "Local dashboard API",
    summary: "Dashboard data now has an explicit local API boundary.",
    affectedPaths: ["apps/cli/src/commands/serve.ts"],
    relatedSessionIds: [session.id],
  };

  store.append(event);
  store.appendSession(session);
  store.appendArchitectureShift(shift);
  store.close();

  return { workspace, session, event, shift };
}
