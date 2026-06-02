# Kairo

Kairo is a local-first development intelligence system. It observes project
activity, stores it locally, and reconstructs useful project memory.

This README is only for setting up the repo.

## Requirements

- Node.js 22 or newer
- pnpm 9.12.0
- Git
- Rust and the Tauri Linux/macOS/Windows prerequisites only if you work on
  `apps/desktop`

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

Useful package-level commands:

```sh
pnpm --filter @kairohq/cli exec tsx src/bin.ts --help
pnpm --filter @kairohq/cli exec tsx src/bin.ts init
pnpm --filter @kairohq/cli exec tsx src/bin.ts sweep
pnpm --filter @kairohq/web dev
pnpm --filter @kairohq/docs dev
```

## Install The Published Tools

```sh
npm install -g @kairohq/cli
npm install -g @kairohq/mcp
```

Then, inside a project you want Kairo to observe:

```sh
kairo init
kairo sweep
kairo doctor
```

## Where To Read More

- [CONTRIBUTING.md](CONTRIBUTING.md): contributor workflow, tests, and release notes.
- [docs/README.md](docs/README.md): map of all project docs.
- [docs/SRS.md](docs/SRS.md): product requirements and privacy constraints.
- [docs/SDD.md](docs/SDD.md): architecture and implementation design.
- [AGENTS.md](AGENTS.md): repo rules for agents and contributors.
- [TASKS.md](TASKS.md): phased implementation plan.
- [SECURITY.md](SECURITY.md): security and privacy reporting.
