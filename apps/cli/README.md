# @kairohq/cli

Command-line interface for Kairo, a local-first project memory system.

Use this package when you want the `kairo` command without installing the
dashboard or desktop shell.

## Install

```sh
npm install -g @kairohq/cli
```

## Common commands

```sh
kairo init
kairo sweep
kairo ask "what changed before the dashboard split?"
kairo doctor
```

## What it does

- Initializes `.kairo/` project memory.
- Ingests git history and supported local agent transcripts.
- Stores local project events and reconstructed sessions.
- Serves the optional dashboard API when requested.
- Answers questions from captured local project memory.

## Privacy

Kairo is local-first. The CLI reads the current project and writes local Kairo
state under the project workspace unless you explicitly configure integrations.

## Related packages

- `@kairohq/core` contains observation, storage, session, and memory logic.
- `@kairohq/mcp` exposes project memory to MCP-compatible assistants.
- `@kairohq/ai` contains provider adapters for summaries and answers.
