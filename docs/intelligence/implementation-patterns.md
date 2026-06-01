# Intelligence Layer Implementation Patterns

This document records implementation patterns from adjacent memory and
developer-intelligence systems without naming those systems. The goal is to
capture useful architecture, not to preserve a public dependency trail.

Kairo should adapt these patterns to its own product shape: local-first project
memory, raw evidence preservation, and citation-backed answers about software
evolution.

## Non-Conflict Rules

- Raw evidence is the source of truth. Summaries, bridge documents, project
  models, graph facts, and reflections are indexes over evidence.
- Retrieval is a pipeline, not a replacement hierarchy. Keyword, semantic,
  graph, temporal, path, and problem-fingerprint signals should boost or rerank
  candidates unless a task explicitly requires a hard filter.
- CLI remains headless. Frontend and desktop surfaces visualize memory but do
  not own observation, storage, retrieval, or answer generation.
- AI is optional. AI can summarize, rerank, extract topics, or draft answers,
  but deterministic local retrieval must still work.
- Every synthesized claim needs a citation or an explicit uncertainty marker.
- Public/product language should describe Kairo's own implementation, not these
  external references.

## Pattern 1: Raw Evidence First

Observed approach:

- Store original conversation, document, or event text as the durable record.
- Add summaries and extracted fields as secondary indexes.
- Retrieve against both raw text and index documents.
- Keep enough metadata to trace any answer back to the original record.

Kairo approach:

- Preserve git events, commits, diffs, terminal events, hook payloads, ADRs,
  generated session records, and agent transcript fragments as raw evidence.
- Store `SessionMemory`, `ProblemMemory`, `FixMemory`, `DecisionMemory`,
  `ArchitectureShiftMemory`, `SymbolMemory`, and `AgentRunMemory` as derived
  records with stable evidence references.
- Make the answer layer cite raw records, not bridge documents.

Why it matters:

- LLM extraction can lose the reason, tradeoff, and negative evidence around a
  decision.
- Developers trust answers more when they can inspect the exact commit,
  terminal output, ADR, or session that supports the claim.

## Pattern 2: Hybrid Retrieval Pipeline

Observed approach:

- Start with a broad semantic candidate set.
- Add sparse keyword/BM25 scoring for exact phrases, identifiers, and error
  strings.
- Add temporal boosts for date-like query language.
- Add entity/path/category boosts instead of filtering too early.
- Optionally ask an AI reranker to select the strongest candidate from the top
  set.
- If an optional stage fails, return the previous ranking unchanged.

Kairo approach:

1. Retrieve broad candidates from semantic vectors and keyword/BM25.
2. Add code-native scores: file path, package, symbol, command, commit, branch,
   ADR, test name, and error fingerprint overlap.
3. Parse temporal language such as "last week", "before the dashboard split",
   and "when this error first appeared".
4. Use graph traversal to add candidate memories connected through
   `fixes`, `caused_by`, `supersedes`, `depends_on`, and `explained_by`.
5. Optionally rerank the top candidates through `@kairohq/ai`.
6. Generate answers only from candidates with citation-ready evidence.

Implementation notes:

- Retrieval signals should be inspectable in debug output.
- Hard filters should be rare because a wrong classifier can hide the correct
  evidence.
- Exact identifiers and stack traces deserve strong sparse-search treatment;
  embeddings alone are weak for these.

## Pattern 3: Layered Memory

Observed approach:

- Systems that perform well often separate raw logs, extracted facts, scenarios,
  and long-lived profiles.
- Higher layers are compact and useful, but can be rebuilt from lower layers.

Kairo approach:

- L0 raw evidence: git, file, terminal, hook, ADR, transcript, test, and CI
  records.
- L1 atoms: changed files, commands, errors, symbols, packages, decisions,
  events, entities, and relationships.
- L2 scenarios: named work episodes such as "PDF rendering fix", "CORS
  incident", "dashboard routing refactor", or "CLI/frontend boundary split".
- L3 project operating model: current architecture, conventions, fragile areas,
  recurring failures, risk map, setup commands, contributor guidance, and
  recently superseded decisions.

Implementation notes:

- Each layer stores provenance to lower layers.
- Rebuild commands should regenerate L1-L3 from L0.
- `kairo ask` should be able to mix all layers but cite the lowest useful
  evidence.

## Pattern 4: Temporal Knowledge Graph

Observed approach:

- Memory systems improve when entities and relationships are represented with
  time validity.
- Facts are not simply overwritten; old facts are expired or superseded.
- Graph traversal provides context that vector search misses.

Kairo approach:

- Store project entities: packages, modules, files, symbols, APIs, endpoints,
  database tables, env vars, commands, errors, commits, ADRs, sessions, agents,
  and tests.
- Store typed relationships: `fixes`, `caused_by`, `supersedes`, `depends_on`,
  `implements`, `touches`, `introduces_risk`, `explained_by`, and `renamed_to`.
- Include `valid_from`, `valid_to`, confidence, source IDs, and extraction
  method.

Implementation notes:

- SQLite is the default graph store for local-first operation.
- Keep graph facts small and queryable; large source text stays in evidence
  tables.
- As-of queries should answer what was true at a point in project history.

## Pattern 5: Synthetic Bridge Documents

Observed approach:

- Some systems create compact topic/profile/preference documents at ingest time
  to bridge vocabulary gaps.
- These synthetic documents share IDs with the source records so retrieval can
  map back to evidence.

Kairo approach:

- Generate bridge docs per session and scenario:
  - touched features
  - problem fixed
  - decision made
  - risk introduced
  - relevant files, packages, symbols, commands, and errors
  - likely future query phrases
- Embed bridge docs separately but return the underlying evidence ID.

Implementation notes:

- Bridge docs can be deterministic first and AI-enhanced later.
- Partial coverage can bias retrieval. Track bridge-doc coverage and prefer
  consistent generation for all sessions.
- Bridge docs are not citation sources.

## Pattern 6: Supersession And Contradiction Handling

Observed approach:

- Strong memory systems model facts as evolving over time.
- They preserve old facts but mark them as outdated when newer evidence wins.

Kairo approach:

- Detect supersession in ADRs, commits, architecture shifts, setup commands,
  dependency changes, and project conventions.
- Answer with phrasing like: "This used to be true, but was superseded by..."
- Keep stale facts searchable so developers can understand historical context.

Implementation notes:

- Prefer explicit supersession markers from ADRs and commit messages.
- Infer supersession only when evidence is strong and carry confidence.
- Contradiction does not mean deletion; it means time-scoped truth.

## Pattern 7: Symbol-Time Intelligence

Observed approach:

- Developer tools are strongest when they understand symbols and current code
  structure.
- Memory systems are strongest when they understand history.

Kairo approach:

- Combine symbol extraction with git/session history.
- Answer:
  - why a function exists
  - when an API changed
  - what broke last time a file was touched
  - which session introduced a pattern
  - which decisions explain a module boundary

Implementation notes:

- Start with TypeScript/JavaScript static extraction.
- Store symbol identity through renames and moves where possible.
- Add language-server adapters later without blocking the first pass.

## Pattern 8: Project Reflection

Observed approach:

- Useful memory systems do not only answer questions; they proactively
  summarize risks, patterns, and recurring lessons.

Kairo approach:

- Add reflection commands:
  - `kairo reflect risks`
  - `kairo reflect architecture`
  - `kairo reflect repeated-errors`
  - `kairo reflect contributor-map`
  - `kairo reflect release-readiness`
- Use the same retrieval and citation rules as `kairo ask`.

Implementation notes:

- Reflections should be concise and evidence-backed.
- Reflections should label confidence and unknowns.
- Reflections should not invent tasks when evidence is thin.

## Pattern 9: Memory Checks

Observed approach:

- Some developer tools turn AI/code intelligence into repeatable checks.
- The useful checks are narrow, evidence-backed, and quiet by default.

Kairo approach:

- Add `kairo check memory` for advisory checks:
  - repeated error appears again
  - broad architecture shift lacks an ADR
  - setup docs mention commands that no longer work
  - PR touches known fragile files
  - change contradicts current project operating model

Implementation notes:

- Checks should produce citations and suggested next evidence to inspect.
- Checks should be warnings, not hard blockers, unless the team opts in.
- CI integration should be documented but optional.

## Pattern 10: Source Adapter Contract

Observed approach:

- Extensible systems define adapter contracts for ingesting new sources.
- Good adapters declare schema, privacy class, supported ingest modes,
  cursor/versioning behavior, and transformations.
- Conformance tests make outside contributions reviewable.

Kairo approach:

- First-party adapters:
  - Kairo sessions
  - git history
  - terminal events
  - ADR folders
  - AI hook transcripts
  - local project files
  - CI logs
  - issue/PR exports
- Contributor adapters can target external editors, agents, trackers, and
  knowledge tools.

Implementation notes:

- Core should call adapters through a registry, not `if source_type` branches.
- Adapters should be explicit about redaction, truncation, line normalization,
  and lossy transforms.
- The adapter template should include fixture data and a conformance test.

## Pattern 11: Benchmarks And Held-Out Fixtures

Observed approach:

- High-quality memory projects measure retrieval recall, ranking, citation
  quality, abstention, and latency.
- The best systems separate tuning fixtures from held-out fixtures.

Kairo approach:

- Create KairoBench with categories:
  - architecture-why
  - problem/fix recall
  - temporal project questions
  - renamed-file questions
  - exact error strings
  - symbol history
  - decision citation accuracy
  - unsupported-answer abstention
  - dashboard/CLI boundary questions

Implementation notes:

- Benchmarks should run offline by default.
- Optional AI rerank fixtures should use fake or recorded providers.
- Do not tune a heuristic only because it fixes one inspected miss; tie tuning
  to a declared failure category.

## Contributor Magnet

The intelligence layer should expose obvious contribution lanes:

- Add a source adapter.
- Add a benchmark fixture category.
- Add a symbol extractor for a language.
- Add a memory check.
- Add bridge-doc generation for a new evidence type.
- Add graph relationship extraction for a known source.
- Improve citation rendering in CLI, MCP, or dashboard.

Each lane should have a small template, fixture, and expected verification
command. This makes the project more attractive to contributors because they
can make meaningful improvements without understanding the entire system.
