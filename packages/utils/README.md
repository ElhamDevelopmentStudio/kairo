# @kairo/utils

Pure, cross-cutting helpers used across packages. Zero runtime deps beyond Node built-ins.

## Public surface

```ts
import { toIsoDate } from "@kairo/utils/date";
import { slugify } from "@kairo/utils/slug";
import { ensureDir, readJson, writeJson } from "@kairo/utils/fs";
```

## Rules

- Every helper is pure (no hidden state, no module-level side effects).
- Every helper has tests next to it.
- No domain logic. If a helper knows about events, sessions, or git — it belongs in `@kairo/core`, not here.
