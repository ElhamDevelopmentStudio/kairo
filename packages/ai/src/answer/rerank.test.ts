import { describe, expect, it } from "vitest";
import type { AiProvider, CompleteInput } from "../provider/index.ts";
import { rerankMemoryEvidence } from "./rerank.ts";

describe("rerankMemoryEvidence", () => {
  it("reorders citations from provider-selected references", async () => {
    const seen: CompleteInput[] = [];
    const answer = await rerankMemoryEvidence(grounded(), {
      provider: fakeProvider(async (input) => {
        seen.push(input);
        return '{"references":["session:better","session:ok"]}';
      }),
    });

    expect(seen[0]?.prompt).toContain("session:better");
    expect(answer.citations.map((citation) => citation.reference)).toEqual([
      "session:better",
      "session:ok",
      "session:weak",
    ]);
  });

  it("keeps deterministic order when provider output is invalid", async () => {
    const original = grounded();
    const answer = await rerankMemoryEvidence(original, {
      provider: fakeProvider(async () => '{"references":["missing"]}'),
    });

    expect(answer.citations.map((citation) => citation.reference)).toEqual(
      original.citations.map((citation) => citation.reference),
    );
  });

  it("keeps deterministic order when rerank times out", async () => {
    const original = grounded();
    const answer = await rerankMemoryEvidence(original, {
      provider: fakeProvider(() => new Promise(() => {})),
      timeoutMs: 1,
    });

    expect(answer.citations.map((citation) => citation.reference)).toEqual(
      original.citations.map((citation) => citation.reference),
    );
  });

  it("keeps deterministic order when no provider is supplied", async () => {
    const original = grounded();
    const answer = await rerankMemoryEvidence(original, { provider: null });

    expect(answer).toBe(original);
  });
});

function fakeProvider(complete: (input: CompleteInput) => Promise<string>): AiProvider {
  return {
    name: "minimax",
    async complete(input) {
      return { text: await complete(input), model: "fake", provider: "minimax" };
    },
    async summarize() {
      throw new Error("rerank should not summarize");
    },
    async embed() {
      throw new Error("rerank should not embed");
    },
  };
}

function grounded() {
  return {
    question: "What replaced the old dashboard API?",
    answer: "Deterministic answer.",
    confidence: "medium" as const,
    citations: [
      {
        kind: "session" as const,
        id: "1",
        title: "Weak match",
        reference: "session:weak",
        excerpt: "Mentioned dashboard styling.",
        files: [],
        commitShas: [],
        eventIds: [],
        score: 5,
      },
      {
        kind: "session" as const,
        id: "2",
        title: "Better match",
        reference: "session:better",
        excerpt: "Replaced direct SQLite dashboard reads with a local API.",
        files: ["apps/cli/src/commands/serve.ts"],
        commitShas: [],
        eventIds: [],
        score: 4,
      },
      {
        kind: "decision" as const,
        id: "3",
        title: "API decision",
        reference: "session:ok",
        excerpt: "Dashboard data should use the local API boundary.",
        files: [],
        commitShas: [],
        eventIds: [],
        score: 3,
      },
    ],
  };
}
