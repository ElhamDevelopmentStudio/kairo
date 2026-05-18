# AGENTS.md — How to work on Kairo

> This file is the contract every AI agent and human contributor follows when
> editing this repo. Read it before touching code. If a rule here conflicts
> with something you find in code, **the rule wins** — fix the code.

---

## 1. What Kairo is (mental model)

Kairo is a **local-first development intelligence system**. It passively
observes git, the filesystem, terminal usage, and optional AI-assistant
activity, and reconstructs that activity into structured project memory
(timelines, sessions, architecture shifts, semantic memory).

The system is built as five layers, top to bottom:

```
Observation  →  Event Processing  →  Evolution Intelligence  →  Storage  →  Surfaces
   (git,         (normalize,           (timeline, sessions,      (sqlite,     (markdown
   files,         reconstruct,          architecture,             vector,      sidecar,
   terminal,      detect intent)        AI summary)               metadata)    MCP, CLI,
   AI activity)                                                                dashboard)
```

Read `docs/SRS.md` and `docs/SDD.md` before any architectural decision — they
are the source of truth. If a task description here conflicts with the SRS,
flag it; do not silently diverge.

---

## 2. Repo layout

```
kairo/
├── docs/                 SRS + SDD (read-only architectural truth)
├── packages/             Importable libraries — used by apps and by each other
│   ├── shared/           Cross-cutting types + schemas (zod). The contract.
│   ├── utils/            Cross-cutting pure helpers (date, slug, fs, path).
│   ├── core/             Observers, EventStore, SessionReconstructor, render.
│   └── ai/               Provider-abstracted summarization + embeddings. (Phase 3)
├── apps/                 Runnable binaries / services
│   ├── cli/              `kairo` CLI binary
│   ├── mcp/              `kairo-mcp` MCP server
│   ├── web/              Vite dashboard (Phase 4)
│   └── desktop/          Tauri shell (Phase 5)
├── templates/            Files dropped into user projects by `kairo init`
└── (root config)         pnpm-workspace.yaml, turbo.json, tsconfig.base.json, …
```

**Library vs app distinction is load-bearing.** A library exports code; an
app produces a binary or runnable service. Never put a binary entry in
`packages/`. Never put a non-runnable library in `apps/`.

---

## 3. The Sharing Law

> If a piece of code is used by more than one package or app, it does **not**
> live in the package or app — it lives in `packages/shared` or
> `packages/utils`.

**No exceptions.** When you find yourself copying a function, a type, or a
constant: stop, move it to the right shared package, import it from both
sides. This includes:

| Kind of code | Lives in |
|---|---|
| Cross-package types and zod schemas | `@kairo/shared` |
| Pure helper functions (date, slug, fs, path, parsing) | `@kairo/utils` |
| Domain logic (observation, session reconstruction, render) | `@kairo/core` |
| AI provider abstraction | `@kairo/ai` |
| Binary entrypoints + thin command/transport wiring | `apps/*` |

**Types must be defined once.** If `Session` appears in both `apps/cli` and
`apps/mcp`, you have a bug — both should import it from `@kairo/shared`. Local
types (used inside a single module and never exported) are fine.

**Apps should be thin.** An app's job is: parse input, call into packages,
format output. App code should be the kind of thing you could rewrite from
scratch in an afternoon. The intelligence lives in `packages/core` and
`packages/ai`.

---

## 4. Folder structure conventions

These conventions apply to **every** package, **every** app, and **every**
module. Consistency beats cleverness.

### 4.1 A package

```
packages/{name}/
├── package.json          Workspace deps via "workspace:*"
├── tsconfig.json         Extends ../../tsconfig.base.json, composite: true
├── README.md             What this package does + public API surface
├── src/
│   ├── index.ts          Public surface — re-exports from modules
│   ├── {module}/         Each cohesive unit is a folder
│   │   ├── index.ts          Module's public surface
│   │   ├── {feature}.ts      Implementation
│   │   ├── {feature}.test.ts Tests live next to the code they test
│   │   └── types.ts          Module-local types only (cross-package types go in @kairo/shared)
│   └── internal/         Private helpers — not exported from root index.ts
└── test/                 Cross-module integration tests (optional)
```

### 4.2 An app

```
apps/{name}/
├── package.json
├── tsconfig.json
├── README.md
├── src/
│   ├── bin.ts            CLI entry — or main.ts for a service
│   ├── {feature}/        Feature modules (e.g. commands/, transport/, hooks/)
│   │   ├── index.ts
│   │   ├── {feature}.ts
│   │   └── {feature}.test.ts
│   └── internal/
└── test/
```

### 4.3 A module inside a package

```
src/{module}/
├── index.ts              Public surface — only what callers should import
├── {feature}.ts          Implementation
├── {feature}.test.ts     Colocated unit tests
└── types.ts              Module-local types only
```

### 4.4 Naming

- **Files:** kebab-case (`event-store.ts`, `session-reconstructor.ts`).
- **Folders:** kebab-case (`session-reconstructor/`, not `sessionReconstructor/`).
- **Exports:** PascalCase classes, camelCase functions, SCREAMING_SNAKE_CASE
  constants.
- **Test files:** `{name}.test.ts` next to `{name}.ts`. No separate test mirror trees.

### 4.5 The "where do I put it" decision tree

```
Is it a type or schema used across packages?  →  packages/shared
Is it a pure helper used across packages?     →  packages/utils
Is it observation / event / session logic?    →  packages/core
Is it AI provider / summarization?            →  packages/ai
Does it run as a binary or service?           →  apps/{name}
Is it used only inside one module?            →  stay in that module
Is it used by two modules in one package?     →  hoist to that package's src/internal/
Is it used by two packages?                   →  hoist to @kairo/shared or @kairo/utils
```

When in doubt, prefer hoisting up. Premature locality is worse than premature
sharing — sharing is recoverable, scattered duplicates are not.

---

## 5. Code rules

- **Modularity.** Every feature is a folder, not a file. If a file exceeds
  ~300 lines, it almost certainly contains more than one concept — split it.
- **No duplicate utilities.** Before writing a helper, grep `@kairo/utils` and
  the calling package's `src/internal/`. If it exists, use it. If not and the
  helper is reusable, put it in `@kairo/utils` from the start.
- **No re-declared types.** Before declaring a type, search `@kairo/shared`.
  If the concept exists, import it. If you're adding a new cross-package type,
  add it to `@kairo/shared`.
- **Strict TypeScript.** The root tsconfig sets `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`. Don't loosen these.
- **No defensive programming for impossible inputs.** Trust internal callers;
  validate only at system boundaries (CLI input, MCP input, hook payloads, AI
  responses). Use zod schemas from `@kairo/shared` for that validation.
- **Comments.** Default to none. Comment only when the *why* is non-obvious.
  Never comment what the code does — names already do that.
- **No unused exports.** If nothing imports it, delete it.
- **No dead branches.** If a code path can't happen, remove the handler.

---

## 6. Testing

- **Framework:** Vitest. Config lives at the repo root; packages just write
  `*.test.ts` files next to their code.
- **Production-grade means tested.** Every non-trivial function gets at least
  one test. Pure functions are easiest — bias toward pure.
- **Colocated tests.** `event-store.test.ts` sits next to `event-store.ts`.
  No `__tests__` mirror trees.
- **What to run per task:** **Only the tests relevant to the task.**
  `pnpm --filter @kairo/core test event-store` is the norm. Run the full suite
  (`pnpm test`) only when:
  - touching `@kairo/shared` (everything depends on it),
  - touching `@kairo/utils`,
  - finishing a phase,
  - or shipping a release.
- **Fixtures.** Live in `test/fixtures/` at the package root if cross-module,
  or `src/{module}/fixtures/` if module-local.
- **External calls.** AI provider calls in `@kairo/ai` use recorded fixtures
  (snapshots of responses) — tests never hit the network.

---

## 7. Performance and iteration

- **Speed is a feature.** Pick the simplest design that satisfies the task.
  Don't add abstraction layers because future-X *might* need them.
- **For each task, consider the best way — not the first way.** The criteria
  are: (1) least maintenance burden, (2) least code, (3) clearest at the call
  site. In that order.
- **Don't pre-build.** If a phase doesn't need an abstraction, don't add it.
  Wait for the second caller before generalizing.
- **Run only what you need.** Per-task: typecheck the touched package, run
  the relevant test file. Don't `pnpm typecheck` the whole monorepo on every
  edit unless you've changed `@kairo/shared`.

---

## 8. How to pick up a task

1. Open `TASKS.md`. Find the lowest-numbered task in the current phase that
   isn't checked.
2. Read its **Goal**, **Files**, **Acceptance**, **Tests**, **Notes**.
3. Read this file (yes, again) to confirm folder conventions for any new code.
4. Check `docs/SRS.md` and `docs/SDD.md` for any constraint that touches your
   task. If the SRS says "must remain optional", honor it.
5. Implement. Tests next to code. Imports respect the Sharing Law.
6. Run the relevant tests. Run `pnpm --filter <pkg> typecheck`.
7. Check the box in `TASKS.md`. Add a short note if you made a non-obvious
   decision (one line).

---

## 9. Common pitfalls (don't do these)

- **Don't add Hono / Express / Fastify** until you're building `apps/api` in
  Phase 4. The CLI talks to the core via direct function calls. No HTTP needed.
- **Don't add Next.js.** The dashboard runs in a Tauri webview — Vite is right.
- **Don't add Rust** before Phase 5. Node observation is more than fast enough
  for v1.
- **Don't add a queue / job system / message bus.** SQLite + a long-running
  process handles every Phase 1–3 workload.
- **Don't add an ORM.** `better-sqlite3` + handwritten SQL is faster, more
  obvious, and easier to debug than Drizzle or Prisma for this scale.
- **Don't depend tightly on one AI vendor.** All provider calls go through
  `@kairo/ai`. The SDD calls this out as a top risk (§17.4).
- **Don't observe outside the project root.** Kairo is per-project. Never
  read or write outside the user's project directory plus `~/.kairo/` for
  global config.
- **Don't log secrets.** Terminal observation must redact tokens, env vars,
  passwords. Privacy is in the SRS as a hard requirement (§9, §15).
- **Don't write a "temporary" duplicate type "for now."** It will stay. Put
  it in `@kairo/shared` the first time.

---

## 10. When in doubt

- The SRS and SDD answer "what should this do?"
- This file answers "where does the code go?"
- TASKS.md answers "what should I work on next?"
- Code answers "how is it currently done?"

If those four sources disagree, the order of authority is: SRS → SDD →
AGENTS.md → TASKS.md → code. Fix the lower-priority source to match.
