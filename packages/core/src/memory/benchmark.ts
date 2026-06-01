import type { MemoryAnswer, MemoryCitation } from "@kairohq/shared";

export type MemoryBenchmarkCategory =
  | "architecture-why"
  | "problem-fix"
  | "temporal"
  | "renamed-file"
  | "exact-error"
  | "agent-transcript"
  | "decision-citation"
  | "unsupported";

export interface MemoryBenchmarkCase {
  id: string;
  category: MemoryBenchmarkCategory;
  question: string;
  expectedReferences: string[];
  unsupported?: boolean;
  rerankReferences?: string[];
}

export interface MemoryBenchmarkCaseResult {
  id: string;
  category: MemoryBenchmarkCategory;
  question: string;
  expectedReferences: string[];
  actualReferences: string[];
  recallAtK: number;
  citationCovered: boolean;
  abstained: boolean;
  latencyMs: number;
}

export interface MemoryBenchmarkReport {
  mode: "deterministic" | "rerank-fixture";
  k: number;
  caseCount: number;
  recallAtK: number;
  citationCoverage: number;
  unsupportedAbstention: number;
  averageLatencyMs: number;
  results: MemoryBenchmarkCaseResult[];
}

export interface RunMemoryBenchmarkOptions {
  mode?: "deterministic" | "rerank-fixture";
  k?: number;
  nowMs?: () => number;
}

export async function runMemoryBenchmark(
  cases: MemoryBenchmarkCase[],
  answerCase: (item: MemoryBenchmarkCase) => MemoryAnswer | Promise<MemoryAnswer>,
  options: RunMemoryBenchmarkOptions = {},
): Promise<MemoryBenchmarkReport> {
  const mode = options.mode ?? "deterministic";
  const k = options.k ?? 5;
  const nowMs = options.nowMs ?? (() => performance.now());
  const results: MemoryBenchmarkCaseResult[] = [];

  for (const item of cases) {
    const start = nowMs();
    const rawAnswer = await answerCase(item);
    const answer = mode === "rerank-fixture" ? applyRerankFixture(rawAnswer, item) : rawAnswer;
    const latencyMs = Math.max(0, nowMs() - start);
    results.push(scoreCase(item, answer, k, latencyMs));
  }

  const supported = results.filter((result) => !caseById(cases, result.id).unsupported);
  const unsupported = results.filter((result) => caseById(cases, result.id).unsupported);
  return {
    mode,
    k,
    caseCount: results.length,
    recallAtK: average(supported.map((result) => result.recallAtK)),
    citationCoverage: average(supported.map((result) => (result.citationCovered ? 1 : 0))),
    unsupportedAbstention: average(unsupported.map((result) => (result.abstained ? 1 : 0))),
    averageLatencyMs: average(results.map((result) => result.latencyMs)),
    results,
  };
}

function scoreCase(
  item: MemoryBenchmarkCase,
  answer: MemoryAnswer,
  k: number,
  latencyMs: number,
): MemoryBenchmarkCaseResult {
  const actualReferences = answer.citations.slice(0, k).map((citation) => citation.reference);
  const expected = new Set(item.expectedReferences);
  const hits = actualReferences.filter((reference) => expected.has(reference));
  return {
    id: item.id,
    category: item.category,
    question: item.question,
    expectedReferences: item.expectedReferences,
    actualReferences,
    recallAtK:
      item.expectedReferences.length === 0 ? 1 : hits.length / item.expectedReferences.length,
    citationCovered: item.expectedReferences.length === 0 || hits.length > 0,
    abstained: answer.citations.length === 0,
    latencyMs,
  };
}

function applyRerankFixture(answer: MemoryAnswer, item: MemoryBenchmarkCase): MemoryAnswer {
  if (item.rerankReferences === undefined || item.rerankReferences.length === 0) return answer;
  const byReference = new Map(answer.citations.map((citation) => [citation.reference, citation]));
  const selected = item.rerankReferences
    .map((reference) => byReference.get(reference))
    .filter((citation): citation is MemoryCitation => citation !== undefined);
  if (selected.length === 0) return answer;
  const selectedRefs = new Set(selected.map((citation) => citation.reference));
  return {
    ...answer,
    citations: [
      ...selected,
      ...answer.citations.filter((citation) => !selectedRefs.has(citation.reference)),
    ],
  };
}

function caseById(cases: MemoryBenchmarkCase[], id: string): MemoryBenchmarkCase {
  const item = cases.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`Unknown memory benchmark case: ${id}`);
  return item;
}

function average(values: number[]): number {
  if (values.length === 0) return 1;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
