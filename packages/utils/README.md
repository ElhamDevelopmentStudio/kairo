# @kairohq/utils

Pure, cross-cutting helpers used across packages. Zero runtime deps beyond Node built-ins.

## Public surface

```ts
import { toIsoDate } from "@kairohq/utils/date";
import { slugify } from "@kairohq/utils/slug";
import { ensureDir, readJson, writeJson } from "@kairohq/utils/fs";
```

## Rules

- Every helper is pure (no hidden state, no module-level side effects).
- Every helper has tests next to it.
- No domain logic. If a helper knows about events, sessions, or git — it belongs in `@kairohq/core`, not here.
