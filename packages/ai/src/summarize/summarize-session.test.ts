import { describe, expect, it } from "vitest";
import summaryFixture from "./fixtures/session-summary.json";
import { applySessionSummary, parseSessionSummary, summarizeSession } from "./summarize-session.ts";

describe("summarizeSession", () => {
  it("delegates to the selected provider", async () => {
    await expect(
      summarizeSession(session, [], {
        provider: {
          name: "ollama",
          async complete() {
            return { text: "", model: "test", provider: "ollama" };
          },
          async summarize(input) {
            expect(input.prompt).toContain("strict JSON");
            return { text: JSON.stringify(summaryFixture), model: "test", provider: "ollama" };
          },
          async embed() {
            return { embedding: [], model: "test", provider: "ollama" };
          },
        },
      }),
    ).resolves.toEqual({
      summary: summaryFixture,
      model: "test",
      provider: "ollama",
      rawText: JSON.stringify(summaryFixture),
    });
  });

  it("parses and applies structured summary fields", () => {
    const parsed = parseSessionSummary(JSON.stringify(summaryFixture));

    expect(applySessionSummary(session, parsed)).toMatchObject({
      title: "Authentication Rewrite",
      intent: "refactor",
      themes: ["auth", "middleware", "token-rotation"],
      affectedAreas: ["packages/auth", "apps/web/middleware"],
      summary:
        "Consolidated auth validation into one package and aligned token rotation across runtime boundaries.",
      architectureImpact:
        "One verifier now serves the web and middleware surfaces, reducing duplicated auth behavior.",
    });
  });
});

const session = {
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "p1",
  title: "Session",
  slug: "2026-05-20-session",
  startedAt: "2026-05-20T10:00:00.000Z",
  endedAt: "2026-05-20T10:10:00.000Z",
  intent: "unknown",
  themes: [],
  affectedAreas: [],
  commitShas: [],
  files: [],
  summary: null,
  architectureImpact: null,
  eventIds: [],
} as const;
