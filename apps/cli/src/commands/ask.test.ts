import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
    expect(renderAskAnswer(answer)).toContain("session:cors-fix");
    expect(renderAskAnswer(answer)).toContain("commits: abc1234");
    expect(answer.answer).toContain("session:cors-fix");
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
