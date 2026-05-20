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
- **Notes:** This becomes the CI entrypoint in Phase 6.

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
  Re-introduce when Phase 6 adds npm publishing.
- `tsconfig.base.json` sets `allowImportingTsExtensions: true` + `noEmit: true` so
  imports can use `.ts` suffixes (required by Node ESM resolver under tsx/Vitest).
  This implies `pnpm build` is currently a no-op typecheck — Phase 6 will override
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
- **Notes:** **Semantic search is Phase 3.** Don't reach for embeddings yet.

### 2.6 — MCP `kairo_architecture_shifts` → empty-safe stub ✅

- [x] **Goal:** the tool returns `[]` cleanly. Phase 3 will fill it.
- **Files:** `apps/mcp/src/tools/architecture-shifts.ts`.
- **Acceptance:** Claude Code calls it; gets an empty array (or whatever is in
  the (still-empty) shifts table) rather than an error.
- **Tests:** trivial.

### 2.7 — `kairo wake` outputs real context

- [ ] **Goal:** prints last N days' session summaries as markdown to stdout.
- **Files:** `apps/cli/src/commands/wake.ts`.
- **Acceptance:** `kairo wake --days 7` outputs a markdown report suitable for
  pasting into a new AI chat. Used by `SessionStart` hooks.
- **Tests:** snapshot test on a fixture DB.
- **Notes:** Output is plain markdown. Inspired by MemPalace's `wake-up` command.

### 2.8 — Pre-compaction hook surfaces

- [ ] **Goal:** when Claude Code is about to compact, Kairo finalizes the open session.
- **Files:**
  - `apps/cli/src/commands/ingest.ts` — recognize `ai` source with `kind: pre-compact`.
  - On pre-compact: force-close the live session, render markdown immediately.
- **Acceptance:** simulate a pre-compact event; verify the current session
  becomes a finalized one in `.kairo/sessions/`.
- **Tests:** integration test.
- **Notes:** This is the MemPalace insight — make Kairo a context survival layer.

### 2.9 — Hooks installer covers SessionStart + PreCompact

- [ ] **Goal:** the hook templates already mention these — make sure init wires them.
- **Files:** `templates/claude/hooks.json` (already correct) — verify `kairo init`
  installs them.
- **Acceptance:** after `kairo init`, `.claude/hooks.json` includes both events.
- **Tests:** extend `merge-hooks.test.ts`.

**Milestone:** open Claude Code in a project, edit files for an hour, see
`.kairo/timeline.md` update live. Ask Claude *"what did I work on?"* — it calls
`kairo_recent_sessions` via MCP and answers from real data.

---

## Phase 3 — Intelligence layer

**Goal:** session summaries are written in human prose; semantic search works;
architecture shifts are detected.

### 3.1 — Create `packages/ai`

- [ ] **Goal:** provider-abstracted AI calls live in one package.
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

### 3.2 — Session summarization

- [ ] **Goal:** given a session's events, produce title, intent, themes, summary, architecture impact.
- **Files:** `packages/ai/src/summarize/summarize-session.ts`.
- **Acceptance:** running `kairo sweep` now writes prose summaries, not just
  event lists. Output matches the structure in `templates/kairo-workspace/sessions/2026-05-15-auth-rewrite.md`.
- **Tests:** fixture-based.
- **Notes:** Cache by hash of `(event IDs sorted, model version)`. Re-running
  sweep is cheap.

### 3.3 — Provider config

- [ ] **Goal:** users pick their provider in `.kairo/config.json` or via env vars.
- **Files:**
  - `packages/core/src/workspace/config.ts` — extend schema with `ai: { provider, model, apiKeyEnv }`.
  - `apps/cli/src/commands/init.ts` — interactive prompt (default: Anthropic; offer OpenAI / OpenRouter / Ollama / none).
- **Acceptance:** `kairo init` writes a sensible default. Users can switch
  provider by editing config.
- **Tests:** schema validation tests.

### 3.4 — Architecture shift detection

- [ ] **Goal:** heuristics over event clusters identify framework migrations,
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

### 3.5 — Semantic search via sqlite-vec

- [ ] **Goal:** `kairo search "auth rewrite"` returns the right session even if
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

### 3.6 — `kairo wake` uses AI prose

- [ ] **Goal:** wake output is a human-prose paragraph, not bullet dumps.
- **Files:** `apps/cli/src/commands/wake.ts`.
- **Acceptance:** the output reads like a colleague briefing you on the last week.
- **Tests:** fixture-based.

**Milestone:** open a real codebase, search "auth rewrite", get the right
session. Read `.kairo/timeline.md` — it reads like a human wrote it.

---

## Phase 4 — Local web dashboard

**Goal:** open Kairo in a browser, see a timeline.

### 4.1 — `apps/web` skeleton

- [ ] **Goal:** Vite + React + Tailwind + shadcn skeleton.
- **Files:** `apps/web/`.
- **Acceptance:** `pnpm --filter @kairo/web dev` boots Vite, shows a placeholder page.
- **Tests:** none yet.
- **Notes:** No Next.js. The web app is static; `kairo serve` hosts it.

### 4.2 — Decide API surface

- [ ] **Goal:** how does the web UI read EventStore?
- **Options:**
  - (a) **In-process:** `kairo serve` spins up a tiny Hono server reading SQLite directly. (Simple.)
  - (b) **Sqlite WASM in browser:** Web reads `.kairo/kairo.db` directly via wa-sqlite. (Stricter local-first, more setup.)
- **Acceptance:** decision recorded in `docs/decisions/0001-web-data-source.md` with rationale.
- **Notes:** Recommend (a) for v1 — simpler. (b) becomes a later option when
  Tauri-shelling, since the WebView can `invoke` a Rust command that reads SQLite directly.

### 4.3 — Timeline view

- [ ] **Goal:** vertical timeline with phase grouping, architecture markers.
- **Files:** `apps/web/src/features/timeline/`.
- **Acceptance:** sessions render chronologically with summaries.
- **Tests:** component tests via Vitest + React Testing Library.

### 4.4 — Session detail view

- [ ] **Goal:** click a session, see commits, files, summary, architecture impact.
- **Files:** `apps/web/src/features/session/`.
- **Acceptance:** detail page renders all fields from the Session shape.

### 4.5 — Search UI

- [ ] **Goal:** search bar hooked to semantic search.
- **Files:** `apps/web/src/features/search/`.
- **Acceptance:** typing returns ranked sessions.

### 4.6 — `kairo serve` boots web + api

- [ ] **Goal:** one command starts everything.
- **Files:** `apps/cli/src/commands/serve.ts`.
- **Acceptance:** `kairo serve` opens browser to `http://localhost:4170`.

**Milestone:** `kairo serve` → browser → click around your project's history.

---

## Phase 5 — Tauri desktop shell

**Goal:** real desktop app, tray icon, autostart, Node observer sidecar supervised by the Rust core.

### 5.1 — `apps/desktop` Tauri skeleton

- [ ] **Goal:** Tauri shell wraps `apps/web`.
- **Files:** `apps/desktop/` — `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`,
  `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`. The renderer is whatever
  `apps/web` builds; `tauri.conf.json` points `build.frontendDist` at it and
  `build.devUrl` at the Vite dev server.
- **Acceptance:** `pnpm --filter @kairo/desktop dev` (wraps `tauri dev`) opens
  the dashboard in a native window with HMR for the renderer.
- **Notes:** Tauri 2. Use the system WebView (WKWebView on macOS, WebView2 on
  Windows, WebKitGTK on Linux). The Rust core is thin — its job is to host the
  WebView, expose `invoke` commands, and supervise the Node sidecar (5.3).

### 5.2 — Tray icon + autostart

- [ ] **Goal:** menubar icon, "open dashboard", "pause observation", autostart on login.
- **Files:** `apps/desktop/src-tauri/src/tray.rs`, `apps/desktop/src-tauri/src/autostart.rs`,
  capability entries in `apps/desktop/src-tauri/capabilities/`.
- **Acceptance:** verified manually on macOS; plan for Linux + Windows.
- **Notes:** Use Tauri 2's built-in `tray` APIs and `tauri-plugin-autostart`
  for cross-platform login-item handling — no per-OS code paths required.

### 5.3 — Observer sidecar management

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

### 5.4 — Session boundary notifications

- [ ] **Goal:** OS notification when a session finalizes.
- **Files:** `apps/desktop/src-tauri/src/notifications.rs`, capability entry
  for `notification:default`.
- **Acceptance:** opt-in toggle in settings; notification on Mac/Linux/Windows
  via `tauri-plugin-notification`.

**Milestone:** open Kairo from the dock, see your projects, get a notification when a coding session wraps.

---

## Phase 6 — Distribution

**Goal:** `npm install -g @kairo/cli` works; releases are automated.

### 6.1 — npm publish config

- [ ] **Goal:** `@kairo/cli` and `@kairo/mcp` are publishable.
- **Files:** `apps/cli/package.json` (`"publishConfig"`), `apps/mcp/package.json`.
- **Acceptance:** dry-run `npm publish` works.

### 6.2 — Changesets

- [ ] **Goal:** versioning is automated.
- **Files:** `.changeset/config.json`.
- **Acceptance:** `pnpm changeset` flow works for bumping versions.

### 6.3 — CI

- [ ] **Goal:** GitHub Actions runs `pnpm doctor` on every PR.
- **Files:** `.github/workflows/ci.yml`.
- **Acceptance:** PR runs typecheck, lint, test in CI.

### 6.4 — Release workflow

- [ ] **Goal:** tag → npm publish + Tauri build artifacts (`.dmg`, `.AppImage`, `.msi`) via `tauri build` (using `tauri-apps/tauri-action` in CI).
- **Files:** `.github/workflows/release.yml`.

### 6.5 — Docs site

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
