# TASKS.md — Kairo phased plan

> Read `AGENTS.md` before touching code. It defines folder conventions, the
> Sharing Law, type centralization rules, and testing approach. This file
> tells you *what* to build; AGENTS.md tells you *how*.
>
> **Phase rules:**
> - Tasks in a phase can run in any order unless marked **(blocks: X.Y)**.
> - Finish all tasks in a phase before starting the next phase.
> - Each phase ends in a tangible, demoable milestone — see "Milestone" at
>   the end of each phase.
> - Each task: ~30 minutes to 2 hours of focused work. If it's bigger, split it.
> - Per-task tests: only the ones the task touches. Full suite at phase boundary.

---

## Phase 0 — Convention foundation

**Goal:** the repo conforms to the conventions in `AGENTS.md` so every later
phase plugs into a clean skeleton.

### 0.1 — Move binaries to `apps/` ✅

- [x] **Goal:** apps live in `apps/`, libraries in `packages/`.
- **Files:**
  - Move `packages/cli/` → `apps/cli/`.
  - Move `packages/mcp/` → `apps/mcp/`.
  - Update `pnpm-workspace.yaml` (already includes `apps/*`).
  - Update root `tsconfig.json` references.
  - Update `apps/cli/tsconfig.json` and `apps/mcp/tsconfig.json` relative paths
    (`../../tsconfig.base.json`, `../../packages/shared`, etc.).
- **Acceptance:** `pnpm install` succeeds, `pnpm typecheck` clean, `kairo --help`
  works via `pnpm --filter @kairo/cli dev --help`.
- **Tests:** none new — typecheck is the test.
- **Notes:** This is mechanical. Don't refactor code while moving.

### 0.2 — Create `packages/utils` ✅

- [x] **Goal:** a home for cross-cutting pure helpers exists before anything needs one.
- **Files:**
  - `packages/utils/package.json` (`@kairo/utils`, deps: none).
  - `packages/utils/tsconfig.json` (composite, extends base).
  - `packages/utils/src/index.ts` (empty re-exports).
  - `packages/utils/src/date/` — `format.ts` + `format.test.ts` for `toIsoDate`, `relativeTime`.
  - `packages/utils/src/slug/` — `slugify.ts` + tests.
  - `packages/utils/src/fs/` — `ensure-dir.ts`, `read-json.ts`, `write-json.ts` + tests.
- **Acceptance:** `pnpm --filter @kairo/utils test` passes; the package is
  importable as `@kairo/utils` from other packages.
- **Tests:** unit tests for every exported helper. Pure functions, easy.
- **Notes:** Resist the urge to add a helper "just in case." Add only what
  Phase 1 will use: date formatting, slug generation, dir creation, JSON read/write.

### 0.3 — Vitest at the root ✅

- [x] **Goal:** one shared test runner config; every package writes `*.test.ts`.
- **Files:**
  - Root `package.json`: add `"vitest": "^2.x"` devDep, `"test": "vitest run"`,
    `"test:watch": "vitest"`.
  - Root `vitest.config.ts`: globs include `packages/*/src/**/*.test.ts` and
    `apps/*/src/**/*.test.ts`.
  - Each package's `package.json`: `"test": "vitest run"` script.
- **Acceptance:** `pnpm test` from the repo root runs every test in the repo.
- **Tests:** add one trivial passing test in `@kairo/utils` to prove the setup.
- **Notes:** No need for `tsx` integration — Vitest handles TS natively.

### 0.4 — Biome for lint + format ✅

- [x] **Goal:** one tool replaces ESLint + Prettier. Fast, zero config drift.
- **Files:**
  - Root `biome.json` with TS preset, 2-space indent matching `.editorconfig`.
  - Root `package.json`: `"lint": "biome check ."`, `"format": "biome format --write ."`.
  - Add Biome to root devDeps.
- **Acceptance:** `pnpm lint` reports zero errors on the existing tree.
- **Tests:** none.
- **Notes:** If Biome flags scaffolded code, fix the code, not the config.

### 0.5 — `pnpm doctor` ✅

- [x] **Goal:** one command verifies the whole repo is healthy.
- **Files:**
  - Root `package.json`: `"doctor": "turbo run typecheck lint test --concurrency=10"`.
- **Acceptance:** `pnpm doctor` runs typecheck + lint + test for every workspace package; exits 0.
- **Tests:** none new.
- **Notes:** This becomes the CI entrypoint in Phase 7.

### 0.6 — Centralize cross-package types ✅

- [x] **Goal:** `@kairo/shared` is the only place cross-package types live.
- **Files:**
  - Audit `apps/cli`, `apps/mcp`, `packages/core` for any type that should be
    shared (currently fine — `Workspace` types are package-local). Document
    findings in this task entry if anything moves.
- **Acceptance:** no type appears in two packages with the same name.
- **Tests:** typecheck.
- **Notes:** Re-run this audit at the end of every phase.

**Milestone:** `pnpm install && pnpm doctor` is green. Repo conforms to AGENTS.md. ✅

**Phase 0 notes (2026-05-18):**
- Dropped TypeScript project references / `composite: true`. v0 runs from source via
  `tsx` and Vitest; project refs added build/incremental complexity without payoff.
  Re-introduce when Phase 7 adds npm publishing.
- `tsconfig.base.json` sets `allowImportingTsExtensions: true` + `noEmit: true` so
  imports can use `.ts` suffixes (required by Node ESM resolver under tsx/Vitest).
  This implies `pnpm build` is currently a no-op typecheck — Phase 7 will override
  `noEmit` per package when wiring publishing.
- Restructured `packages/core` modules into folders per AGENTS.md §4.3 (workspace,
  event-store, observers/git, observers/file, session-reconstructor). Each has
  `index.ts` re-exporting only the public surface. GitObserver and FileObserver
  do not yet have unit tests — deferred to Phase 1.1 / Phase 2.1 where they get
  fleshed out with real fixtures.
- `Workspace` was refactored to consume `@kairo/utils/fs` (`ensureDir`, `readJson`,
  `writeJson`) — first proof of the Sharing Law in action.
- Type audit (0.6): no cross-package duplicates. Package-local types
  (`WorkspaceConfig`, `FileEventHandler`, `SessionReconstructorOptions`) stay
  in `@kairo/core`; they have no second caller yet.
- Tests today: 30 passing (`@kairo/utils` 17, `@kairo/core` 13). `apps/cli`,
  `apps/mcp`, `@kairo/shared` have no tests yet (commands and tools are stubs
  filled in starting Phase 1).

---

## Phase 1 — End-to-end git timeline ("the aha moment")

**Goal:** point Kairo at any git repo, run `kairo sweep`, get `.kairo/timeline.md`
+ per-session markdown files that describe the project's evolution.

### 1.1 — Flesh out `GitObserver` ✅

- [x] **Goal:** commit events carry parents and file-level diff stats.
- **Files:** `packages/core/src/observers/git/git-observer.ts` (move from current
  flat location into a folder per the AGENTS.md module convention).
- **Acceptance:** `commitsSince()` returns events whose `payload.parentShas` and
  `payload.files` are populated. `files[]` has `path`, `status`, `additions`, `deletions`.
- **Tests:** `git-observer.test.ts` runs against a fixture repo created in
  `test/fixtures/` via shell helper. Verifies parent SHAs and file stats.
- **Notes:** Use `git log --pretty=format:%H|%P|%an|%aI|%s` + `git show --name-status --numstat <sha>`,
  parse both. Or use `simple-git`'s `raw(['show', '--name-status', '--numstat', sha])`.

### 1.2 — Markdown render module ✅

- [x] **Goal:** pure functions turn Sessions into markdown.
- **Files:**
  - `packages/core/src/render/index.ts` (public surface).
  - `packages/core/src/render/timeline.ts` — `renderTimeline(sessions: Session[]): string`.
  - `packages/core/src/render/session.ts` — `renderSession(session: Session, events: KairoEvent[]): string`.
  - Tests with snapshots: `timeline.test.ts`, `session.test.ts`.
- **Acceptance:** functions are pure (no I/O), output matches snapshots,
  output shape matches `templates/kairo-workspace/`.
- **Tests:** snapshot tests on a handful of fixture sessions.
- **Notes:** Keep markdown stable — diffs in `.kairo/timeline.md` should be
  meaningful, not churn. Sort sessions newest-first.

### 1.3 — Wire `kairo ingest` ✅

- [x] **Goal:** the stub becomes real. Hooks call this; events land in SQLite.
- **Files:** `apps/cli/src/commands/ingest.ts`.
- **Acceptance:** `kairo ingest git --payload '{"sha":"..."}'` validates with
  zod, opens `Workspace`, writes one event row to `kairo.db`.
- **Tests:** `ingest.test.ts` runs the command function against a temp project
  dir, asserts on the resulting DB row.
- **Notes:** Use zod schemas from `@kairo/shared`. Use a `Workspace.find()`
  helper that walks up from cwd to find `.kairo/` (add it to `packages/core/src/workspace/`).

### 1.4 — Implement `kairo sweep` ✅

- [x] **Goal:** the first real end-to-end pipeline.
- **Files:** `apps/cli/src/commands/sweep.ts`.
- **Pipeline:**
  1. `Workspace.find()` from cwd.
  2. `GitObserver.commitsSince(lastIngestedSha)`.
  3. For each event: `EventStore.append`.
  4. Load all events for this project from store.
  5. `SessionReconstructor.reconstruct(events)`.
  6. For each session: `renderSession(...)` → write `.kairo/sessions/{slug}.md`.
  7. `renderTimeline(sessions)` → write `.kairo/timeline.md`.
- **Acceptance:** running `kairo sweep` in a real git repo produces real
  markdown. The timeline groups sessions by idle gaps. Session files have
  commit lists and file lists.
- **Tests:** integration test runs sweep on a fixture repo in `test/fixtures/`,
  asserts files exist and contain expected fragments.
- **Notes:** **(blocks: 1.5, 1.6)**

### 1.5 — Hook merge in `kairo init` ✅

- [x] **Goal:** `kairo init` installs Claude Code + Codex hooks non-destructively.
- **Files:**
  - `apps/cli/src/commands/init.ts` (extend).
  - `packages/core/src/hooks/` new module — `merge-hooks.ts`, `merge-hooks.test.ts`.
  - The merger reads existing `.claude/hooks.json` / `.codex/hooks.json`, deep-merges
    Kairo's entries marked with a `"kairo": true` tag, preserves all others.
- **Acceptance:** running `init` twice is idempotent. Running it against a file
  with pre-existing non-Kairo hooks preserves them.
- **Tests:** `merge-hooks.test.ts` with input/output JSON fixtures.
- **Notes:** Hook templates live in `templates/`. Read them at runtime via
  `import.meta.url` resolution, not bundled strings.

### 1.6 — `kairo init --uninstall` ✅

- [x] **Goal:** clean removal of Kairo hooks without nuking the user's other hooks.
- **Files:** same module as 1.5.
- **Acceptance:** running `kairo init --uninstall` removes only entries tagged
  `"kairo": true`. Other entries remain untouched.
- **Tests:** add cases to `merge-hooks.test.ts`.
- **Notes:** Symmetry matters. The same tagging logic powers both install and uninstall.

### 1.7 — Workspace `Session` persistence ✅

- [x] **Goal:** sessions are stored in SQLite, not only rendered to markdown.
- **Files:**
  - `packages/core/src/event-store/event-store.ts` — add `appendSession`, `recentSessions`, `getSession`.
  - Migration is already in `migrate()` — sessions table exists.
- **Acceptance:** `kairo sweep` writes both markdown and DB rows. Markdown is
  derived, DB is source of truth.
- **Tests:** `event-store.test.ts` covers session round-trips.
- **Notes:** When `sweep` reruns, sessions update in place by `id`.

**Milestone:** open any git project, `kairo init && kairo sweep`, see meaningful
sessions in `.kairo/timeline.md` and `.kairo/sessions/`. This is the demo.

### 1.8 — Storage + privacy hardening ✅ (2026-05-20)

- [x] **Goal:** close four gaps surfaced by a code-quality review of the Phase 1
  surface before Phase 2 starts emitting live fs/terminal/ai events.
- **Files:**
  - `packages/utils/src/id/deterministic-uuid.ts` (+ test) — pure SHA-256 →
    UUID-shaped id; subpath export `@kairo/utils/id`.
  - `packages/core/src/observers/git/git-observer.ts` — `GitObserver.toEvent`
    now derives id from `("git.commit", projectId, sha)` so re-ingesting the
    same commit is idempotent.
  - `packages/core/src/event-store/event-store.ts` — `INSERT OR IGNORE` on
    events; `rowToEvent` / `rowToSession` now zod-parse via `KairoEvent.parse`
    and `Session.parse`; `append`/`appendSession` run payloads through
    `redactSecrets` before storage (single chokepoint).
  - `packages/core/src/redact/` — new module. `redactString` handles JWTs, SSH
    private key blocks, common API key prefixes (`sk-*`, `sk-ant-*`, `ghp_*`,
    `gho_*`, `ghs_*`, `ghu_*`, `ghr_*`, `github_pat_*`, `glpat-*`, `xox[abps]-*`,
    `AKIA*`, `ASIA*`, `AIza*`) and secret-shaped env assignments (`*KEY=`,
    `*TOKEN=`, `*SECRET=`, `*PASSWORD=`, `*AUTH=`, `*API=`, `*PRIVATE=`,
    `*CREDENTIAL=`). `redactSecrets` walks objects/arrays.
  - `packages/core/src/workspace/workspace.ts` — `DEFAULT_IGNORE` extended with
    secrets denylist (`.env*`, `*.pem`, `*.key`, `id_rsa*`, `secrets/**`,
    `.ssh/**`, `.aws/**`, `.netrc`, `.npmrc`, etc.).
  - `packages/core/src/observers/file/file-observer.test.ts` — verifies ignore
    matching covers exact paths, `dir/**`, and secret-file globs such as
    `.env.*`, `*.pem`, `*.key`, and `id_rsa*`.
- **Acceptance:** `pnpm doctor` green; core, cli, and utils tests all passing.
- **Notes:** Redaction is **aggressive by default** (drop signal > leak). Tone
  down by editing the pattern list in `redact.ts`. The agent-reviewer also
  flagged a possible `parseNumstat` rename-with-edit bug and a stub-CLI/hook
  template mismatch (`kairo ingest fs|terminal`) — both are deferred:
  rename-with-edit needs its own task, and the missing `fs`/`terminal` ingest
  sources are already partly planned for Phase 2.8 / 2.9.

---

## Phase 2 — Live observation + MCP integration

**Goal:** while you code with Claude Code / Codex normally, Kairo updates
`.kairo/` passively in the background and the AI can query it via MCP.

### 2.1 — `kairo watch` (long-running daemon) ✅

- [x] **Goal:** one process that holds FileObserver and tails git, writes events live.
- **Files:**
  - `apps/cli/src/commands/watch.ts`.
  - `packages/core/src/observers/file/file-observer.ts` (move into a folder).
  - `packages/core/src/observers/git/tailer.ts` — polls `git log` every N seconds
    for new commits (cheap; reflog could be used later).
- **Acceptance:** running `kairo watch` in a project keeps adding events to
  SQLite as you edit files and commit. Ctrl-C is clean.
- **Tests:** `tailer.test.ts` for the polling logic; `watch` integration test
  uses a temp repo, creates files, asserts events landed.
- **Notes:** Single process, no IPC. Use `process.on('SIGINT', …)` for cleanup.

### 2.2 — Live session boundary detection ✅

- [x] **Goal:** when activity goes idle, the current session finalizes.
- **Files:** `packages/core/src/session-reconstructor/` (split current file into folder):
  - `bucketize.ts` (pure function, current logic).
  - `live-session.ts` — state machine over a stream of events.
  - tests.
- **Acceptance:** during `kairo watch`, after N minutes idle, the open session's
  markdown is finalized. New activity starts a new session.
- **Tests:** unit-test the state machine with a synthetic event stream.
- **Notes:** Default idle gap stays at 30 minutes (config-overridable).

### 2.3 — MCP `kairo_recent_sessions` → real ✅

- [x] **Goal:** stub returns real session data.
- **Files:** `apps/mcp/src/tools/recent-sessions.ts` (split current `tools.ts`
  into one file per tool, per the module convention).
- **Acceptance:** Claude Code (with `kairo-mcp` registered) returns actual
  sessions from the EventStore.
- **Tests:** call the tool function directly with a populated test DB; assert shape.
- **Notes:** MCP server opens a `Workspace.find()` at startup. If no workspace,
  tools return an empty array, not an error.

### 2.4 — MCP `kairo_session_detail` → real ✅

- [x] **Goal:** fetch one session by slug, including its event list.
- **Files:** `apps/mcp/src/tools/session-detail.ts`.
- **Acceptance:** returns session metadata + the relevant markdown content.
- **Tests:** same pattern as 2.3.

### 2.5 — MCP `kairo_search` → keyword fallback ✅

- [x] **Goal:** literal substring search over session titles, themes, summaries, file paths.
- **Files:** `apps/mcp/src/tools/search.ts`. SQLite `LIKE`-based search is fine here.
- **Acceptance:** queries like "auth" return sessions whose any text field matches.
- **Tests:** populated test DB + assertions.
- **Notes:** **Semantic search is Phase 4.** Don't reach for embeddings yet.

### 2.6 — MCP `kairo_architecture_shifts` → empty-safe stub ✅

- [x] **Goal:** the tool returns `[]` cleanly. Phase 4 will fill it.
- **Files:** `apps/mcp/src/tools/architecture-shifts.ts`.
- **Acceptance:** Claude Code calls it; gets an empty array (or whatever is in
  the (still-empty) shifts table) rather than an error.
- **Tests:** trivial.

### 2.7 — `kairo wake` outputs real context ✅

- [x] **Goal:** prints last N days' session summaries as markdown to stdout.
- **Files:** `apps/cli/src/commands/wake.ts`.
- **Acceptance:** `kairo wake --days 7` outputs a markdown report suitable for
  pasting into a new AI chat. Used by `SessionStart` hooks.
- **Tests:** snapshot test on a fixture DB.
- **Notes:** Output is plain markdown. Inspired by MemPalace's `wake-up` command.

### 2.8 — Pre-compaction hook surfaces ✅

- [x] **Goal:** when Claude Code is about to compact, Kairo finalizes the open session.
- **Files:**
  - `apps/cli/src/commands/ingest.ts` — recognize `ai` source with `kind: pre-compact`.
  - On pre-compact: force-close the live session, render markdown immediately.
- **Acceptance:** simulate a pre-compact event; verify the current session
  becomes a finalized one in `.kairo/sessions/`.
- **Tests:** integration test.
- **Notes:** This is the MemPalace insight — make Kairo a context survival layer.
  Pre-compact ingest now renders the active event bucket immediately and carries
  AI-reported touched files into the finalized session.

### 2.9 — Hooks installer covers SessionStart + PreCompact ✅

- [x] **Goal:** the hook templates already mention these — make sure init wires them.
- **Files:** `templates/claude/hooks.json` (already correct) — verify `kairo init`
  installs them.
- **Acceptance:** after `kairo init`, `.claude/hooks.json` includes both events.
- **Tests:** extend `merge-hooks.test.ts`.
- **Notes:** Installer coverage now asserts tagged `PreCompact` and `SessionStart`
  Claude hook entries are present after template merge.

**Milestone:** open Claude Code in a project, edit files for an hour, see
`.kairo/timeline.md` update live. Ask Claude *"what did I work on?"* — it calls
`kairo_recent_sessions` via MCP and answers from real data.

---

## Phase 3 — Local web dashboard

**Goal:** open Kairo in a browser, see a timeline.

### 3.1 — `apps/web` skeleton

- [x] **Goal:** Vite + React + Tailwind + shadcn skeleton.
- **Files:** `apps/web/`.
- **Acceptance:** `pnpm --filter @kairo/web dev` boots Vite, shows a placeholder page.
- **Tests:** none yet.
- **Notes:** No Next.js. The web app is static; `kairo serve` hosts it.
- **Done:** Added the Vite React app with Tailwind v4, shadcn-compatible UI
  scaffolding, and an operational placeholder dashboard.

### 3.2 — Decide API surface

- [x] **Goal:** how does the web UI read EventStore?
- **Options:**
  - (a) **In-process:** `kairo serve` spins up a tiny Hono server reading SQLite directly. (Simple.)
  - (b) **Sqlite WASM in browser:** Web reads `.kairo/kairo.db` directly via wa-sqlite. (Stricter local-first, more setup.)
- **Acceptance:** decision recorded in `docs/decisions/0001-web-data-source.md` with rationale.
- **Notes:** Recommend (a) for v1 — simpler. (b) becomes a later option when
  Tauri-shelling, since the WebView can `invoke` a Rust command that reads SQLite directly.
- **Done:** Chose option (a): `kairo serve` will expose a small in-process local
  API that reads SQLite through `@kairo/core`. Browser-side SQLite remains
  deferred for possible Tauri command integration.

### 3.3 — Timeline view

- [x] **Goal:** vertical timeline with phase grouping, architecture markers.
- **Files:** `apps/web/src/features/timeline/`.
- **Acceptance:** sessions render chronologically with summaries.
- **Tests:** component tests via Vitest + React Testing Library.
- **Done:** Added the `/dashboard` timeline view with month grouping,
  chronological sessions, summary cards, and related architecture markers.

### 3.4 — Session detail view

- [x] **Goal:** click a session, see commits, files, summary, architecture impact.
- **Files:** `apps/web/src/features/session/`.
- **Acceptance:** detail page renders all fields from the Session shape.
- **Done:** Added session detail routing at `/dashboard/sessions/:slug`,
  loading state, full Session field rendering, events, and rendered markdown.

### 3.5 — Search UI

- [x] **Goal:** search bar hooked to semantic search.
- **Files:** `apps/web/src/features/search/`.
- **Acceptance:** typing returns ranked sessions.
- **Done:** Added debounced dashboard search wired to `/api/search`, with
  result selection feeding the session detail route.

### 3.6 — `kairo serve` boots web + api

- [x] **Goal:** one command starts everything.
- **Files:** `apps/cli/src/commands/serve.ts`.
- **Acceptance:** `kairo serve` opens browser to `http://localhost:4170`.
- **Done:** Added the in-process Hono API, static web asset serving with SPA
  fallback, browser launch, and focused route/static-file coverage.

**Milestone:** `kairo serve` → browser → click around your project's history.

---

## Phase 4 — Intelligence layer

**Goal:** session summaries are written in human prose; semantic search works;
architecture shifts are detected.

### 4.1 — Create `packages/ai` ✅

- [x] **Goal:** provider-abstracted AI calls live in one package.
- **Files:**
  - `packages/ai/package.json`.
  - `packages/ai/src/index.ts`.
  - `packages/ai/src/provider/` — `provider.ts` (interface), `anthropic.ts`,
    `openai.ts`, `openrouter.ts`, optional `ollama.ts`.
  - `packages/ai/src/summarize/` — `summarize-session.ts` + tests.
  - `packages/ai/src/embed/` — `embed-text.ts` + tests.
  - `packages/ai/src/cache/` — `response-cache.ts` keyed by content hash + tests.
- **Acceptance:** `import { summarizeSession, embedText } from '@kairo/ai'` works.
  Provider selected via config + env var.
- **Tests:** providers tested against recorded JSON fixtures (no network).
- **Notes:** Vendor lock-in is flagged as a top risk in SDD §17.4. Never call
  a provider directly from `apps/*` or `packages/core` — always through `@kairo/ai`.
  Provider setup catalog lists common providers first, then the rest
  alphabetically, with custom OpenAI-compatible support and no-network provider
  tests.

### 4.2 — Session summarization ✅

- [x] **Goal:** given a session's events, produce title, intent, themes, summary, architecture impact.
- **Files:** `packages/ai/src/summarize/summarize-session.ts`.
- **Acceptance:** running `kairo sweep` now writes prose summaries, not just
  event lists. Output matches the structure in `templates/kairo-workspace/sessions/2026-05-15-auth-rewrite.md`.
- **Tests:** fixture-based.
- **Notes:** Cache by hash of `(event IDs sorted, model version)`. Re-running
  sweep is cheap.
  Sweep now applies structured summaries when a summarizer or AI env is
  available, and reuses existing summary fields for unchanged session IDs.

### 4.3 — Provider config ✅

- [x] **Goal:** users pick their provider in `.kairo/config.json` or via env vars.
- **Files:**
  - `packages/core/src/workspace/config.ts` — extend schema with `ai: { provider, model, apiKeyEnv }`.
  - `apps/cli/src/commands/init.ts` — interactive prompt (default: Anthropic; offer OpenAI / OpenRouter / Ollama / none).
- **Acceptance:** `kairo init` writes a sensible default. Users can switch
  provider by editing config.
- **Tests:** schema validation tests.
- **Notes:** Carry forward provider setup UX from `@kairo/ai`: API-key auth for
  OpenAI, Anthropic, Gemini, OpenRouter, Ollama, Amazon Bedrock, Azure OpenAI,
  Cerebras, Cohere, custom OpenAI-compatible, DeepSeek, Fireworks, Groq, Kilo
  Gateway, LM Studio, MiniMax, Mistral, Moonshot Kimi, Perplexity, Together AI,
  Vertex AI, and xAI. Add headless auth where supported: Anthropic WIF,
  OpenRouter OAuth, Amazon Bedrock IAM/temporary credentials, Azure Entra ID,
  and Vertex AI ADC.
  Workspace config now validates `ai` settings, `kairo init` writes Anthropic by
  default or accepts `--ai-provider` / `--ai-auth`, and `sweep` passes config
  through to `@kairo/ai` while still allowing `KAIRO_AI_*` env overrides.

### 4.4 — Architecture shift detection ✅

- [x] **Goal:** heuristics over event clusters identify framework migrations,
  package extractions, directory restructures.
- **Files:**
  - `packages/core/src/architecture/` — `detector.ts` + sub-detectors.
  - Sub-detectors: `package-extraction.ts`, `framework-migration.ts`,
    `directory-restructure.ts`, `dependency-shift.ts`.
- **Acceptance:** running `kairo sweep` against a repo with a known refactor
  produces an entry in `architecture_shifts`.
- **Tests:** fixture repos with crafted git history.
- **Notes:** Start with cheap heuristics: many file renames in a window =
  restructure; package.json delta with new workspaces entry = extraction.
  Added deterministic detectors for package extraction, framework migration,
  directory restructure, and dependency shifts. `kairo sweep` stores detected
  shifts in SQLite, and MCP now returns persisted architecture shifts.

### 4.5 — Semantic search via sqlite-vec

- [x] **Goal:** `kairo search "auth rewrite"` returns the right session even if
  those words don't appear verbatim.
- **Files:**
  - `packages/core/src/event-store/event-store.ts` — load `sqlite-vec` extension.
  - Add `embeddings` virtual table.
  - `packages/core/src/search/semantic.ts` — embed query → top-K nearest sessions.
  - `apps/cli/src/commands/search.ts` — wire to real semantic search.
  - `apps/mcp/src/tools/search.ts` — upgrade to semantic.
- **Acceptance:** semantic and keyword search both work; semantic is the default.
- **Tests:** with a tiny embedded local model or recorded fixtures.
- **Notes:** Default embedding model is small + fast (e.g. `nomic-embed-text` via
  Ollama if local) so it remains usable offline per SRS §9.4.
  Implemented semantic indexing during sweep with keyword fallback for offline or
  unavailable embedding providers.

### 4.6 — `kairo wake` uses AI prose

- [x] **Goal:** wake output is a human-prose paragraph, not bullet dumps.
- **Files:** `apps/cli/src/commands/wake.ts`.
- **Acceptance:** the output reads like a colleague briefing you on the last week.
- **Tests:** fixture-based.
- **Done:** `kairo wake` now asks the configured AI provider for a one-paragraph
  briefing and falls back to deterministic prose when AI is unavailable.

### 4.7 — Agent runtime gateways

- [x] **Goal:** evaluate and add gateway support for already-authenticated AI
  agent runtimes without mixing them into provider API-key config.
- **Files:**
  - `packages/ai/src/gateway/` — gateway interfaces for external agent runtimes.
  - `apps/cli/src/commands/doctor.ts` — readiness checks for installed gateways.
  - `docs/decisions/` — decision note on provider APIs vs agent runtime gateways.
- **Acceptance:** Codex can be detected as an optional gateway via the local CLI
  auth boundary (`codex login status` / `codex exec` smoke check), with room for
  Claude Code, Cursor, and similar tools later.
- **Tests:** no network; fixture or fake-process tests for readiness parsing and
  command construction.
- **Notes:** Keep current provider config as-is. Gateways are not providers:
  they should reuse existing user auth from each tool, avoid storing tokens, and
  run only through explicit bounded commands after the core AI provider layer is
  stable.
- **Done:** Added a separate `@kairo/ai/gateway` layer, Codex CLI readiness
  detection, planned Claude Code/Cursor extension points, doctor reporting, and
  a provider-vs-gateway decision note.

**Milestone:** open a real codebase, search "auth rewrite", get the right
session. Read `.kairo/timeline.md` — it reads like a human wrote it.

---

## Phase 5 — Project memory intelligence

**Goal:** turn Kairo from a searchable project history into a local evidence
engine for why the project changed, how past problems were solved, and what
evidence backs that answer.

### 5.1 — Natural-language project memory Q&A ✅

- [x] **Goal:** ask questions like "Why did we switch from REST to GraphQL?"
  and get a grounded answer from Kairo's stored sessions, architecture shifts,
  commits, files, and decisions.
- **Files:** `packages/core/src/memory/`, `packages/ai/src/answer/`,
  `apps/cli/src/commands/ask.ts`, `apps/mcp/src/tools/ask.ts`.
- **Acceptance:** `kairo ask "why did we switch to graphql from rest?"` retrieves
  relevant sessions/architecture shifts and returns a concise answer with
  source references.
- **Tests:** recorded retrieval fixtures; no network calls in tests.
- **Notes:** This is not generic chat. Answers must be grounded in stored Kairo
  evidence and should say when the memory does not contain enough information.
  Preserve raw source evidence as the answer substrate: summaries and synthetic
  documents may improve retrieval, but they must never replace commits, diffs,
  terminal events, hook payloads, ADRs, or session records as citations.
- **Done:** Added local retrieval through `@kairo/core`, then provider-backed
  natural-language answering through `@kairo/ai`, `kairo ask`, and the
  `kairo_ask` MCP tool. MiniMax is the default init provider. Answers are
  grounded in stored sessions, architecture shifts, and raw commit/event
  evidence, include citations, and abstain when no matching evidence exists.

### 5.2 — Error and fix recall memory

- [ ] **Goal:** remember previously solved errors and explain how they were fixed
  when the same or similar error appears later.
- **Files:** `packages/shared/src/problem.ts`, `packages/core/src/problem-memory/`,
  terminal observation/reconstruction code, `apps/cli/src/commands/ask.ts`.
- **Acceptance:** a query like `kairo ask "we fixed AN_ERROR before, how?"`
  returns the prior session, suspected root cause, files changed, commits, and
  fix summary.
- **Tests:** fixtures with terminal error events, related fix commits, and a
  later similar query.
- **Notes:** Add a first-class `ProblemMemory` / `FixMemory` shape instead of
  relying only on raw terminal text. Redaction rules still apply before storage.

### 5.3 — Evidence citations and traceable answers

- [ ] **Goal:** every synthesized memory answer cites the sessions, commits,
  files, architecture shifts, ADRs, or terminal events it used.
- **Files:** `packages/shared/src/memory.ts`, `packages/core/src/memory/`,
  `packages/ai/src/answer/`.
- **Acceptance:** answer output includes stable references such as session slug,
  commit SHA, file path, event ID, and architecture shift ID where available.
- **Tests:** answer synthesis fixtures verify citation presence and that no
  uncited factual claims are emitted when evidence is missing.
- **Notes:** Prefer concise citations over long copied source text.

### 5.4 — Hybrid memory retrieval ranking

- [ ] **Goal:** rank candidate memory by semantic similarity, BM25/keyword
  overlap, recency, temporal query parsing, file/path/package overlap,
  architecture relevance, and problem/fix confidence.
- **Files:** `packages/core/src/memory/retrieval.ts`,
  `packages/core/src/search/semantic.ts`, `packages/core/src/problem-memory/`,
  `packages/core/src/search/bm25.ts`.
- **Acceptance:** similar error queries and architecture-why queries retrieve
  the correct prior sessions above weaker keyword-only matches; questions with
  phrases like "last week", "before the dashboard split", or "when this error
  first appeared" use temporal signals instead of embedding similarity alone.
- **Tests:** deterministic ranking fixtures covering synonyms, renamed files,
  recurring stack traces, architecture terms, temporal references, and exact
  keyword anchors.
- **Notes:** Keep keyword/BM25 fallback for offline use; semantic retrieval
  should improve ranking, not become the only path. Retrieval signals are boosts,
  not hard filters, so a wrong classifier cannot hide the correct evidence.

### 5.5 — Dashboard memory assistant

- [ ] **Goal:** add an optional "Ask Kairo" surface to the dashboard package for
  project-memory Q&A without making the CLI depend on the frontend.
- **Files:** `apps/web/src/features/memory/`, `apps/web/src/features/dashboard/`,
  optional dashboard API/client boundary.
- **Acceptance:** dashboard users can ask a project-history question against an
  existing `.kairo/` workspace, see a synthesized answer, inspect citations,
  and jump to related sessions; `@kairo/cli` remains installable and usable
  without React, Vite, or dashboard assets.
- **Tests:** component tests for query entry, loading/error states, cited answer
  rendering, and session navigation.
- **Notes:** This should feel like a local project memory browser, not a generic
  chatbot. Keep it as an optional visualization surface over the same core
  memory APIs used by CLI and MCP.

### 5.6 — Decision memory from ADRs and inferred changes

- [ ] **Goal:** index explicit ADRs plus inferred decisions from architecture
  shifts so Kairo can answer decision-oriented questions.
- **Files:** `docs/decisions/`, `packages/core/src/memory/decisions.ts`,
  `packages/shared/src/memory.ts`.
- **Acceptance:** questions about why a technology, boundary, or architecture
  direction changed can cite ADRs when present and architecture shifts when
  ADRs are missing.
- **Tests:** fixtures with one explicit ADR and one inferred architecture shift.
- **Notes:** Do not invent rationale. If only inferred evidence exists, label it
  as inference.

### 5.7 — Raw evidence preservation and memory schemas

- [ ] **Goal:** define first-class memory records while preserving raw evidence
  as the source of truth.
- **Files:** `packages/shared/src/memory.ts`, `packages/shared/src/problem.ts`,
  `packages/core/src/memory/`, EventStore migrations.
- **Acceptance:** Kairo stores `SessionMemory`, `DecisionMemory`,
  `ProblemMemory`, `FixMemory`, `ArchitectureShiftMemory`, `SymbolMemory`, and
  `AgentRunMemory` records with stable links back to raw sessions, commits,
  file paths, terminal events, hook payloads, ADRs, or architecture shifts.
- **Tests:** schema tests and migration fixtures prove memory records can be
  rebuilt from raw evidence without losing citation anchors.
- **Notes:** Treat summaries, labels, topics, and extracted entities as indexes
  over evidence, not as replacements for evidence.

### 5.8 — Synthetic bridge documents

- [ ] **Goal:** generate cached retrieval helper documents that bridge vocabulary
  gaps without becoming answer sources.
- **Files:** `packages/core/src/memory/bridge-docs.ts`,
  `packages/ai/src/answer/`, `packages/core/src/search/semantic.ts`.
- **Acceptance:** each finalized session can produce compact bridge docs for
  touched features, problems fixed, decisions made, risks introduced, files,
  packages, symbols, and notable commands; search maps bridge-doc hits back to
  the underlying memory/evidence IDs.
- **Tests:** fixtures where the query uses different wording than the original
  session still retrieve the right evidence through bridge docs.
- **Notes:** Bridge docs may be AI-generated or deterministic. They are retrieval
  accelerators only; answers must cite the underlying raw evidence.

### 5.9 — Temporal project knowledge graph

- [ ] **Goal:** model project entities and relationships over time so Kairo can
  answer "why", "when", and "what changed after X" questions.
- **Files:** `packages/shared/src/knowledge-graph.ts`,
  `packages/core/src/knowledge-graph/`, EventStore migrations,
  `apps/cli/src/commands/ask.ts`.
- **Acceptance:** Kairo can store and query entities such as packages, modules,
  files, symbols, APIs, models, database tables, env vars, commands, errors,
  decisions, and agents with relationships like `fixes`, `caused_by`,
  `supersedes`, `depends_on`, `implements`, `touches`, and `explained_by`;
  relationships support validity windows and source citations.
- **Tests:** fixtures prove as-of queries, superseded decisions, renamed files,
  and fix/error relationships return time-correct evidence.
- **Notes:** Keep the graph local and SQLite-backed. Graph facts need confidence
  and source references, especially when inferred from architecture shifts.

### 5.10 — Optional LLM rerank and answer grounding

- [ ] **Goal:** use an optional AI reranker/reader to improve hard retrieval
  cases without making AI required for core memory lookup.
- **Files:** `packages/ai/src/answer/rerank.ts`,
  `packages/core/src/memory/retrieval.ts`, `apps/cli/src/commands/ask.ts`.
- **Acceptance:** when an AI provider or runtime gateway is available, `kairo ask`
  can rerank the top candidates and select the best evidence; when unavailable,
  timeout, or invalid, Kairo returns the deterministic hybrid ranking unchanged.
- **Tests:** fake-provider fixtures cover successful rerank, timeout, invalid
  selection, and no-provider fallback.
- **Notes:** Ask the model for the single best evidence candidate or citation set,
  not an unconstrained answer. The final answer still goes through citation
  enforcement.

### 5.11 — Source adapter contract for memory inputs

- [ ] **Goal:** make future memory sources pluggable without hardcoding every
  tool/export format into core.
- **Files:** `packages/core/src/sources/`, `packages/shared/src/source.ts`,
  `apps/cli/src/commands/import.ts`, `apps/mcp/src/tools/import.ts`.
- **Acceptance:** first-party adapters exist for Kairo sessions, git history,
  terminal events, ADRs, Claude Code/Codex hook transcripts, and dashboard-free
  local project files; each adapter declares its metadata schema, privacy class,
  supported ingest mode, incremental cursor/version token, and transformations.
- **Tests:** conformance tests prove adapters are incremental, privacy-aware,
  and honest about transformations such as truncation, redaction, or line
  normalization.
- **Notes:** Prefer explicit adapters over `if source_type === ...` branches in
  core. This keeps Kairo open to Cursor, GitHub PRs/issues, CI logs, Obsidian,
  and other sources later.

### 5.12 — Memory retrieval benchmarks

- [ ] **Goal:** measure intelligence-layer quality with reproducible local
  fixtures before tuning retrieval heuristics.
- **Files:** `benchmarks/memory/`, `packages/core/src/memory/*.test.ts`,
  `docs/benchmarks/memory.md`.
- **Acceptance:** benchmark fixtures cover architecture-why questions,
  problem/fix recall, temporal questions, renamed files, exact error strings,
  assistant/agent transcript recall, and decision citations; output reports
  recall@k, citation coverage, unsupported-answer abstention, and latency.
- **Tests:** benchmark runner is deterministic, offline by default, and can run
  against both deterministic hybrid retrieval and optional AI rerank fixtures.
- **Notes:** Tune only against declared fixtures and keep a held-out set. Avoid
  optimizing a heuristic because it fixes one inspected miss unless the fixture
  category explains the broader failure mode.

### 5.13 — Project operating model memory

- [ ] **Goal:** maintain a compact, source-backed model of how the project works
  today.
- **Files:** `packages/shared/src/project-model.ts`,
  `packages/core/src/project-model/`, `apps/cli/src/commands/status.ts`,
  `apps/mcp/src/tools/project-model.ts`.
- **Acceptance:** Kairo can report current architecture, conventions, fragile
  areas, active risks, recurring failures, preferred implementation patterns,
  important commands, and recently superseded decisions with citations.
- **Tests:** fixtures prove the project model updates after architecture shifts,
  repeated errors, new ADRs, and convention-changing sessions.
- **Notes:** This is the "what should a contributor know before touching this
  repo?" memory layer. It is derived from lower-level memories and can be
  rebuilt, so it should not become the only source of truth.

### 5.14 — Supersession and contradiction handling

- [ ] **Goal:** detect when project facts, decisions, or conventions replace
  older ones.
- **Files:** `packages/shared/src/memory.ts`,
  `packages/core/src/memory/supersession.ts`,
  `packages/core/src/knowledge-graph/`, `apps/cli/src/commands/ask.ts`.
- **Acceptance:** answers can say "this used to be true, but was superseded by
  X" for decisions, architecture boundaries, commands, env vars, package
  choices, and implementation conventions; stale facts are still traceable.
- **Tests:** fixtures cover conflicting ADRs, changed setup commands, renamed
  modules, replaced dependencies, and frontend/CLI boundary changes.
- **Notes:** Prefer explicit supersession from ADRs and commits. When inferred,
  carry confidence and label the result as inferred.

### 5.15 — Symbol-time intelligence

- [ ] **Goal:** answer historical questions about files, symbols, APIs, and
  modules, not only sessions.
- **Files:** `packages/shared/src/symbol.ts`, `packages/core/src/symbol-index/`,
  `packages/core/src/knowledge-graph/`, `apps/cli/src/commands/ask.ts`.
- **Acceptance:** Kairo can answer "why does this function exist?", "when did
  this API contract change?", "what broke last time we touched this file?", and
  "which session introduced this pattern?" with file/symbol/commit citations.
- **Tests:** fixtures cover renamed files, moved symbols, changed exported APIs,
  and recurring failures tied to a file or symbol.
- **Notes:** Start with TypeScript-friendly static extraction and git history.
  Deeper language-server integration can come later through source adapters.

### 5.16 — Project reflection commands

- [ ] **Goal:** expose proactive intelligence reports, not only user-asked Q&A.
- **Files:** `apps/cli/src/commands/reflect.ts`,
  `packages/core/src/reflect/`, `apps/mcp/src/tools/reflect.ts`.
- **Acceptance:** commands such as `kairo reflect risks`,
  `kairo reflect architecture`, `kairo reflect repeated-errors`,
  `kairo reflect contributor-map`, and `kairo reflect release-readiness`
  generate concise reports with citations and confidence.
- **Tests:** fixtures cover each reflection mode, unsupported evidence gaps, and
  deterministic offline output.
- **Notes:** Reflection should summarize evidence already captured by Kairo. It
  should not invent work items or recommendations without backing evidence.

### 5.17 — Memory checks for CI and reviews

- [ ] **Goal:** turn project memory into lightweight checks that help teams avoid
  repeated mistakes.
- **Files:** `apps/cli/src/commands/check.ts`, `packages/core/src/checks/`,
  `.github/workflows/` examples in docs.
- **Acceptance:** `kairo check memory` can flag repeated errors, missing
  decision records for broad architecture shifts, stale setup docs, and changes
  that touch known fragile areas; output is advisory and citation-backed.
- **Tests:** fixtures cover repeated-error detection, missing-ADR warnings,
  stale-command warnings, and no-op clean runs.
- **Notes:** Keep checks quiet by default. The goal is useful project memory, not
  noisy governance.

### 5.18 — Source adapter contribution kit

- [ ] **Goal:** make memory-source contributions obvious, bounded, and easy to
  review.
- **Files:** `docs/sources/adapter-authoring.md`,
  `packages/core/src/sources/template/`, adapter conformance fixtures,
  `TASKS.md`.
- **Acceptance:** contributors can add a new source adapter by following a
  template with declared schema, privacy class, cursor/versioning behavior,
  transformation policy, tests, and sample fixture data.
- **Tests:** template adapter passes the same conformance suite as first-party
  adapters.
- **Notes:** This task builds on 5.11. 5.11 defines the runtime contract; this
  task creates the contributor workflow and examples.

**Milestone:** ask Kairo why something changed or how a past error was fixed,
and get a concise answer with evidence links back into project memory.

---

## Phase 6 — Tauri desktop shell

**Goal:** real desktop app, tray icon, autostart, Node observer sidecar supervised by the Rust core.

### 6.1 — `apps/desktop` Tauri skeleton

- [ ] **Goal:** Tauri shell wraps `apps/web`.
- **Files:** `apps/desktop/` — `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`,
  `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`. The renderer is whatever
  `apps/web` builds; `tauri.conf.json` points `build.frontendDist` at it and
  `build.devUrl` at the Vite dev server.
- **Acceptance:** `pnpm --filter @kairo/desktop dev` (wraps `tauri dev`) opens
  the dashboard in a native window with HMR for the renderer.
- **Notes:** Tauri 2. Use the system WebView (WKWebView on macOS, WebView2 on
  Windows, WebKitGTK on Linux). The Rust core is thin — its job is to host the
  WebView, expose `invoke` commands, and supervise the Node sidecar (6.3).

### 6.2 — Tray icon + autostart

- [ ] **Goal:** menubar icon, "open dashboard", "pause observation", autostart on login.
- **Files:** `apps/desktop/src-tauri/src/tray.rs`, `apps/desktop/src-tauri/src/autostart.rs`,
  capability entries in `apps/desktop/src-tauri/capabilities/`.
- **Acceptance:** verified manually on macOS; plan for Linux + Windows.
- **Notes:** Use Tauri 2's built-in `tray` APIs and `tauri-plugin-autostart`
  for cross-platform login-item handling — no per-OS code paths required.

### 6.3 — Observer sidecar management

- [ ] **Goal:** the Rust core spawns and supervises a Node sidecar that runs the
  `@kairo/core` observers for each registered project.
- **Files:** `apps/desktop/src-tauri/src/sidecar.rs`,
  `apps/desktop/sidecar/observer.ts` (Node entrypoint that imports `@kairo/core`),
  `externalBin` entry in `tauri.conf.json` for the bundled Node binary.
- **Acceptance:** open desktop app → projects you've registered show as "observing";
  killing the desktop app kills the sidecar; sidecar crash auto-restarts.
- **Notes:** The Rust core *cannot* import `@kairo/core` in-process — this is the
  load-bearing architectural difference from the prior Electron plan. The sidecar
  is a packaged Node binary (via `pkg` or `@yao-pkg/pkg`) declared as an
  `externalBin`; Rust spawns it with `tauri-plugin-shell`'s `Command::sidecar`.
  IPC: WebView → Rust `invoke` → sidecar over stdio (JSON lines). If isolation
  isn't needed, you can also reuse the existing `kairo watch` CLI as the sidecar
  binary directly.

### 6.4 — Session boundary notifications

- [ ] **Goal:** OS notification when a session finalizes.
- **Files:** `apps/desktop/src-tauri/src/notifications.rs`, capability entry
  for `notification:default`.
- **Acceptance:** opt-in toggle in settings; notification on Mac/Linux/Windows
  via `tauri-plugin-notification`.

**Milestone:** open Kairo from the dock, see your projects, get a notification when a coding session wraps.

---

## Phase 7 — Distribution

**Goal:** `npm install -g @kairo/cli` works; releases are automated.

### 7.1 — npm publish config

- [ ] **Goal:** `@kairo/cli` and `@kairo/mcp` are publishable.
- **Files:** `apps/cli/package.json` (`"publishConfig"`), `apps/mcp/package.json`.
- **Acceptance:** dry-run `npm publish` works.

### 7.2 — Changesets

- [ ] **Goal:** versioning is automated.
- **Files:** `.changeset/config.json`.
- **Acceptance:** `pnpm changeset` flow works for bumping versions.

### 7.3 — CI

- [ ] **Goal:** GitHub Actions runs `pnpm doctor` on every PR.
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** PR runs typecheck, lint, test in CI.

### 7.4 — Release workflow

- [ ] **Goal:** tag → npm publish + Tauri build artifacts (`.dmg`, `.AppImage`, `.msi`) via `tauri build` (using `tauri-apps/tauri-action` in CI).
- **Files:** `.github/workflows/release.yml`.

### 7.5 — Docs site

- [ ] **Goal:** docs.kairo.dev (or similar) — quickstart, guides, API ref.
- **Files:** `apps/docs/` (Astro Starlight or similar).

**Milestone:** anyone can `npm install -g @kairo/cli`, then `kairo init && kairo sweep`, and have it work.

---

## Cross-phase rules

- **Audit after each phase:** re-check the AGENTS.md type-centralization and
  Sharing-Law rules. Hoist anything that needs hoisting *before* starting the
  next phase.
- **Full test run at phase boundaries:** `pnpm doctor` must be green before
  moving to the next phase.
- **Update `docs/SRS.md` / `docs/SDD.md`** if the phase taught you the spec
  was wrong. Don't silently diverge.
- **Decisions:** non-obvious architectural choices get a one-page note in
  `docs/decisions/{NNNN}-{slug}.md`.

---

## How to claim a task

1. Pick the lowest-numbered unchecked task in the current phase.
2. Re-read `AGENTS.md` for the folder/sharing rules relevant to your task.
3. Implement. Tests next to code. Imports respect the Sharing Law.
4. Run relevant tests (`pnpm --filter <pkg> test {name}`) + typecheck.
5. Check the box here. Note any non-obvious decision in one line.
6. If the task uncovered a missing rule or convention, propose it in AGENTS.md
   as part of the same change.
