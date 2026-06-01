# Memory Retrieval Benchmarks

Kairo uses local, deterministic retrieval benchmarks before tuning memory
heuristics. The fixture corpus lives in `benchmarks/memory/fixtures.ts` and is
seeded into a temporary SQLite EventStore by `benchmarks/memory/run.ts`.

Run:

```sh
pnpm exec tsx benchmarks/memory/run.ts
pnpm exec tsx benchmarks/memory/run.ts --json
pnpm exec tsx benchmarks/memory/run.ts --rerank-fixture --json
```

The default mode is fully offline and uses deterministic hybrid retrieval.
`--rerank-fixture` applies declared reference ordering from the fixture file, so
rerank behavior can be measured without calling an AI provider.

The current corpus covers:

- architecture-why questions
- problem/fix recall
- temporal questions
- renamed files
- exact error strings
- assistant transcript recall
- decision citations
- unsupported-answer abstention

Reports include `recall@k`, citation coverage, unsupported-answer abstention,
average latency, and per-case references. Tune only against declared fixture
categories and keep a held-out set before changing ranking heuristics.
