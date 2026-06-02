# Contributing To Kairo

Keep contributions small, local-first, and easy to verify.

## Before You Change Code

1. Read [AGENTS.md](AGENTS.md) for repo rules and package boundaries.
2. Read [docs/SRS.md](docs/SRS.md) when behavior, privacy, storage, or product scope is involved.
3. Read [docs/SDD.md](docs/SDD.md) when architecture, package boundaries, or runtime design is involved.
4. Check [TASKS.md](TASKS.md) for the current phase and acceptance criteria.

## Setup

For full repository setup, use [docs/developer.md](docs/developer.md).

```sh
corepack enable
pnpm install
pnpm run doctor
```

## Development Rules

- Keep apps thin. Put reusable logic in `packages/core`, `packages/shared`, or `packages/utils`.
- Define shared types and schemas once in `@kairohq/shared`.
- Put pure cross-package helpers in `@kairohq/utils`.
- Keep observation, event, session, memory, and render logic in `@kairohq/core`.
- Do not add web frameworks, ORMs, queues, or new dependencies without a clear task requirement.
- Do not observe outside the project root.
- Do not log secrets.

## Tests

Run the smallest relevant check first:

```sh
pnpm --filter @kairohq/core test event-store
pnpm --filter @kairohq/core typecheck
```

Use broader checks when touching shared packages or release-level behavior:

```sh
pnpm --filter @kairohq/shared test
pnpm --filter @kairohq/utils test
pnpm run doctor
```

Run `pnpm run doctor` before a release, a phase boundary, or a broad shared
change.

## Documentation

- Update the root README only for setup changes.
- Add product requirements to [docs/SRS.md](docs/SRS.md).
- Add architecture or implementation decisions to [docs/SDD.md](docs/SDD.md) or `docs/decisions/`.
- Add source adapter guidance to [docs/sources/adapter-authoring.md](docs/sources/adapter-authoring.md).
- Add benchmark notes to [docs/benchmarks/](docs/benchmarks/).

## Releases

Public packages use Changesets.

```sh
pnpm changeset
pnpm version-packages
pnpm release
```

CI runs `pnpm install --frozen-lockfile` and `pnpm run doctor`.
