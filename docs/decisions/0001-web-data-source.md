# Web Data Source

## Decision

Kairo v1 will use an in-process local API for the web dashboard.

`kairo serve` will start the static Vite web app and a small local HTTP API in
the same Node process. The API reads `.kairo/kairo.db` through the existing
core storage layer instead of letting the browser open SQLite directly.

## Rationale

The dashboard is a local operational surface, not a hosted analytics product.
It needs to stay low-noise, timeline-centric, and easy to run from any project.
An in-process API keeps that path simple while preserving the local-first
boundary: all reads happen on the user's machine against the project-local
database.

This also keeps SQLite ownership in `@kairo/core`, where migrations, schemas,
redaction assumptions, and `EventStore` behavior already live. The web app gets
a stable data contract without duplicating database access logic in browser
code.

## Rejected Option

SQLite WASM in the browser is deferred.

Reading `.kairo/kairo.db` directly from Vite through `wa-sqlite` is stricter in
local-first spirit, but it adds browser file-access complexity before the
dashboard has real value. It would also risk duplicating EventStore query logic
and make migrations, locking, search, and future write paths harder to reason
about.

## Consequences

- `apps/web` remains a static Vite app.
- `kairo serve` owns the local API boundary.
- API handlers should stay thin and call `@kairo/core`.
- Browser code should not import `better-sqlite3`, `EventStore`, or Node-only
  workspace modules directly.
- Future Tauri work may revisit direct database reads through a desktop command
  boundary, not through generic browser SQLite access.

