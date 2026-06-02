# Developer Setup

Use this guide when working on the Kairo repository itself.

## Requirements

- Node.js 22 or newer
- pnpm 9.12.0
- Git
- Rust and Tauri platform prerequisites when working on `apps/desktop`

## Install

```sh
corepack enable
pnpm install
```

## Verify

```sh
pnpm run doctor
```

`doctor` runs typecheck, lint, and tests across the workspace.

## Run Locally

```sh
pnpm dev
```

This builds the dashboard, starts the local Kairo API, and starts the Vite web
app.

## Useful Commands

```sh
pnpm --filter @kairohq/cli exec tsx src/bin.ts --help
pnpm --filter @kairohq/cli exec tsx src/bin.ts init
pnpm --filter @kairohq/cli exec tsx src/bin.ts sweep
pnpm --filter @kairohq/web dev
pnpm --filter @kairohq/docs dev
```

## Contributor References

- [../CONTRIBUTING.md](../CONTRIBUTING.md): contributor workflow, tests, and releases.
- [SRS.md](SRS.md): product requirements and privacy constraints.
- [SDD.md](SDD.md): architecture and implementation design.
- [../AGENTS.md](../AGENTS.md): repo rules for agents and contributors.
- [../TASKS.md](../TASKS.md): phased implementation plan.
