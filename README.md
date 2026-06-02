# Kairo

<p align="center">
  <img src="assets/readme-banner.png" alt="Kairo - Understand how your software evolved. Timeline intelligence, context preservation, architecture evolution, and automatic documentation." width="100%" />
</p>

Kairo is a local-first development intelligence system. It observes project
activity, stores it locally, and reconstructs useful project memory.

This README is only for setting up Kairo as a user.

## Requirements

- Node.js 22 or newer
- Git

## Install

```sh
npm install -g @kairohq/cli @kairohq/mcp
```

## Initialize A Project

Run this inside the project you want Kairo to remember.

```sh
kairo init
```

`kairo init` creates local Kairo state, installs Claude Code and Codex capture
hooks, and registers the local Kairo MCP server so those assistants can query
project memory. No Kairo AI provider is required by default.

## Ingest Existing History

```sh
kairo sweep
```

This reads existing git history and writes local Kairo state under `.kairo/`.

## Check Setup

```sh
kairo doctor
```

## Use With Codex Or Claude Code

After `kairo init`, use Codex or Claude Code normally from the project. When you
ask about previous decisions, past fixes, architecture changes, or why something
exists, the assistant can query Kairo through the MCP setup written by init.

`kairo ask "what changed in the dashboard data source?"` is only a manual CLI
check; it is not required for assistant integrations.

## Where To Read More

- [apps/cli/README.md](apps/cli/README.md): CLI commands.
- [apps/mcp/README.md](apps/mcp/README.md): MCP server usage.
- [docs/README.md](docs/README.md): full documentation map.
- [docs/developer.md](docs/developer.md): local development setup.
- [SECURITY.md](SECURITY.md): security and privacy reporting.
