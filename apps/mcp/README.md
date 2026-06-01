# @kairohq/mcp

MCP server for exposing local Kairo project memory to AI assistants.

Use this package when an MCP-compatible client should query the same local
project history that the `kairo` CLI records.

## Install

```sh
npm install -g @kairohq/mcp
```

## Run

```sh
kairo-mcp
```

The server reads the active project workspace and exposes tools for recent
sessions, session details, search, architecture shifts, imports, reflections,
and memory answers.

## Requirements

Initialize a project with the CLI first:

```sh
npm install -g @kairohq/cli
kairo init
kairo sweep
```

## Related packages

- `@kairohq/cli` provides the `kairo` command.
- `@kairohq/core` contains the local memory engine.
- `@kairohq/shared` contains the public schemas used by the server.
