# Publish source packages with runtime TypeScript loading

## Status

Accepted.

## Context

Kairo still runs TypeScript source directly in development. The current package graph uses `.ts` import specifiers and native dependencies such as `better-sqlite3`, so forcing a compiled `dist/` layout during the first npm distribution pass would require a broader ESM and native packaging migration.

## Decision

Publish the CLI, MCP server, and shared Kairo libraries as source packages. The executable packages install a small Node wrapper in `bin/` that resolves their local `tsx` dependency and runs the TypeScript entrypoint from `src/`.

## Consequences

`npm install -g @kairohq/cli` can run the CLI without a build step, and package dry-runs exercise the same files that users install. A later release can move to compiled `dist/` output once the import graph is migrated away from runtime TypeScript loading.

## Rejected

- Bundle the whole CLI into one artifact: native SQLite dependencies make this brittle for the first distribution pass.
- Emit `dist/` now: this requires a wider TypeScript module-resolution migration than Phase 7 needs.
- Keep internal packages private: global installs need resolvable published versions of the libraries used by the CLI and MCP packages.
