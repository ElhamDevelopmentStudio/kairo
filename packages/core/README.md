# @kairohq/core

Core observation, storage, reconstruction, and memory logic for Kairo.

This package is the local engine used by the CLI, MCP server, dashboard API,
and desktop shell. Most users should install `@kairohq/cli`; import this
package when building a Kairo integration.

## Public surface

```ts
import {
  EventStore,
  answerProjectMemory,
  reconstructSessions,
  renderTimelineMarkdown,
} from "@kairohq/core";
```

## What lives here

- SQLite-backed event storage.
- Git and filesystem observation helpers.
- Session reconstruction.
- Architecture and decision memory detection.
- Search and project-memory retrieval.
- Markdown rendering for timelines and session records.

## Package boundaries

- Cross-package schemas live in `@kairohq/shared`.
- Pure helpers live in `@kairohq/utils`.
- AI provider calls live in `@kairohq/ai`.
- Runnable commands live in `@kairohq/cli` and `@kairohq/mcp`.

## Local-first model

Core APIs operate on a project workspace and its local `.kairo/` state. They do
not require a hosted service.
