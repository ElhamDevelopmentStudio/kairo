import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AiProvider, CompleteInput } from "@kairo/ai";
import { EventStore, Workspace } from "@kairo/core";
import type { Session } from "@kairo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderAskAnswer, runAsk } from "./ask.ts";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "kairo-cli-ask-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("runAsk", () => {
  it("answers project-memory questions from real stored session data", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          projectId: config.projectId,
          slug: "cors-fix",
          title: "Payment CORS fix",
          summary:
            "Fixed payment verification CORS by returning preflight headers before auth handling.",
          files: ["apps/server/src/payment.ts"],
          commitShas: ["abc1234"],
        }),
      );
    } finally {
      store.close();
    }

    const answer = await runAsk("How did we fix payment CORS?", { ai: false }, root);

    expect(answer.citations[0]).toMatchObject({
      reference: "session:cors-fix",
      files: ["apps/server/src/payment.ts"],
      commitShas: ["abc1234"],
    });
    expect(renderAskAnswer(answer)).not.toContain("Evidence");
    expect(renderAskAnswer(answer, { showEvidence: true })).toContain("session:cors-fix");
    expect(renderAskAnswer(answer, { showEvidence: true })).toContain("commits: abc1234");
    expect(answer.answer).not.toContain("session:cors-fix");
  });

  it("answers decision questions from workspace ADR files", async () => {
    const workspace = new Workspace(root);
    workspace.init("demo");
    mkdirSync(join(root, "docs", "decisions"), { recursive: true });
    writeFileSync(
      join(root, "docs", "decisions", "0001-web-data-source.md"),
      `# Web Data Source

## Decision

Kairo v1 will use an in-process local API for the web dashboard.

## Rationale

SQLite ownership stays in \`@kairo/core\`, where migrations and EventStore reads already live.
`,
    );

    const answer = await runAsk("Why use a local API for the dashboard?", { ai: false }, root);

    expect(answer.citations[0]).toMatchObject({
      kind: "decision",
      reference: "adr:docs/decisions/0001-web-data-source.md",
    });
    expect(answer.answer).toContain("SQLite ownership stays in `@kairo/core`");
  });

  it("uses optional AI rerank before generating the final answer", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          id: "22222222-2222-4222-8222-222222222222",
          projectId: config.projectId,
          slug: "dashboard-styling",
          title: "Dashboard styling",
          summary: "Adjusted dashboard spacing and panel styling.",
        }),
      );
      store.appendSession(
        session({
          id: "33333333-3333-4333-8333-333333333333",
          projectId: config.projectId,
          slug: "local-api-boundary",
          title: "Local API boundary",
          summary: "Replaced direct SQLite dashboard reads with a local API boundary.",
          files: ["apps/cli/src/commands/serve.ts"],
        }),
      );
    } finally {
      store.close();
    }

    const calls: CompleteInput[] = [];
    const answer = await runAsk(
      "what replaced direct sqlite dashboard reads?",
      {
        aiProvider: fakeProvider(async (input) => {
          calls.push(input);
          return calls.length === 1
            ? '{"references":["session:local-api-boundary"]}'
            : "The dashboard now goes through the local API instead of reading SQLite directly.";
        }),
      },
      root,
    );

    expect(calls).toHaveLength(2);
    expect(answer.answer).toContain("local API");
    expect(answer.citations[0]?.reference).toBe("session:local-api-boundary");
  });

  it("falls back to deterministic retrieval when optional AI rerank or answering fails", async () => {
    const workspace = new Workspace(root);
    const config = workspace.init("demo");
    const store = new EventStore(workspace.dbPath);
    try {
      store.appendSession(
        session({
          projectId: config.projectId,
          slug: "cors-fix",
          title: "Payment CORS fix",
          summary:
            "Fixed payment verification CORS by returning preflight headers before auth handling.",
        }),
      );
    } finally {
      store.close();
    }

    const answer = await runAsk(
      "How did we fix payment CORS?",
      {
        aiProvider: fakeProvider(async () => {
          throw new Error("provider offline");
        }),
      },
      root,
    );

    expect(answer.answer).toContain("Payment CORS fix");
    expect(answer.citations[0]?.reference).toBe("session:cors-fix");
  });
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

function fakeProvider(complete: (input: CompleteInput) => Promise<string>): AiProvider {
  return {
    name: "minimax",
    async complete(input) {
      return { text: await complete(input), model: "fake", provider: "minimax" };
    },
    async summarize() {
      throw new Error("ask should not summarize");
    },
    async embed() {
      throw new Error("ask should not embed");
    },
  };
}
