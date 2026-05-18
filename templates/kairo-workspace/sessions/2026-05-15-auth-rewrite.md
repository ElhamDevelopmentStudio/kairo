---
slug: 2026-05-15-auth-rewrite
started: 2026-05-15T09:12:00Z
ended: 2026-05-18T17:40:00Z
intent: refactor
themes: [auth, middleware, token-rotation]
areas: [packages/auth, apps/web/middleware]
commits: 18
files_touched: 24
---

# Authentication Rewrite

## Summary

The auth surface drifted across web, desktop, and CLI — three middlewares each
validating tokens slightly differently. This session consolidates everything
into `@kairo/auth` and switches persistence from cookie-only to httpOnly +
refresh rotation.

## Key changes

- `packages/auth/` — extracted package, exports `verify`, `issue`, `rotate`
- `apps/web/middleware/auth.ts` — now delegates to `@kairo/auth/verify`
- `apps/desktop/auth.ts` — same; old custom validator deleted
- migration: existing cookie sessions are honored for 14 days, then forced refresh

## Architecture impact

- reduced hydration inconsistency: SSR and client now share one verifier
- simplified auth boundaries — one entrypoint instead of three
- groundwork for future SSO via the same `@kairo/auth` package

## Why now

Logged in `docs/decisions/0007-auth-consolidation.md`. Triggered by a session
hydration bug surfaced on 2026-05-13.
