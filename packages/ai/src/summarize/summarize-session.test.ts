import { describe, expect, it } from "vitest";
import { summarizeSession } from "./summarize-session.ts";

describe("summarizeSession", () => {
  it("delegates to the selected provider", async () => {
    await expect(
      summarizeSession(session, [], {
        provider: {
          name: "ollama",
          async summarize(input) {
            expect(input.prompt).toContain("Summarize this Kairo development session");
            return { text: "summary", model: "test", provider: "ollama" };
          },
          async embed() {
            return { embedding: [], model: "test", provider: "ollama" };
          },
        },
      }),
    ).resolves.toEqual({ text: "summary", model: "test", provider: "ollama" });
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
