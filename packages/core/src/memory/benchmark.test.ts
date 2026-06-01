import type { MemoryAnswer } from "@kairo/shared";
import { describe, expect, it } from "vitest";
import { type MemoryBenchmarkCase, runMemoryBenchmark } from "./benchmark.ts";

describe("runMemoryBenchmark", () => {
  it("reports recall, citation coverage, abstention, and deterministic latency", async () => {
    const cases: MemoryBenchmarkCase[] = [
      {
        id: "architecture-boundary",
        category: "architecture-why",
        question: "why did the dashboard split?",
        expectedReferences: ["architecture:split"],
      },
      {
        id: "unsupported",
        category: "unsupported",
        question: "what database did we use in 2019?",
        expectedReferences: [],
        unsupported: true,
      },
    ];
    const ticks = [0, 5, 5, 8];

    const report = await runMemoryBenchmark(
      cases,
      (item) =>
        item.unsupported === true
          ? answer(item.question, [])
          : answer(item.question, ["architecture:split", "session:dashboard"]),
      {
        nowMs: () => {
          const value = ticks.shift();
          if (value === undefined) throw new Error("unexpected benchmark clock read");
          return value;
        },
      },
    );

    expect(report).toMatchObject({
      mode: "deterministic",
      caseCount: 2,
      recallAtK: 1,
      citationCoverage: 1,
      unsupportedAbstention: 1,
      averageLatencyMs: 4,
    });
  });

  it("can apply optional rerank fixtures without calling an AI provider", async () => {
    const report = await runMemoryBenchmark(
      [
        {
          id: "rerank",
          category: "decision-citation",
          question: "what superseded direct reads?",
          expectedReferences: ["adr:new"],
          rerankReferences: ["adr:new"],
        },
      ],
      (item) => answer(item.question, ["adr:old", "adr:new"]),
      { mode: "rerank-fixture", nowMs: fixedClock(0, 1) },
    );

    expect(report.results[0]?.actualReferences).toEqual(["adr:new", "adr:old"]);
    expect(report.recallAtK).toBe(1);
  });
});

function answer(question: string, references: string[]): MemoryAnswer {
  return {
    question,
    answer: references.length === 0 ? "Not enough evidence." : "Found evidence.",
    confidence: references.length === 0 ? "low" : "high",
    citations: references.map((reference, index) => ({
      kind: reference.startsWith("architecture:") ? "architecture_shift" : "decision",
      id: String(index),
      title: reference,
      reference,
      commitShas: [],
      eventIds: [],
      files: [],
      score: 10 - index,
    })),
  };
}

function fixedClock(...values: number[]): () => number {
  return () => {
    const value = values.shift();
    if (value === undefined) throw new Error("unexpected benchmark clock read");
    return value;
  };
}
