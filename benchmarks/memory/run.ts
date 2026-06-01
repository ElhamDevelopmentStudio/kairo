import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  EventStore,
  type MemoryBenchmarkReport,
  answerProjectMemory,
  runMemoryBenchmark,
} from "../../packages/core/src/index.ts";
import {
  MEMORY_BENCHMARK_PROJECT_ID,
  memoryBenchmarkCases,
  memoryBenchmarkDecisions,
  seedMemoryBenchmarkStore,
} from "./fixtures.ts";

const mode = process.argv.includes("--rerank-fixture") ? "rerank-fixture" : "deterministic";
const json = process.argv.includes("--json");
const tmp = mkdtempSync(join(tmpdir(), "kairo-memory-benchmark-"));
const store = new EventStore(join(tmp, "benchmark.db"));

try {
  seedMemoryBenchmarkStore(store);
  const report = await runMemoryBenchmark(
    memoryBenchmarkCases,
    (item) =>
      answerProjectMemory(store, MEMORY_BENCHMARK_PROJECT_ID, item.question, {
        limit: 5,
        now: "2026-05-31T12:00:00.000Z",
        decisionMemories: memoryBenchmarkDecisions,
      }),
    { mode },
  );
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
} finally {
  store.close();
  rmSync(tmp, { recursive: true, force: true });
}

function printReport(report: MemoryBenchmarkReport): void {
  console.log(`Memory retrieval benchmark (${report.mode})`);
  console.log(`cases: ${report.caseCount}`);
  console.log(`recall@${report.k}: ${percent(report.recallAtK)}`);
  console.log(`citation coverage: ${percent(report.citationCoverage)}`);
  console.log(`unsupported abstention: ${percent(report.unsupportedAbstention)}`);
  console.log(`avg latency: ${report.averageLatencyMs.toFixed(1)}ms`);
  for (const result of report.results) {
    const mark = result.citationCovered || result.abstained ? "ok" : "miss";
    console.log(`- ${mark} ${result.id}: ${result.actualReferences.join(", ") || "abstained"}`);
  }
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
