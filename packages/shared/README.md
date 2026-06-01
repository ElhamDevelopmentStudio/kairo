# @kairohq/shared

Shared TypeScript types and Zod schemas for Kairo packages.

Use this package when an integration needs to validate or exchange Kairo
events, sessions, memory answers, AI configuration, source adapters, or symbol
metadata.

## Public surface

```ts
import {
  KairoEventSchema,
  MemoryAnswerSchema,
  SessionSchema,
} from "@kairohq/shared";

import type { KairoEvent, MemoryAnswer, Session } from "@kairohq/shared";
```

## Subpath exports

```ts
import { AiProviderConfigSchema } from "@kairohq/shared/ai";
import { KairoEventSchema } from "@kairohq/shared/events";
import { SessionSchema } from "@kairohq/shared/session";
import { StaticSymbolSchema } from "@kairohq/shared/symbol";
```

## Contract

Types and schemas used by more than one package belong here. Runtime logic,
storage, observation, and rendering belong in `@kairohq/core`.
