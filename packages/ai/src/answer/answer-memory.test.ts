import type { MemoryAnswer } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { answerMemoryWithAi } from "./answer-memory.ts";

describe("answerMemoryWithAi", () => {
  it("generates a natural-language answer from grounded citations", async () => {
    const answer = await answerMemoryWithAi(grounded, {
      provider: {
        name: "minimax",
        async complete(input) {
          expect(input.system).toContain("using only Kairo evidence");
          expect(input.system).toContain("simple user-facing language");
          expect(input.prompt).toContain("commit:abc123");
          return {
            text: "The API moved to GraphQL so the project could stop duplicating request-shaping logic across REST routes.",
            model: "MiniMax-M2.7",
            provider: "minimax",
          };
        },
        async summarize() {
          throw new Error("answering should use provider.complete");
        },
        async embed() {
          return { embedding: [], model: "test", provider: "minimax" };
        },
      },
    });

    expect(answer.answer).toContain("stop duplicating request-shaping logic");
    expect(answer.citations).toEqual(grounded.citations);
  });

  it("does not append evidence references to normal user-facing answers", async () => {
    const answer = await answerMemoryWithAi(grounded, {
      provider: {
        name: "minimax",
        async complete() {
          return {
            text: "The API moved to GraphQL to reduce duplicated REST request shaping.",
            model: "MiniMax-M2.7",
            provider: "minimax",
          };
        },
        async summarize() {
          throw new Error("answering should use provider.complete");
        },
        async embed() {
          return { embedding: [], model: "test", provider: "minimax" };
        },
      },
    });

    expect(answer.answer).not.toContain("Evidence:");
    expect(answer.answer).not.toContain("commit:abc123");
    expect(answer.answer).not.toContain("event:event-1");
    expect(answer.answer).not.toContain("file:apps/api/src/graphql/schema.ts");
  });

  it("keeps abstention answers local when there is no evidence", async () => {
    await expect(
      answerMemoryWithAi({
        question: "Why?",
        answer: "No evidence.",
        citations: [],
        confidence: "low",
      }),
    ).resolves.toMatchObject({
      answer: "No evidence.",
      citations: [],
    });
  });
});

const grounded: MemoryAnswer = {
  question: "Why did we switch from REST to GraphQL?",
  answer: "Based on stored project memory...",
  confidence: "medium",
  citations: [
    {
      kind: "commit",
      id: "event-1",
      title: "refactor: switch REST API to GraphQL",
      reference: "commit:abc123",
      excerpt: "refactor: switch REST API to GraphQL because duplicate request shaping",
      files: ["apps/api/src/graphql/schema.ts"],
      commitShas: ["abc123"],
      eventIds: ["event-1"],
      score: 12,
    },
  ],
};
